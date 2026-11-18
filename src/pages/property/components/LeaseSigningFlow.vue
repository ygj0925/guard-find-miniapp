<script setup lang="ts">
import type { Handwriting, LeaseDetail, SigningProfile } from '@/api/leases'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { actOnLease, fetchSigningProfile, removeSigningAsset } from '@/api/leases'
import { useTokenStore } from '@/store/token'
import { hasHandwriting, uploadPersonalSeal } from '@/utils/leaseSigning'
import HandwritingPad from './HandwritingPad.vue'
import LeaseContractDocument from './LeaseContractDocument.vue'
import PrivateSignatureImage from './PrivateSignatureImage.vue'
import LeaseReviewPanel from './LeaseReviewPanel.vue'

const props = defineProps<{
  lease: LeaseDetail
  active: boolean
}>()
const emit = defineEmits<{
  signed: [
  ]
  refresh: [
  ]
}>()
const tokenStore = useTokenStore()
const step = ref(0)
const read = ref(false)
const checked = ref(false)
const accepted = ref(false)
const saveSignature = ref(false)
const useSeal = ref(false)
const handwriting = ref<Handwriting>({ strokes: [] })
const profile = ref<SigningProfile>({})
const busy = ref(false)
const profileLoading = ref(false)
const profileError = ref('')
const error = ref('')
let generation = 0
let profileSequence = 0
const name = computed(() => props.lease.isTenant ? props.lease.tenantName : props.lease.landlordName)
const role = computed(() => props.lease.isTenant ? '承租方（乙方）' : '出租方（甲方）')
const eligible = computed(() => props.lease.status === 'PENDING_SIGNATURE' && (props.lease.isTenant ? !props.lease.tenantSignedAt : props.lease.isLandlord && !props.lease.landlordSignedAt))
function context() {
  const current = generation
  const token = tokenStore.updateNowTime().validToken
  return () => Boolean(token && props.active && current === generation && tokenStore.validToken === token)
}
function check(event: {
  detail: {
    value: string[]
  }
}, field: 'read' | 'checked' | 'accepted' | 'saveSignature' | 'useSeal') {
  if (busy.value)
    return
  const value = event.detail.value.includes('yes')
  if (field === 'read')
    read.value = value
  if (field === 'checked')
    checked.value = value
  if (field === 'accepted')
    accepted.value = value
  if (field === 'saveSignature')
    saveSignature.value = value
  if (field === 'useSeal')
    useSeal.value = value
}
async function loadProfile() {
  const current = ++profileSequence
  const sameContext = context()
  const valid = () => sameContext() && current === profileSequence
  profileLoading.value = true
  profileError.value = ''
  try {
    const result = await fetchSigningProfile()
    if (valid())
      profile.value = result
  }
  catch {
    if (valid())
      profileError.value = '我的签名和印章加载失败，可重试或直接手写签名'
  }
  finally {
    if (valid())
      profileLoading.value = false
  }
}
function next() {
  error.value = ''
  if (props.lease.unresolvedReviews) {
    error.value = '合同还有未解决的审阅意见，请先处理后刷新合同'
    return
  }
  if (step.value === 0 && !read.value) {
    error.value = '请阅读合同全文并勾选确认'
    return
  }
  if (step.value === 1 && !checked.value) {
    error.value = '请核对签约身份、租期与金额并勾选确认'
    return
  }
  step.value++
  uni.pageScrollTo({ scrollTop: 0, duration: 200 })
  if (step.value === 2)
    void loadProfile()
}
async function uploadSeal() {
  if (busy.value)
    return
  const valid = context()
  profileSequence++
  profileLoading.value = false
  busy.value = true
  error.value = ''
  try {
    const selected = await uni.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album'] })
    if (!valid() || !selected.tempFilePaths[0])
      return
    const confirmation = await uni.showModal({ title: '保存我的印章', content: '请确认你有权使用这枚印章。图片将保存到你的签署资料中，只有你可以在签约时调用。支持1MB以内PNG图片。', confirmText: '确认保存' })
    if (!confirmation.confirm || !valid())
      return
    const result = await uploadPersonalSeal(selected.tempFilePaths[0])
    if (valid()) {
      profile.value = result
      useSeal.value = false
    }
  }
  catch (failure) {
    if (valid() && !(String(failure).includes('cancel')))
      error.value = failure instanceof Error ? failure.message : '印章上传失败，请选择1MB以内PNG图片'
  }
  finally {
    if (valid())
      busy.value = false
  }
}
async function remove(kind: 'HANDWRITING' | 'SEAL') {
  if (busy.value)
    return
  const valid = context()
  profileSequence++
  profileLoading.value = false
  busy.value = true
  try {
    const result = await uni.showModal({ title: kind === 'SEAL' ? '删除保存的印章？' : '删除保存的签名？', content: '删除后不再出现在我的签署资料中。已经签署的合同记录保留原样。' })
    if (!result.confirm || !valid())
      return
    await removeSigningAsset(kind)
    if (!valid())
      return
    if (kind === 'SEAL')
      useSeal.value = false
    await loadProfile()
  }
  catch {
    if (valid())
      error.value = '删除失败，请重试'
  }
  finally {
    if (valid())
      busy.value = false
  }
}
function reuse() {
  if (busy.value || !profile.value.handwriting?.handwriting)
    return
  handwriting.value = { strokes: profile.value.handwriting.handwriting.strokes.map(stroke => stroke.map(point => ({ ...point }))) }
  saveSignature.value = false
}
async function sign() {
  const valid = context()
  if (!valid() || busy.value || !eligible.value)
    return
  if (props.lease.unresolvedReviews) {
    error.value = '合同还有未解决的审阅意见，请先处理后刷新合同'
    return
  }
  error.value = ''
  if (!read.value || !checked.value || !accepted.value) {
    error.value = '请阅读合同、核对信息并确认签署声明'
    return
  }
  if (!hasHandwriting(handwriting.value)) {
    error.value = '请清晰手写本人完整姓名，不能提交空白或过短笔迹'
    return
  }
  if (useSeal.value && !profile.value.seal) {
    error.value = '请先录入本人的印章'
    return
  }
  busy.value = true
  try {
    const confirmed = await uni.showModal({ title: '提交本人签名', content: `以${role.value}“${name.value}”签署当前合同${useSeal.value ? '，并加盖所选印章' : ''}。提交后签名将与本份合同一同保存。`, confirmText: '确认签署' })
    if (!confirmed.confirm || !valid())
      return
    await actOnLease(props.lease.id, { action: 'SIGN', version: props.lease.version, contentHash: props.lease.contentHash, signedName: name.value, accepted: true, handwriting: handwriting.value, saveSignature: saveSignature.value, ...(useSeal.value ? { sealId: profile.value.seal!.id } : {}) })
    if (valid())
      emit('signed')
  }
  catch (failure) {
    if (valid())
      error.value = failure instanceof Error ? failure.message : '签署未完成，请保留输入后重试'
  }
  finally {
    if (valid())
      busy.value = false
  }
}
watch(() => [props.active, props.lease.id, props.lease.contentHash, props.lease.version, tokenStore.validToken], () => {
  generation++
  profileSequence++
  profileLoading.value = false
  step.value = 0
  read.value = checked.value = accepted.value = saveSignature.value = useSeal.value = busy.value = false
  handwriting.value = { strokes: [] }
  profile.value = {}
  error.value = profileError.value = ''
}, { flush: 'sync' })
onBeforeUnmount(() => {
  generation++
})
</script>

