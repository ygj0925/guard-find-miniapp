<script setup lang="ts">
import type { LeaseDetail } from '@/api/leases'
import type { LeaseBill, LeaseDocument, LeaseLifecycle, LifecycleAction } from '@/api/leaseLifecycle'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { actOnBill, actOnDocument, billLabels, documentLabels, documentStateLabels, fetchLeaseFile, fetchLeaseLifecycle, uploadLeaseFile } from '@/api/leaseLifecycle'
import { useTokenStore } from '@/store/token'

const props = defineProps<{ lease: LeaseDetail, active: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const tokenStore = useTokenStore()
const data = ref<LeaseLifecycle | null>(null)
const tab = ref<'bills' | 'handover' | 'settlement'>('bills')
const tabs = [{ value: 'bills' as const, label: '租金账单' }, { value: 'handover' as const, label: '交接记录' }, { value: 'settlement' as const, label: '押金结算' }]
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const form = ref<{ type: 'bill' | 'document', id: string, version: number, action: string, title: string } | null>(null)
const reference = ref('')
const reason = ref('')
const paidDate = ref('')
const fileId = ref('')
let generation = 0
let loadSequence = 0
const previewPaths: string[] = []
function clearPreviews() {
  // #ifdef MP-WEIXIN
  for (const path of previewPaths.splice(0)) uni.getFileSystemManager().unlink({ filePath: path, fail: () => {} })
  // #endif
}
const documents = computed(() => (data.value?.documents || []).filter(item => tab.value === 'settlement' ? item.kind === 'SETTLEMENT' : item.kind !== 'SETTLEMENT'))
const money = (value?: number) => Number(value || 0).toFixed(2)
const confirmedByMe = (doc: LeaseDocument) => props.lease.isTenant ? doc.tenantConfirmedAt : doc.landlordConfirmedAt
function currentDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function context() {
  const current = generation
  const token = tokenStore.updateNowTime().validToken
  const id = props.lease.id
  return () => Boolean(token && props.active && current === generation && tokenStore.validToken === token && props.lease.id === id)
}
async function load() {
  const sameContext = context()
  const sequence = ++loadSequence
  const valid = () => sameContext() && sequence === loadSequence
  if (!valid())
    return
  loading.value = true
  error.value = ''
  try {
    const result = await fetchLeaseLifecycle(props.lease.id)
    if (valid())
      data.value = result
  }
  catch (failure) {
    if (valid())
      error.value = failure instanceof Error ? failure.message : '账单和交接记录加载失败，请重试'
  }
  finally {
    if (valid())
      loading.value = false
  }
}
watch(() => [props.active, props.lease.id, tokenStore.validToken] as const, () => {
  generation++
  clearPreviews()
  data.value = null
  form.value = null
  busy.value = false
  loading.value = false
  error.value = ''
  reference.value = reason.value = fileId.value = ''
  if (props.active)
    void load()
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => {
  generation++
  clearPreviews()
})
function begin(type: 'bill' | 'document', item: LeaseBill | LeaseDocument, action: string, title: string) {
  if (busy.value)
    return
  form.value = { type, id: item.id, version: item.version, action, title }
  reference.value = reason.value = fileId.value = ''
  paidDate.value = currentDate()
  error.value = ''
}
async function execute(type: 'bill' | 'document', id: string, input: LifecycleAction, title: string) {
  if (busy.value)
    return
  const valid = context()
  if (!valid())
    return
  busy.value = true
  error.value = ''
  try {
    const modal = await uni.showModal({ title, content: '请核对记录与实际收付款情况。确认后会通知合同另一方，并保留操作记录。', confirmText: '确认提交' })
    if (!modal.confirm || !valid())
      return
    if (type === 'bill')
      await actOnBill(props.lease.id, id, input)
    else await actOnDocument(props.lease.id, id, input)
    if (!valid())
      return
    form.value = null
    uni.showToast({ title: '已记录本次操作', icon: 'none' })
    await load()
    if (valid())
      emit('changed')
  }
  catch (failure) {
    if (valid())
      error.value = failure instanceof Error ? failure.message : '提交失败，请保留输入后重试'
  }
  finally {
    if (valid())
      busy.value = false
  }
}
function submit() {
  const target = form.value
  if (!target)
    return
  const isPayment = ['SUBMIT', 'REFUND'].includes(target.action)
  if (isPayment && (!reference.value.trim() || !paidDate.value)) {
    error.value = '请填写实际付款日期及流水号或说明'
    return
  }
  if (!isPayment && !reason.value.trim()) {
    error.value = '请填写处理原因'
    return
  }
  void execute(target.type, target.id, { action: target.action, version: target.version, ...(isPayment ? { reference: reference.value.trim(), paidDate: paidDate.value, ...(fileId.value ? { fileId: fileId.value } : {}) } : { reason: reason.value.trim() }) }, target.title)
}
async function attach() {
  if (busy.value)
    return
  const valid = context()
  busy.value = true
  try {
    const selected = await uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
    if (!valid() || !selected.tempFilePaths[0])
      return
    const uploaded = await uploadLeaseFile(props.lease.id, selected.tempFilePaths[0])
    if (valid())
      fileId.value = uploaded
  }
  catch (failure) {
    if (valid() && !String(failure).includes('cancel'))
      error.value = failure instanceof Error ? failure.message : '未上传照片，请选择2MB以内的JPEG或PNG'
  }
  finally {
    if (valid())
      busy.value = false
  }
}
async function preview(id: string) {
  if (busy.value)
    return
  const valid = context()
  busy.value = true
  try {
    const file = await fetchLeaseFile(props.lease.id, id)
    if (!valid())
      return
    let url = `data:${file.mimeType};base64,${file.data}`
    // #ifdef MP-WEIXIN
    const path = `${wx.env.USER_DATA_PATH}/lease-preview-${id}.${file.mimeType === 'image/png' ? 'png' : 'jpg'}`
    await new Promise<void>((resolve, reject) => uni.getFileSystemManager().writeFile({ filePath: path, data: file.data, encoding: 'base64', success: () => resolve(), fail: reject }))
    previewPaths.push(path)
    if (!valid()) {
      clearPreviews()
      return
    }
    url = path
    // #endif
    if (valid())
      uni.previewImage({ urls: [url] })
  }
  catch (failure) {
    if (valid())
      error.value = failure instanceof Error ? failure.message : '照片加载失败'
  }
  finally {
    if (valid())
      busy.value = false
  }
}
</script>

<template>
  <view class="mt-4 app-panel p-5">
    <text class="block text-lg font-bold">入住与费用</text>
    <text class="mt-2 block text-sm text-app-muted">查看账单、核对交接清单，跟踪押金退还进度。</text>
    <view class="mt-4 flex flex-wrap gap-2">
      <button v-for="item in tabs" :key="item.value" class="app-secondary-button text-sm" :aria-pressed="tab === item.value" :style="tab === item.value ? { backgroundColor: 'var(--app-brand-blue)', color: 'var(--app-surface)' } : {}" :disabled="busy" @tap="tab = item.value">
        {{ item.label }}
      </button>
    </view>
    <text v-if="loading" class="mt-4 block">正在加载记录…</text>
    <view v-if="error" class="mt-4" role="alert">
      <text class="block text-app-danger">{{ error }}</text>
      <button class="mt-3 app-secondary-button" :disabled="busy" @tap="load">
        刷新记录
      </button>
    </view>
    <template v-if="data && !loading">
      <template v-if="tab === 'bills'">
        <view class="mt-5 border-0 border-b border-app-border border-solid pb-4">
          <text class="block font-bold">待结清 ¥{{ money(data.amountDue) }}</text>
          <text class="mt-2 block text-sm text-app-muted">含付款待确认 ¥{{ money(data.amountPending) }} · 已确认收款 ¥{{ money(data.amountPaid) }}</text>
        </view>
        <view v-for="bill in data.bills" :key="bill.id" class="border-0 border-b border-app-border border-solid py-5">
          <view class="flex flex-wrap justify-between gap-2">
            <text class="font-bold">{{ bill.title }}</text><text>{{ billLabels[bill.status] }}</text>
          </view>
          <text class="mt-3 block text-xl font-bold">¥{{ money(bill.amount) }}</text>
          <text class="mt-2 block text-sm">费用期间 {{ bill.periodStart }} 至 {{ bill.periodEnd }}</text>
          <text class="mt-2 block text-sm">应付日期 {{ bill.dueDate }}</text>
          <text v-if="bill.paymentReference" class="mt-2 block break-words text-sm">付款登记：{{ bill.paidDate }} · {{ bill.paymentReference }}</text>
          <button v-if="bill.paymentFileId" class="mt-3 app-secondary-button" :disabled="busy" @tap="preview(bill.paymentFileId)">
            查看付款照片
          </button>
          <button v-if="lease.isTenant && ['UNPAID', 'OVERDUE'].includes(bill.status)" class="mt-3 app-primary-button" :disabled="busy" @tap="begin('bill', bill, 'SUBMIT', '登记已线下付款')">
            登记已线下付款
          </button>
          <button v-if="lease.isTenant && bill.status === 'PENDING_CONFIRMATION'" class="mt-3 app-secondary-button" :disabled="busy" @tap="execute('bill', bill.id, { action: 'WITHDRAW', version: bill.version }, '撤回付款登记？')">
            撤回付款登记
          </button>
          <template v-if="lease.isLandlord && bill.status === 'PENDING_CONFIRMATION'">
            <button class="mt-3 app-primary-button" :disabled="busy" @tap="execute('bill', bill.id, { action: 'CONFIRM', version: bill.version }, `确认已收到 ¥${money(bill.amount)}？`)">
              确认已收到款项
            </button>
            <button class="mt-3 app-secondary-button" :disabled="busy" @tap="begin('bill', bill, 'REJECT', '退回付款登记')">
              未收到，退回登记
            </button>
          </template>
        </view>
        <text v-if="!data.bills.length" class="mt-5 block text-sm text-app-muted">暂无账单，管理员核对付款安排后会发送给你。</text>
      </template>
      <template v-else>
        <view v-for="doc in documents" :key="doc.id" class="border-0 border-b border-app-border border-solid py-5">
          <text class="block font-bold">{{ documentLabels[doc.kind] }} · {{ doc.content.date }}</text>
          <text class="mt-2 block text-brand-blue">{{ documentStateLabels[doc.status] }}</text>
          <template v-if="doc.kind === 'SETTLEMENT'">
            <text class="mt-3 block">已收押金 ¥{{ money(doc.content.depositHeld) }}</text>
            <text v-for="(item, index) in doc.content.deductions" :key="index" class="mt-2 block text-sm">{{ item.title }}：¥{{ money(item.amount) }}</text>
            <text class="mt-3 block font-bold">应退押金 ¥{{ money(doc.content.refundAmount) }}</text>
            <text v-if="doc.refundReference" class="mt-2 block break-words text-sm">退款登记：{{ doc.refundDate }} · {{ doc.refundReference }}</text>
          </template>
          <template v-else>
            <text class="mt-3 block whitespace-pre-wrap text-sm">物品清单：{{ doc.content.inventory }}</text>
            <text class="mt-3 block whitespace-pre-wrap text-sm">房屋现状：{{ doc.content.condition }}</text>
            <text class="mt-3 block text-sm">水表 {{ doc.content.water }} · 电表 {{ doc.content.electricity }} · 燃气 {{ doc.content.gas }}</text>
            <text class="mt-2 block text-sm">钥匙 {{ doc.content.keys }} 把</text>
          </template>
          <text class="mt-3 block whitespace-pre-wrap text-sm">{{ doc.content.note }}</text>
          <view class="mt-3 flex flex-wrap gap-2">
            <button v-for="(photo, index) in doc.content.photos" :key="photo" class="app-secondary-button text-sm" :disabled="busy" @tap="preview(photo)">
              查看照片 {{ index + 1 }}
            </button>
          </view>
          <text class="mt-3 block text-xs text-app-muted">承租方：{{ doc.tenantConfirmedAt || '未确认' }} · 出租方：{{ doc.landlordConfirmedAt || '未确认' }}</text>
          <template v-if="doc.status === 'PENDING'">
            <button v-if="!confirmedByMe(doc)" class="mt-3 app-primary-button" :disabled="busy" @tap="execute('document', doc.id, { action: 'CONFIRM', version: doc.version, contentHash: doc.contentHash }, '确认以上清单与实际情况一致？')">
              核对无误，确认记录
            </button>
            <button class="mt-3 app-secondary-button" :disabled="busy" @tap="begin('document', doc, 'DISPUTE', '对记录提出异议')">
              内容有误，提出异议
            </button>
          </template>
          <button v-if="lease.isLandlord && doc.status === 'REFUND_PENDING'" class="mt-3 app-primary-button" :disabled="busy" @tap="begin('document', doc, 'REFUND', '登记已退还押金')">
            登记已退还押金
          </button>
          <button v-if="lease.isTenant && doc.status === 'REFUNDED'" class="mt-3 app-primary-button" :disabled="busy" @tap="execute('document', doc.id, { action: 'RECEIVED', version: doc.version }, `确认实际收到 ¥${money(doc.content.refundAmount)} 押金？`)">
            确认押金已到账
          </button>
        </view>
        <text v-if="!documents.length" class="mt-5 block text-sm text-app-muted">暂无{{ tab === 'settlement' ? '押金结算单，完成退租交接和费用核对后由管理员发起。' : '交接记录，现场核对后由管理员发起双方确认。' }}</text>
      </template>
    </template>
    <view v-if="form" class="mt-5 border-0 border-t border-app-border border-solid pt-5">
      <text class="block font-bold">{{ form.title }}</text>
      <template v-if="['SUBMIT', 'REFUND'].includes(form.action)">
        <text class="mt-4 block text-sm">实际付款日期</text>
        <picker mode="date" :value="paidDate" :end="currentDate()" :disabled="busy" @change="paidDate = String($event.detail.value)">
          <view class="mt-2 rounded-lg bg-app-soft p-3">
            {{ paidDate }}
          </view>
        </picker>
        <text class="mt-4 block text-sm">付款流水号或说明</text>
        <textarea v-model="reference" aria-label="付款流水号或说明" :maxlength="1000" :disabled="busy" class="mt-2 box-border h-28 w-full rounded-lg bg-app-soft p-3" />
        <button v-if="form.action === 'SUBMIT'" class="mt-3 app-secondary-button" :disabled="busy" @tap="attach">
          {{ fileId ? '付款照片已上传，重新选择' : '上传付款照片（选填，2MB以内）' }}
        </button>
        <text class="mt-3 block text-sm text-app-muted">登记实际发生的线下转账，由收款方核对确认。</text>
      </template>
      <template v-else>
        <text class="mt-4 block text-sm">原因或需要更正的内容</text>
        <textarea v-model="reason" aria-label="处理原因" :maxlength="500" :disabled="busy" class="mt-2 box-border h-28 w-full rounded-lg bg-app-soft p-3" />
      </template>
      <button class="mt-4 app-primary-button" :disabled="busy" :loading="busy" @tap="submit">
        确认提交记录
      </button>
      <button class="mt-3 app-secondary-button" :disabled="busy" @tap="form = null">
        取消填写
      </button>
    </view>
  </view>
</template>
