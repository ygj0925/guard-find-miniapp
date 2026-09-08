<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { socialLogin } from '@/api/login'
import { LOGIN_PAGE } from '@/router/config'
import { assertWechatH5AuthFingerprint, consumeWechatH5OAuthCallback, WECHAT_H5_SOCIAL_SOURCE } from '@/service/auth/wechat-h5-oauth'
import { isCrossContextAuthLockSupported, useTokenStore } from '@/store/token'
import { navigateAfterAuthenticated } from './navigation'

definePage({
  excludeLoginPath: true,
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '微信登录',
    backgroundColor: '#f5f8fc',
  },
})

const tokenStore = useTokenStore()
const status = ref<'processing' | 'success' | 'failed'>('processing')
const message = ref('正在完成微信登录，请稍候...')
const authClientId = import.meta.env.VITE_AUTH_CLIENT_ID || 'ef51c9a3e9046c4f2ea45142c8a8344a'
let processing = false
let activeLoginAttemptId: number | null = null

function readOption(value: unknown) {
  return typeof value === 'string' ? value : ''
}

async function completeWechatLogin(options: Record<string, unknown>) {
  if (processing)
    return
  processing = true

  try {
    if (!isCrossContextAuthLockSupported())
      throw new Error('当前浏览器不支持安全微信登录，请升级浏览器或使用手机号登录')

    const callback = consumeWechatH5OAuthCallback({
      source: readOption(options.oauth_source),
      code: readOption(options.code),
      state: readOption(options.state),
      error: readOption(options.error),
    })
    if (callback.kind === 'error')
      throw new Error('你已取消或未完成微信授权，请重新登录')

    const attemptId = tokenStore.beginLoginAttempt()
    activeLoginAttemptId = attemptId

    assertWechatH5AuthFingerprint(callback.authFingerprint)
    const token = await socialLogin({
      clientId: authClientId,
      authType: 'SOCIAL',
      source: WECHAT_H5_SOCIAL_SOURCE,
      code: callback.code,
      state: callback.state,
    })

    assertWechatH5AuthFingerprint(callback.authFingerprint)
    const committed = await tokenStore.completeExternalLogin(
      token,
      attemptId,
      () => assertWechatH5AuthFingerprint(callback.authFingerprint),
    )
    if (!committed)
      throw new Error('微信登录已被新的登录操作替代')

    activeLoginAttemptId = null
    status.value = 'success'
    message.value = '微信登录成功，正在进入应用...'
    navigateAfterAuthenticated(callback.redirect)
  }
  catch (error) {
    status.value = 'failed'
    message.value = error instanceof Error ? error.message : '微信登录失败，请重新尝试'
  }
  finally {
    if (activeLoginAttemptId !== null) {
      tokenStore.cancelLoginAttempt(activeLoginAttemptId)
      activeLoginAttemptId = null
    }
    processing = false
  }
}

function returnToLogin() {
  uni.reLaunch({ url: LOGIN_PAGE })
}

onLoad((options) => {
  // #ifdef H5
  void completeWechatLogin((options || {}) as Record<string, unknown>)
  // #endif
  // #ifndef H5
  status.value = 'failed'
  message.value = '当前平台不支持 H5 微信登录'
  // #endif
})

onUnmounted(() => {
  if (activeLoginAttemptId !== null) {
    tokenStore.cancelLoginAttempt(activeLoginAttemptId)
    activeLoginAttemptId = null
  }
})
</script>

<template>
  <view class="box-border min-h-[var(--app-viewport-height)] flex items-center justify-center bg-[#f5f8fc] px-48rpx py-80rpx">
    <view class="box-border max-w-640rpx w-full rounded-32rpx bg-white px-44rpx py-56rpx text-center shadow-[0_20rpx_70rpx_rgba(31,65,112,0.12)]">
      <view
        class="mx-auto h-104rpx w-104rpx flex items-center justify-center rounded-full"
        :class="status === 'failed' ? 'bg-[#fff1f0] text-[#d92d20]' : 'bg-[#e9f9ef] text-[#07a84f]'"
        aria-hidden="true"
      >
        <view v-if="status === 'processing'" class="i-carbon-circle-dash animate-spin text-52rpx leading-none" />
        <view v-else-if="status === 'success'" class="i-carbon-checkmark-filled text-52rpx leading-none" />
        <view v-else class="i-carbon-warning-filled text-52rpx leading-none" />
      </view>

      <text class="mt-28rpx block text-34rpx text-[#1d2939] font-700">
        {{ status === 'failed' ? '微信登录未完成' : '微信安全登录' }}
      </text>
      <text class="mt-18rpx block text-27rpx text-[#667085] leading-44rpx" :role="status === 'failed' ? 'alert' : 'status'">
        {{ message }}
      </text>

      <button
        v-if="status === 'failed'"
        class="callback-button mt-40rpx h-88rpx w-full rounded-44rpx border-none bg-[#2389ef] p-0 text-31rpx text-white font-600 leading-88rpx"
        @tap="returnToLogin"
      >
        返回登录页
      </button>
    </view>
  </view>
</template>

<style scoped>
.callback-button::after {
  border: none;
}
</style>