<template>
  <view>
    <view class="mb-5 flex items-center justify-between gap-2">
      <view v-for="(label, index) in ['阅读合同', '核对信息', '手写签署']" :key="label" class="min-w-0 flex-1" :class="index <= step ? 'text-brand-blue' : 'text-app-muted'">
        <text class="block text-xs">0{{ index + 1 }}</text><text class="mt-1 block text-sm font-bold">{{ label }}</text>
        <view class="mt-2 h-1 rounded-full" :class="index <= step ? 'bg-brand-blue' : 'bg-app-border'" />
      </view>
    </view>
    <view v-if="!eligible" class="app-panel p-5">
      <text>当前合同无需继续签署，请返回查看最新进度。</text><button class="mt-4 app-primary-button" @tap="emit('refresh')">
        查看合同进度
      </button>
    </view>
    <template v-else>
      <template v-if="step === 0">
        <LeaseContractDocument :lease="lease" />
        <LeaseReviewPanel :lease="lease" :active="active" @changed="emit('refresh')" />
        <checkbox-group class="my-5" @change="check($event, 'read')">
          <label class="flex items-start text-sm leading-6"><checkbox value="yes" :checked="read" /><text>我已阅读合同全部内容，同意继续核对签约信息。</text></label>
        </checkbox-group>
        <button class="app-primary-button" @tap="next">
          下一步：核对信息
        </button>
      </template>
      <view v-else-if="step === 1" class="app-panel p-5">
        <text class="block text-xl font-bold">确认这份合同与你一致</text>
        <text class="mt-2 block text-sm text-app-muted">发现姓名、房源或金额有误，请先联系管家修改。</text>
        <view class="my-6 rounded-xl bg-app-soft p-5">
          <text class="block text-xs text-app-muted">本次签约身份</text><text class="mt-2 block text-xl font-bold">{{ name }}</text><text class="mt-1 block text-sm">{{ role }}</text>
        </view>
        <text class="block text-sm leading-7">
          房源：{{ lease.propertyTitle }}
          <text class="block">地址：{{ lease.propertyAddress }}</text><text class="block">租期：{{ lease.startDate }} 至 {{ lease.endDate }}</text><text class="block">月租 ¥{{ lease.monthlyRent }} · 押金 ¥{{ lease.deposit }}</text>
        </text>
        <checkbox-group class="my-5" @change="check($event, 'checked')">
          <label class="flex items-start text-sm leading-6"><checkbox value="yes" :checked="checked" /><text>我确认本人姓名、签约身份、房源、租期和金额无误。</text></label>
        </checkbox-group>
        <button class="app-primary-button" @tap="next">
          下一步：手写签署
        </button>
        <button class="mt-3 app-secondary-button" @tap="step = 0">
          返回阅读合同
        </button>
      </view>
      <view v-else class="app-panel p-5">
        <text class="block text-xl font-bold">请签署：{{ name }}</text><text class="mt-2 block text-sm text-app-muted">{{ role }} · 手写签名将显示在合同签署页</text>
        <view class="mt-5">
          <HandwritingPad v-model="handwriting" :disabled="busy" />
        </view>
        <text v-if="profileLoading" class="mt-3 block text-xs text-app-muted">正在读取我的签署资料…</text>
        <view v-if="profile.handwriting" class="mt-3 flex flex-wrap gap-2">
          <button class="app-secondary-button text-sm" :disabled="busy" @tap="reuse">
            使用我保存的签名
          </button><button class="app-secondary-button text-sm" :disabled="busy" @tap="remove('HANDWRITING')">
            删除已保存签名
          </button>
        </view>
        <checkbox-group class="mt-4" @change="check($event, 'saveSignature')">
          <label class="flex items-start text-sm leading-6"><checkbox value="yes" :checked="saveSignature" :disabled="busy" /><text>签署成功后保存为我的签名，供本人下次签约使用</text></label>
        </checkbox-group>
        <view class="my-6 border-0 border-t border-app-border border-solid pt-5">
          <text class="block font-bold">我的印章 <text class="text-xs text-app-muted font-normal">可选</text></text>
          <text class="mt-2 block text-xs text-app-muted leading-5">可录入本人有权使用的PNG印章图片。图片印章不含第三方认证证书。</text>
          <PrivateSignatureImage v-if="profile.seal" :base64="profile.seal.imageBase64" label="我的印章" class="mt-3" />
          <view class="mt-3 flex flex-wrap gap-2">
            <button class="app-secondary-button text-sm" :disabled="busy" @tap="uploadSeal">
              {{ profile.seal ? '更换印章图片' : '录入我的印章' }}
            </button><button v-if="profile.seal" class="app-secondary-button text-sm" :disabled="busy" @tap="remove('SEAL')">
              删除印章
            </button>
          </view>
          <checkbox-group v-if="profile.seal" class="mt-3" @change="check($event, 'useSeal')">
            <label class="flex items-start text-sm leading-6"><checkbox value="yes" :checked="useSeal" :disabled="busy" /><text>本次合同加盖这枚印章</text></label>
          </checkbox-group>
        </view>
        <view v-if="profileError" class="mb-4">
          <text class="text-sm text-app-danger">{{ profileError }}</text><button class="mt-2 app-secondary-button" :disabled="busy || profileLoading" @tap="loadProfile">
            重新加载签署资料
          </button>
        </view>
        <checkbox-group class="mt-4" @change="check($event, 'accepted')">
          <label class="flex items-start text-sm leading-6"><checkbox value="yes" :checked="accepted" :disabled="busy" /><text>{{ lease.signingConsent || '我已阅读并确认本合同全部内容，以本人姓名手写签署；确认所选印章为本人有权使用，同意将本次签名及印章与当前合同一并保存。' }}</text></label>
        </checkbox-group>
        <button class="mt-5 app-primary-button" :disabled="busy" :loading="busy" @tap="sign">
          确认签署合同
        </button>
        <button class="mt-3 app-secondary-button" :disabled="busy" @tap="step = 1">
          返回核对信息
        </button>
      </view>
      <view v-if="error" class="bg-app-panel mt-4 rounded-xl p-4">
        <text class="text-sm text-app-danger">{{ error }}</text><button class="mt-3 app-secondary-button" :disabled="busy" @tap="emit('refresh')">
          刷新合同信息
        </button>
      </view>
    </template>
  </view>
</template>
