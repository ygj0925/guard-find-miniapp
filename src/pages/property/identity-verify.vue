<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchIdentityVerificationSession, fetchIdentityVerificationStatus } from '@/api/identityVerification'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({ style: { navigationBarTitleText: '实名认证' } })

const tokenStore = useTokenStore()
const sessionId = ref('')
const launchUrl = ref('')
const loading = ref(false)
const error = ref('')
const status = ref('PENDING')
const active = ref(false)
const providerOpened = ref(false)
let generation = 0

const authenticated = computed(() => Boolean(tokenStore.validToken))
const validSession = computed(() => /^[1-9a-zA-Z_-]{1,128}$/.test(sessionId.value))

function openProvider() {
  if (!launchUrl.value || !active.value)
    return
  // The backend returns a short-lived provider page token. It is never placed in a business API request.
  // #ifdef H5
  window.location.assign(launchUrl.value)
  // #endif
  // #ifndef H5
  providerOpened.value = true
  // #endif
}

async function refresh() {
  const token = tokenStore.updateNowTime().validToken
  if (!token || !active.value)
    return
  const current = ++generation
  const valid = () => active.value && current === generation && tokenStore.validToken === token
  loading.value = true
  error.value = ''
  try {
    const result = sessionId.value && validSession.value
      ? await fetchIdentityVerificationSession(sessionId.value)
      : await fetchIdentityVerificationStatus()
    if (!valid())
      return
    status.value = result.status
    launchUrl.value = result.launchUrl || ''
    if (result.status === 'VERIFIED') {
      uni.showToast({ title: '实名认证已完成', icon: 'success' })
      setTimeout(() => { if (valid()) uni.navigateBack() }, 700)
    }
  }
  catch {
    if (valid())
      error.value = '认证状态读取失败，请重试'
  }
  finally {
    if (valid())
      loading.value = false
  }
}

onLoad((query) => {
  sessionId.value = String(query?.sessionId || '')
  launchUrl.value = String(query?.url || '')
})
onShow(() => {
  active.value = true
  void refresh()
})
onHide(() => {
  active.value = false
  generation++
})
onUnload(() => {
  active.value = false
  generation++
})
</script>

<template>
  <view class="app-page">
    <view class="app-content py-5">
      <view v-if="!authenticated" class="app-panel p-5">
        <text>请先登录后完成实名认证</text>
        <button class="mt-4 app-primary-button" @tap="toLoginPage">去登录</button>
      </view>
      <view v-else class="app-panel p-5">
        <text class="block text-xl font-bold">实名认证</text>
        <text class="mt-2 block text-sm leading-6 text-app-muted">认证页面由服务端创建，会话完成后自动返回合同签署页面。请不要把身份证或人脸照片发送到聊天中。</text>
        <text v-if="status === 'PENDING'" class="mt-6 block text-brand-blue">认证进行中，请完成认证后返回。</text>
        <text v-else-if="status === 'FAILED' || status === 'EXPIRED'" class="mt-6 block text-app-danger">本次认证未完成，可以重新发起。</text>
        <text v-else class="mt-6 block text-sm text-app-muted">正在读取认证状态…</text>
        <button v-if="launchUrl" class="mt-5 app-primary-button" :disabled="loading" @tap="openProvider">继续实名认证</button>
        <web-view v-if="providerOpened && launchUrl" class="mt-4 h-140 w-full" :src="launchUrl" />
        <button class="mt-3 app-secondary-button" :disabled="loading" @tap="refresh">刷新认证状态</button>
        <text v-if="error" class="mt-4 block text-sm text-app-danger">{{ error }}</text>
      </view>
    </view>
  </view>
</template>
