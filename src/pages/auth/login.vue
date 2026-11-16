<script setup lang="ts">
/**
 * 登录页:仅支持微信小程序一键登录(wx.login code → 服务端换 token)。
 */
import { wechatMiniappLogin } from '@/api/login'
import { useTokenStore } from '@/store/token'

definePage({
  excludeLoginPath: true,
  style: {
    navigationStyle: 'custom',
    navigationBarBackgroundColor: '#F7F9FF',
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '上海泊之湾公寓',
    backgroundColor: '#F7F9FF',
  },
})

const tokenStore = useTokenStore()
const appName = import.meta.env.VITE_APP_TITLE
const loading = ref(false)
const agreed = ref(false)

function skipLogin() {
  uni.switchTab({ url: '/pages/index/index' })
}

function openAgreement(type: 'user' | 'privacy') {
  uni.navigateTo({ url: `/pages/agreement/index?type=${type}` })
}

async function ensureAgreed(): Promise<boolean> {
  if (agreed.value)
    return true
  const { confirm } = await uni.showModal({
    title: '用户协议与隐私政策',
    content: '登录前请阅读并同意《用户协议》和《隐私政策》。',
    confirmText: '同意并登录',
    cancelText: '暂不登录',
    confirmColor: '#3569DF',
  })
  if (confirm)
    agreed.value = true
  return confirm
}

async function onWxLogin() {
  if (loading.value || !(await ensureAgreed()))
    return
  loading.value = true
  try {
    // #ifdef MP-WEIXIN
    const code = await new Promise<string>((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: response => response.code ? resolve(response.code) : reject(new Error('微信未返回登录凭证')),
        fail: (error: any) => reject(new Error(error?.errMsg || '微信授权失败,请重试')),
      })
    })
    const resp = await wechatMiniappLogin(code)
    tokenStore.setTokenInfo(resp)
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => uni.switchTab({ url: '/pages/index/index' }), 600)
    // #endif
    // #ifndef MP-WEIXIN
    uni.showToast({ title: '请在微信小程序中使用微信登录', icon: 'none' })
    // #endif
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '登录失败,请稍后再试'
    uni.showToast({ title: message, icon: 'none' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="pencil-page login-page">
    <view class="login-brand">
      <text class="pencil-title">泊之湾</text><text class="pencil-subtitle">找一处，安心住下。</text>
    </view>
    <view class="login-heading">
      <text class="login-title">欢迎登录</text><text class="pencil-subtitle">登录后享受更完整的租住服务</text>
    </view>
    <view class="login-card">
      <view class="login-symbol" aria-hidden="true">
        <view class="i-carbon-chat h-56rpx w-56rpx" />
      </view>
      <text class="login-card-title">微信快捷登录</text><text class="login-card-copy">{{ appName }}</text>
      <text class="login-card-copy">收藏心仪房源，预约看房，随时联系管家</text>
      <button class="pencil-primary login-submit" :disabled="loading" :loading="loading" @tap="onWxLogin">
        {{ loading ? '登录中…' : '微信一键登录' }}
      </button>
      <view class="login-agreement">
        <button class="app-tap agreement-check" role="checkbox" :aria-checked="agreed" aria-label="我已阅读并同意用户协议和隐私政策" @tap="agreed = !agreed">
          <view class="h-32rpx w-32rpx" :class="agreed ? 'i-carbon-checkbox-checked-filled' : 'i-carbon-checkbox'" />
        </button><view><text @tap="agreed = !agreed">我已阅读并同意</text><text class="agreement-link" @tap="openAgreement('user')">《用户协议》</text><text>和</text><text class="agreement-link" @tap="openAgreement('privacy')">《隐私政策》</text></view>
      </view>
      <text class="login-note">未注册的微信将自动创建账号</text>
    </view>
    <button class="app-tap login-guest" @tap="skipLogin">
      暂不登录 ›
    </button>
  </view>
</template>

<style scoped>
.login-page {
  padding: calc(var(--status-bar-height, 0px) + 52rpx) 38rpx 80rpx;
}
.login-brand,
.login-heading {
  padding: 0 7rpx;
}
.login-heading {
  margin-top: 106rpx;
}
.login-title {
  display: block;
  color: #1e2c50;
  font-size: 49rpx;
  font-weight: 700;
  line-height: 64rpx;
}
.login-card {
  margin-top: 48rpx;
  padding: 52rpx 38rpx 34rpx;
  border-radius: 38rpx;
  background: white;
  box-shadow: 0 6rpx 19rpx #c6d2ea55;
  text-align: center;
}
.login-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 104rpx;
  height: 104rpx;
  margin: 0 auto 24rpx;
  border-radius: 30rpx;
  color: #3569df;
  background: #e8f0ff;
}
.login-card-title {
  display: block;
  color: #26365e;
  font-size: 32rpx;
  font-weight: 600;
}
.login-card-copy {
  display: block;
  margin-top: 16rpx;
  color: #7b88a4;
  font-size: 24rpx;
  line-height: 38rpx;
}
.login-submit {
  width: 100%;
  margin-top: 38rpx;
}
.login-agreement {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16rpx;
  color: #8d9ab2;
  font-size: 21rpx;
  line-height: 34rpx;
  text-align: left;
}
.agreement-check {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-width: 82rpx;
  min-height: 82rpx;
  padding: 0;
  background: transparent;
  color: #3569df;
}
.agreement-link {
  color: #3962c7;
}
.login-note {
  display: block;
  margin-top: 12rpx;
  color: #8d9ab2;
  font-size: 21rpx;
}
.login-guest {
  margin: 40rpx auto 0;
  min-height: 88rpx;
  padding: 20rpx 30rpx;
  background: transparent;
  color: #58709e;
  font-size: 25rpx;
}
</style>
