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
    navigationBarTitleText: '登录',
    backgroundColor: '#EDF6FF',
  },
})

const tokenStore = useTokenStore()
const loading = ref(false)

async function onWxLogin() {
  if (loading.value)
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
    await tokenStore.setTokenInfo(resp)
    uni.showToast({ title: resp.isNewUser ? '登录成功,欢迎加入' : '登录成功', icon: 'success' })
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
  <view class="flex min-h-full flex-col items-center bg-#EDF6FF px-8">
    <view class="mt-32 flex flex-col items-center">
      <view class="flex h-20 w-20 items-center justify-center rounded-3xl bg-#1677FF text-3xl text-white shadow-lg">
        家
      </view>
      <text class="mt-4 text-xl font-bold text-#303133">生生智家</text>
      <text class="mt-1 text-sm text-#909399">安心找房 · 实时沟通 · 管家服务</text>
    </view>

    <button
      class="mt-24 flex w-full items-center justify-center gap-2 rounded-full bg-#07C160 py-3 text-base text-white"
      :disabled="loading"
      @tap="onWxLogin"
    >
      {{ loading ? '登录中…' : '微信一键登录' }}
    </button>

    <text class="mt-6 text-center text-xs text-#A8ABB2">
      未注册的微信将自动创建账号
    </text>
  </view>
</template>

<style scoped>
</style>
