<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { normalizeTrustedBannerUrl } from '@/utils/bannerTarget'

defineOptions({
  name: 'CommonWebview',
})

definePage({
  style: {
    navigationBarTitleText: '活动详情',
    backgroundColor: '#FFFFFF',
  },
})

const WEBVIEW_LOAD_TIMEOUT = 15_000
const pageUrl = ref('')
const invalidUrl = ref(false)
const loadFailed = ref(false)
const loading = ref(false)
const webviewKey = ref(0)
let loadTimer: ReturnType<typeof setTimeout> | undefined

function decodeTargetUrl(rawUrl: string) {
  try {
    return decodeURIComponent(rawUrl)
  }
  catch {
    return rawUrl
  }
}

function clearLoadTimer() {
  if (loadTimer !== undefined) {
    clearTimeout(loadTimer)
    loadTimer = undefined
  }
}

function startLoading() {
  clearLoadTimer()
  loadFailed.value = false
  loading.value = true
  webviewKey.value += 1
  loadTimer = setTimeout(() => {
    if (loading.value) {
      loading.value = false
      loadFailed.value = true
    }
  }, WEBVIEW_LOAD_TIMEOUT)
}

function handleLoad() {
  loading.value = false
  clearLoadTimer()
}

function handleLoadError() {
  loading.value = false
  loadFailed.value = true
  clearLoadTimer()
}

function retry() {
  if (!pageUrl.value)
    return
  loadFailed.value = true
  nextTick(startLoading)
}

function goBack() {
  uni.navigateBack({
    fail: () => uni.switchTab({ url: '/pages/index/index' }),
  })
}

onLoad((query: Record<string, string | undefined>) => {
  const targetUrl = normalizeTrustedBannerUrl(decodeTargetUrl(query.url || ''))
  if (!targetUrl) {
    invalidUrl.value = true
    return
  }
  pageUrl.value = targetUrl
  startLoading()
})

onUnload(clearLoadTimer)
</script>

<template>
  <view class="h-screen bg-white">
    <web-view
      v-if="pageUrl && !loadFailed"
      :key="webviewKey"
      class="h-full w-full"
      :src="pageUrl"
      @load="handleLoad"
      @error="handleLoadError"
    />
    <view v-else-if="invalidUrl || loadFailed" class="h-full flex flex-col items-center justify-center px-8 text-center">
      <view class="i-carbon-warning-alt mb-3 text-3xl text-app-warning leading-none" />
      <text class="text-base text-app-ink font-700">{{ loadFailed ? '活动页面加载失败' : '链接暂时无法打开' }}</text>
      <text class="mt-2 text-xs text-app-muted leading-relaxed">
        {{ loadFailed ? '请检查网络后重新加载，或稍后再试' : '仅支持三生制药官方 HTTPS 活动链接' }}
      </text>
      <view class="mt-6 flex items-center gap-3">
        <button
          v-if="loadFailed"
          class="min-h-88rpx border-1rpx border-brand-blue rounded-full border-solid bg-white px-6 text-sm text-brand-blue"
          @tap="retry"
        >
          重新加载
        </button>
        <button class="min-h-88rpx border-0 rounded-full bg-brand-blue px-6 text-sm text-white" @tap="goBack">
          返回
        </button>
      </view>
    </view>
  </view>
</template>
