<script setup lang="ts">
import type { IdentityVerificationState } from '@/api/identityVerification'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { createIdentityVerificationSession, fetchIdentityVerificationStatus, grantIdentityVerificationConsent } from '@/api/identityVerification'
import { useTokenStore } from '@/store/token'

const props = defineProps<{ active: boolean; name: string }>()
const emit = defineEmits<{ verified: [value: boolean]; state: [value: IdentityVerificationState] }>()
const tokenStore = useTokenStore()
const state = ref<IdentityVerificationState>({ mode: 'DISABLED', status: 'NOT_REQUIRED', required: false })
const checked = ref(false)
const loading = ref(false)
const error = ref('')
const realName = ref(props.name)
const idNumber = ref('')
let generation = 0

const verified = computed(() => state.value.status === 'VERIFIED')
const blocked = computed(() => state.value.required && !verified.value)
const needsConsent = computed(() => ['NOT_STARTED', 'PENDING_CONSENT'].includes(state.value.status) && Boolean(state.value.consentVersion))

function validContext(current: number, token: string) {
  return () => props.active && current === generation && tokenStore.validToken === token
}

async function load() {
  const token = tokenStore.updateNowTime().validToken
  if (!token || !props.active || loading.value)
    return
  const current = ++generation
  const valid = validContext(current, token)
  loading.value = true
  error.value = ''
  try {
    const result = await fetchIdentityVerificationStatus()
    if (!valid())
      return
    state.value = result
    emit('verified', result.status === 'VERIFIED')
    emit('state', result)
  }
  catch {
    if (valid())
      error.value = '实名认证状态读取失败，请重试'
  }
  finally {
    if (valid())
      loading.value = false
  }
}

async function start() {
  if (!checked.value || loading.value)
    return
  const token = tokenStore.updateNowTime().validToken
  if (!token || !props.active)
    return
  if (state.value.mode === 'MANUAL' && (!realName.value.trim() || !idNumber.value.trim())) {
    error.value = '请填写真实姓名和身份证号码'
    return
  }
  const current = ++generation
  const valid = validContext(current, token)
  loading.value = true
  error.value = ''
  try {
    const consent = await grantIdentityVerificationConsent(state.value.consentVersion || 'default')
    if (!valid())
      return
    state.value = consent
    emit('state', consent)
    const session = await createIdentityVerificationSession({
      ...(state.value.mode === 'MANUAL' ? { realName: realName.value.trim(), idNumber: idNumber.value.trim() } : {}),
      consentVersion: state.value.consentVersion || 'identity-v1',
    })
    if (!valid())
      return
    state.value = session
    emit('state', session)
    if (session.launchUrl) {
      uni.navigateTo({ url: `/pages/property/identity-verify?sessionId=${encodeURIComponent(session.sessionId || '')}&url=${encodeURIComponent(session.launchUrl)}` })
    }
  }
  catch {
    if (valid())
      error.value = '实名认证发起失败，请稍后重试'
  }
  finally {
    if (valid())
      loading.value = false
  }
}

watch(() => [props.active, tokenStore.validToken], () => {
  generation++
  checked.value = false
  realName.value = props.name
  idNumber.value = ''
  state.value = { mode: 'DISABLED', status: 'NOT_REQUIRED', required: false }
  if (props.active)
    void load()
}, { flush: 'sync', immediate: true })
onBeforeUnmount(() => { generation++ })
</script>

<template>
  <view class="my-5 app-panel p-5">
    <text class="block font-bold">签署人身份核验</text>
    <text v-if="verified" class="mt-2 block text-sm text-brand-green">已完成实名认证，可以继续签署。</text>
    <template v-else-if="state.mode === 'DISABLED' || state.status === 'NOT_REQUIRED'">
      <text class="mt-2 block text-sm leading-6 text-app-muted">实名认证服务尚未启用，当前按小程序账号和签署记录完成确认。</text>
    </template>
    <template v-else>
      <text class="mt-2 block text-sm leading-6 text-app-muted">实名认证用于确认签署人身份。需要处理身份证信息或人脸信息时，系统会单独征得你的同意。</text>
      <text v-if="state.mode === 'MANUAL'" class="mt-3 block text-sm text-app-danger">提交身份信息后，由管家完成线下核验。</text>
      <text v-else-if="state.status === 'PENDING'" class="mt-3 block text-sm text-brand-blue">认证已发起，请完成认证后返回本页。</text>
      <text v-else-if="state.status === 'FAILED' || state.status === 'EXPIRED' || state.status === 'REJECTED' || state.status === 'UNAVAILABLE'" class="mt-3 block text-sm text-app-danger">{{ state.failureReason || '上次认证未完成，请重新发起。' }}</text>
      <template v-if="state.mode === 'MANUAL'">
        <input v-model="realName" class="mt-4 min-h-11 w-full rounded-lg bg-app-soft px-4" :maxlength="100" placeholder="请输入真实姓名" :disabled="loading" />
        <input v-model="idNumber" class="mt-3 min-h-11 w-full rounded-lg bg-app-soft px-4" :maxlength="18" type="idcard" placeholder="请输入身份证号码" :disabled="loading" />
      </template>
      <checkbox-group v-if="needsConsent" class="mt-4" @change="checked = $event.detail.value.includes('yes')">
        <label class="flex items-start text-sm leading-6"><checkbox value="yes" :checked="checked" :disabled="loading" /><text>我已阅读并同意为本次合同签署进行实名认证，并了解相关身份信息处理说明。</text></label>
      </checkbox-group>
      <button v-if="['PROVIDER', 'MANUAL'].includes(state.mode) && ['NOT_STARTED', 'PENDING_CONSENT', 'FAILED', 'EXPIRED', 'REJECTED', 'UNAVAILABLE'].includes(state.status)" class="mt-4 app-secondary-button" :disabled="loading || !checked" @tap="start">开始实名认证</button>
      <text v-if="blocked" class="mt-3 block text-xs text-app-danger">完成实名认证后才能提交签名。</text>
    </template>
    <button v-if="error" class="mt-3 app-secondary-button" :disabled="loading" @tap="load">重试读取</button>
    <text v-if="error" class="mt-2 block text-sm text-app-danger">{{ error }}</text>
  </view>
</template>
