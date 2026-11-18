<script setup lang="ts">
import type { LeaseAction, LeaseActionInput, LeaseDetail } from '@/api/leases'
import { computed, ref, watch } from 'vue'
import { actOnLease, fetchLease, fetchLeasePdf, leaseActionLabels, leaseStatusLabels, renewalLabels } from '@/api/leases'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'
import LeaseLifecycle from './components/LeaseLifecycle.vue'
import LeaseContractDocument from './components/LeaseContractDocument.vue'
import LeaseReviewPanel from './components/LeaseReviewPanel.vue'
import { openLeasePdf } from '@/utils/leaseSigning'

definePage({ style: { navigationBarTitleText: '合同与租期' } })
const tokenStore = useTokenStore()
const authenticated = computed(() => Boolean(tokenStore.validToken))
const id = ref('')
const data = ref<LeaseDetail | null>(null)
const loading = ref(false)
const failed = ref(false)
const busy = ref(false)
const error = ref('')
const reason = ref('')
const requestedEndDate = ref('')
const action = ref<LeaseAction | ''>('')
let visible = false
const pageVisible = ref(false)
let generation = 0
const validId = computed(() => /^[1-9]\d*$/.test(id.value))
const canSign = computed(() => {
  const lease = data.value
  return lease?.status === 'PENDING_SIGNATURE' && ((lease.isTenant && !lease.tenantSignedAt) || (lease.isLandlord && !lease.landlordSignedAt))
})
const canRenew = computed(() => {
  const lease = data.value
  if (!lease?.isTenant || lease.status !== 'SIGNED')
    return false
  return lease.canRenew ?? (lease.daysRemaining >= 0 && lease.daysRemaining <= (lease.renewalWindowDays ?? 90) && !['PENDING', 'APPROVED'].includes(lease.renewalStatus))
})
const canMoveOut = computed(() => Boolean(data.value?.isTenant && ['SIGNED', 'EXPIRED'].includes(data.value.status) && data.value.moveOutStatus !== 'PENDING' && !['PENDING', 'APPROVED'].includes(data.value.renewalStatus)))
const signedByMe = computed(() => data.value?.isTenant ? data.value?.tenantSignedAt : data.value?.landlordSignedAt)
function resetInputs() {
  reason.value = ''
  requestedEndDate.value = ''
  action.value = ''
  error.value = ''
}
function invalidate() {
  generation++
  loading.value = false
  busy.value = false
}
async function load() {
  const token = tokenStore.updateNowTime().validToken
  if (!token || !visible || !validId.value || busy.value)
    return
  const current = ++generation
  const valid = () => visible && current === generation && tokenStore.validToken === token
  loading.value = true
  failed.value = false
  try {
    const result = await fetchLease(id.value)
    if (!valid())
      return
    if (result.status === 'DRAFT')
      throw new Error('合同尚未发送')
    if (data.value && (data.value.version !== result.version || data.value.contentHash !== result.contentHash))
      resetInputs()
    data.value = result
  }
  catch {
    if (valid()) {
      failed.value = true
      data.value = null
    }
  }
  finally {
    if (valid())
      loading.value = false
  }
}
function begin(value: LeaseAction) {
  if (busy.value)
    return
  action.value = value
  reason.value = ''
  requestedEndDate.value = ''
  error.value = ''
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
async function submit(value: LeaseAction) {
  if (busy.value || !data.value || !visible)
    return
  const token = tokenStore.updateNowTime().validToken
  if (!token) {
    toLoginPage()
    return
  }
  const lease = data.value
  error.value = ''
  const input: LeaseActionInput = { action: value, version: lease.version }
  if (value === 'SIGN')
    return
  if (!reason.value.trim()) {
    error.value = '请填写原因或说明'
    return
  }
  if (value === 'DECLINE' && !canSign.value)
    return
  if (value === 'RENEW_REQUEST' && !canRenew.value)
    return
  if (value === 'RENEW_CANCEL' && (!lease.isTenant || lease.renewalStatus !== 'PENDING'))
    return
  if (value === 'MOVE_OUT_REQUEST' && !canMoveOut.value)
    return
  if (value === 'MOVE_OUT_CANCEL' && (!lease.isTenant || lease.moveOutStatus !== 'PENDING'))
    return
  input.reason = reason.value.trim()
  if (value === 'RENEW_REQUEST') {
    if (!validDate(requestedEndDate.value) || requestedEndDate.value <= lease.endDate) {
      error.value = '续租结束日期需晚于当前合同结束日期'
      return
    }
    input.requestedEndDate = requestedEndDate.value
  }
  const current = generation
  const valid = () => visible && current === generation && tokenStore.validToken === token
  busy.value = true
  try {
    const confirmed = await uni.showModal({
      title: leaseActionLabels[value],
      content: value === 'MOVE_OUT_REQUEST' ? '提交退租意向后由管理人员联系处理，不会立即终止合同。' : '请确认本次提交的信息，处理结果将在合同详情与业务通知中展示。',
      confirmText: '确认提交',
    })
    if (!confirmed.confirm || !valid())
      return
    await actOnLease(id.value, input)
    if (!valid())
      return
    resetInputs()
    busy.value = false
    uni.showToast({ title: '申请已提交', icon: 'none' })
    await load()
  }
  catch (failure) {
    if (valid())
      error.value = failure instanceof Error ? failure.message : '处理失败，请保留输入并重试；若合同已变更，请刷新查看'
  }
  finally {
    if (valid())
      busy.value = false
  }
}
function copyContract() {
  if (!data.value || !tokenStore.updateNowTime().validToken || busy.value)
    return
  const lease = data.value
  const content = [lease.title, `合同编号：${lease.id}`, `房源：${lease.propertyTitle}`, `地址：${lease.propertyAddress}`, `出租方：${lease.landlordName}`, `承租方：${lease.tenantName}`, `租期：${lease.startDate} 至 ${lease.endDate}`, `月租：${lease.monthlyRent}元；押金：${lease.deposit}元`, '', lease.terms, '', `状态：${leaseStatusLabels[lease.status]}`, `出租方确认：${lease.landlordSignedName || '未确认'} ${lease.landlordSignedAt || ''}`, `承租方确认：${lease.tenantSignedName || '未确认'} ${lease.tenantSignedAt || ''}`, `合同内容校验值：${lease.contentHash}`, '以上为小程序双方确认签署记录，不含第三方实名认证或CA认证。'].join('\n')
  uni.setClipboardData({ data: content, fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' }) })
}
function openSigning() {
  if (canSign.value && !busy.value && tokenStore.updateNowTime().validToken)
    uni.navigateTo({ url: `/pages/property/lease-sign?id=${id.value}` })
}
async function download() {
  const token = tokenStore.updateNowTime().validToken
  if (!data.value || !token || busy.value)
    return
  const current = generation
  busy.value = true
  try {
    const file = await fetchLeasePdf(id.value)
    if (!visible || generation !== current || tokenStore.validToken !== token)
      return
    await openLeasePdf(file, () => visible && generation === current && tokenStore.validToken === token)
  }
  catch {
    if (generation === current)
      error.value = '合同下载失败，请重试'
  }
  finally {
    if (generation === current)
      busy.value = false
  }
}
function openLease(value?: string) {
  if (value && /^[1-9]\d*$/.test(value) && tokenStore.updateNowTime().validToken)
    uni.navigateTo({ url: `/pages/property/lease-detail?id=${value}` })
}
function support() {
  uni.navigateTo({ url: `/pages/message/chat?mode=support&leaseId=${id.value}` })
}
onLoad((query) => {
  id.value = String(query?.id || '')
})
onShow(() => {
  visible = true
  pageVisible.value = true
  void load()
})
onHide(() => {
  visible = false
  pageVisible.value = false
  invalidate()
})
onUnload(() => {
  visible = false
  pageVisible.value = false
  invalidate()
})
watch(() => tokenStore.validToken, () => {
  invalidate()
  data.value = null
  failed.value = false
  resetInputs()
  if (visible)
    void load()
}, { flush: 'sync' })
</script>

<template>
  <view class="app-page">
    <view class="app-content py-6">
      <view v-if="!authenticated" class="app-panel p-5">
        <text class="block">登录后查看本人合同</text><button class="mt-4 app-primary-button" @tap="toLoginPage">
          去登录
        </button>
      </view>
      <view v-else-if="!validId" class="app-panel p-5">
        合同链接无效，请从“我的租约”重新进入。
      </view>
      <view v-else-if="loading" class="app-panel p-5">
        正在加载合同…
      </view>
      <view v-else-if="failed" class="app-panel p-5">
        <text>合同加载失败或当前账号无权访问。</text><button class="mt-4 app-secondary-button" @tap="load">
          重新加载
        </button>
      </view>
      <template v-else-if="data">
        <view class="app-panel p-5">
          <text class="block text-xl font-bold">{{ data.title }}</text>
          <text class="mt-3 block text-brand-blue">{{ leaseStatusLabels[data.status] }}</text>
          <text class="mt-2 block text-sm text-app-muted">合同编号 {{ data.id }}</text>
          <text v-if="data.status === 'PENDING_SIGNATURE' && data.signatureDeadline" class="mt-2 block text-sm">请于 {{ data.signatureDeadline }} 前完成双方签署</text>
          <text v-if="data.status === 'SIGNING_EXPIRED'" class="mt-3 block text-sm text-app-danger">本次签署已超时，请联系管家重新发起合同。</text>
          <text class="mt-4 block font-bold">{{ data.propertyTitle }}</text>
          <text class="mt-2 block text-sm">{{ data.propertyAddress }}</text>
          <text class="mt-3 block">出租方：{{ data.landlordName }}</text>
          <text class="mt-2 block">承租方：{{ data.tenantName }}</text>
          <text class="mt-3 block">租期：{{ data.startDate }} 至 {{ data.endDate }}</text>
          <text class="mt-3 block">月租 ¥{{ data.monthlyRent }} · 押金 ¥{{ data.deposit }}</text>
          <text v-if="['SIGNED', 'EXPIRED'].includes(data.status)" class="mt-3 block text-brand-blue">{{ data.daysRemaining > 0 ? `距租期结束 ${data.daysRemaining} 天` : data.daysRemaining === 0 ? '今天租期结束' : '本合同租期已结束' }}</text>
        </view>
        <view class="mt-4 app-panel p-5">
          <text class="block font-bold">签约进度</text>
          <view class="grid grid-cols-2 mt-4 gap-3">
            <view class="rounded-lg bg-app-soft p-3">
              <text class="block text-xs text-app-muted">出租方 · {{ data.landlordName }}</text><text class="mt-2 block text-sm font-bold">{{ data.landlordSignedAt ? '已签署' : '等待签署' }}</text>
            </view>
            <view class="rounded-lg bg-app-soft p-3">
              <text class="block text-xs text-app-muted">承租方 · {{ data.tenantName }}</text><text class="mt-2 block text-sm font-bold">{{ data.tenantSignedAt ? '已签署' : '等待签署' }}</text>
            </view>
          </view>
          <text v-if="signedByMe && data.status === 'PENDING_SIGNATURE'" class="mt-3 block text-sm text-brand-blue">你已签署，等待另一方签署。</text>
          <button v-if="canSign" class="mt-5 app-primary-button" :disabled="busy" @tap="openSigning">
            阅读并手写签署
          </button>
          <button class="mt-3 app-secondary-button" :disabled="busy" :loading="busy" @tap="download">
            下载合同 PDF
          </button>
          <text class="mt-2 block text-xs text-app-muted leading-5">PDF包含合同正文与当前签署记录；未签齐时会标注签署中。</text>
          <button v-if="canSign" class="mt-3 app-secondary-button" :disabled="busy" @tap="begin('DECLINE')">
            信息有误 / 拒绝签署
          </button>
        </view>
        <LeaseContractDocument v-if="pageVisible" :lease="data" class="mt-4" />
        <LeaseReviewPanel v-if="pageVisible && (data.status === 'PENDING_SIGNATURE' || data.reviews?.length)" :lease="data" :active="pageVisible" @changed="load" />
        <button class="mt-3 app-secondary-button" :disabled="busy" @tap="copyContract">
          复制合同全文与签署记录
        </button>
        <view v-if="['SIGNED', 'EXPIRED'].includes(data.status)" class="mt-4 app-panel p-5">
          <text class="block font-bold">续租与退租</text>
          <text class="mt-3 block text-sm">{{ renewalLabels[data.renewalStatus] }}</text>
          <text v-if="data.requestedEndDate" class="mt-2 block text-sm">申请续租至：{{ data.requestedEndDate }}</text>
          <text v-if="data.renewalReason" class="mt-2 block text-sm">说明：{{ data.renewalReason }}</text>
          <text class="mt-3 block text-xs text-app-muted">续租经管理人员处理后生成新合同，双方需要重新签署。原合同租期不会自动延长。</text>
          <button v-if="canRenew" class="mt-4 app-primary-button" :disabled="busy" @tap="begin('RENEW_REQUEST')">
            申请续租
          </button>
          <text v-else-if="data.isTenant && data.status === 'SIGNED' && data.renewalStatus === 'NONE'" class="mt-3 block text-sm text-app-muted">临近租期结束时可申请续租，也可先联系管家沟通。</text>
          <button v-if="data.isTenant && data.renewalStatus === 'PENDING'" class="mt-3 app-secondary-button" :disabled="busy" @tap="begin('RENEW_CANCEL')">
            撤销续租申请
          </button>
          <button v-if="data.renewalLeaseId && data.renewalLeaseStatus !== 'DRAFT'" class="mt-3 app-secondary-button" :disabled="busy" @tap="openLease(data.renewalLeaseId)">
            查看续租合同
          </button>
          <text v-if="data.renewalLeaseStatus === 'DRAFT'" class="mt-3 block text-sm text-app-muted">续租合同正在准备，发送签署后会通过业务通知告知。</text>
          <button v-if="canMoveOut" class="mt-3 app-secondary-button" :disabled="busy" @tap="begin('MOVE_OUT_REQUEST')">
            提交退租意向
          </button>
          <text v-if="data.moveOutStatus === 'PENDING'" class="mt-3 block text-sm">退租意向待处理，合同尚未终止。</text>
          <button v-if="data.isTenant && data.moveOutStatus === 'PENDING'" class="mt-3 app-secondary-button" :disabled="busy" @tap="begin('MOVE_OUT_CANCEL')">
            撤回退租意向
          </button>
          <text v-if="data.moveOutStatus === 'RESOLVED'" class="mt-3 block text-sm">退租意向已处理，请查看处理记录及当前合同状态。</text>
        </view>
        <view v-if="action" class="mt-4 app-panel p-5">
          <text class="block font-bold">{{ leaseActionLabels[action] }}</text>
          <textarea v-model="reason" :disabled="busy" :maxlength="500" class="mt-4 box-border min-h-24 w-full rounded-lg bg-app-soft p-3" placeholder="请填写原因或说明" aria-label="申请说明" />
          <picker v-if="action === 'RENEW_REQUEST'" mode="date" :disabled="busy" :start="data.endDate" :value="requestedEndDate" @change="requestedEndDate = String($event.detail.value)">
            <view class="mt-3 rounded-lg bg-app-soft p-3">
              {{ requestedEndDate || '选择续租结束日期' }}
            </view>
          </picker>
          <text v-if="action === 'MOVE_OUT_REQUEST'" class="mt-3 block text-sm text-app-muted">这里只提交沟通意向，实际退租和合同终止需管理人员处理。</text>
          <button class="mt-4 app-primary-button" :loading="busy" :disabled="busy" @tap="submit(action)">
            确认提交申请
          </button>
          <button class="mt-3 app-secondary-button" :disabled="busy" @tap="action = ''">
            暂不提交
          </button>
        </view>
        <view v-if="error" class="mt-4 app-panel p-5">
          <text class="block text-app-danger">{{ error }}</text><button class="mt-3 app-secondary-button" :disabled="busy" @tap="load">
            刷新合同状态
          </button>
        </view>
        <LeaseLifecycle v-if="['SIGNED', 'EXPIRED', 'TERMINATED'].includes(data.status)" :lease="data" :active="pageVisible" @changed="load" />
        <view class="mt-4 app-panel p-5">
          <text class="block font-bold">租期提醒</text><text class="mt-3 block text-sm text-app-muted">临期与到期提醒在“消息 → 业务通知”中查看。微信订阅提醒暂未启用，请主动关注租期。</text>
          <button class="mt-4 app-secondary-button" @tap="support">
            联系公寓管家
          </button>
          <button v-if="data.previousLeaseId" class="mt-3 app-secondary-button" @tap="openLease(data.previousLeaseId)">
            查看原合同
          </button>
        </view>
        <view class="mt-4 app-panel p-5">
          <text class="block font-bold">合同处理记录</text>
          <view v-for="log in data.logs" :key="log.id" class="mt-4 border-0 border-b border-app-border border-solid pb-4">
            <text class="block text-sm">{{ leaseActionLabels[log.action] || log.action }}</text><text v-if="log.reason" class="mt-1 block whitespace-pre-wrap text-sm">{{ log.reason }}</text><text class="mt-1 block text-xs text-app-muted">{{ log.createTime }}</text>
          </view>
          <text v-if="!data.logs?.length" class="mt-3 block text-sm text-app-muted">暂无处理记录</text>
        </view>
      </template>
    </view>
  </view>
</template>
