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
    navigationBarBackgroundColor: '#EDF6FF',
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '上海泊之湾公寓',
    backgroundColor: '#EDF6FF',
  },
})

const tokenStore = useTokenStore()
const appName = import.meta.env.VITE_APP_TITLE
const loading = ref(false)
const agreed = ref(false)

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
  <view class="min-h-full flex flex-col items-center bg-#EDF6FF px-8">
    <view class="mt-32 flex flex-col items-center">
      <view class="h-20 w-20 flex items-center justify-center rounded-3xl bg-#1677FF text-3xl text-white shadow-lg">
        泊
      </view>
      <text class="mt-4 text-center text-xl text-#303133 font-bold">{{ appName }}</text>
      <text class="mt-1 text-center text-sm text-#909399">公寓找房 · 看房预约 · 管家服务</text>
    </view>

    <button
      class="mt-24 w-full flex items-center justify-center gap-2 rounded-full bg-#07C160 py-3 text-base text-white"
      :disabled="loading"
      @tap="onWxLogin"
    >
      {{ loading ? '登录中…' : '微信一键登录' }}
    </button>

    <view class="mt-4 flex items-start justify-center text-xs text-#909399 leading-5">
      <view
        class="shrink-0 p-3"
        role="checkbox"
        :aria-checked="agreed"
        aria-label="我已阅读并同意用户协议和隐私政策"
        @tap="agreed = !agreed"
      >
        <view
          class="h-5 w-5"
          :class="agreed ? 'i-carbon-checkbox-checked-filled text-#1677FF' : 'i-carbon-checkbox text-#A8ABB2'"
        />
      </view>
      <view class="min-w-0 py-3">
        <text @tap="agreed = !agreed">我已阅读并同意</text>
        <text class="text-#1677FF" @tap="openAgreement('user')">《用户协议》</text>
        <text>和</text>
        <text class="text-#1677FF" @tap="openAgreement('privacy')">《隐私政策》</text>
      </view>
    </view>

    <text class="mt-3 text-center text-xs text-#A8ABB2">
      未注册的微信将自动创建账号
    </text>
  </view>
</template>

<style scoped>
</style>
