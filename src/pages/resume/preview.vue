<script setup lang="ts">
import { ref } from 'vue'
import { getFileUrl } from '@/api/resume'
import AppPageHeader from '@/components/AppPageHeader.vue'

defineOptions({ name: 'ResumePreview' })

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '在线预览' } })

const previewUrl = ref('')
const loading = ref(true)
const failed = ref(false)

function withToken(url: string) {
  const token = uni.getStorageSync<string>('auth-access-token')
  if (!token)
    return url
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

onLoad(async (options) => {
  const id = options?.id
  if (!id) {
    failed.value = true
    loading.value = false
    return
  }
  try {
    const { previewUrl: url } = await getFileUrl(id)
    if (!url) {
      failed.value = true
      return
    }
    previewUrl.value = withToken(url)
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
})

function handleBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.reLaunch({ url: '/pages/resume/index' })
}
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-[#f5f7fa]">
    <AppPageHeader title="在线预览" background="#ffffff" scrolled-background="#ffffff">
      <template #left>
        <button
          class="plain-button h-12 w-12 flex cursor-pointer items-center justify-center border-0 rounded-full bg-transparent p-0 text-xl text-[#17233d] leading-none active:bg-[#eef4ff]"
          aria-label="关闭预览"
          @tap="handleBack"
        >
          <view class="i-carbon-chevron-left" />
        </button>
      </template>
    </AppPageHeader>

    <view class="h-[calc(var(--app-viewport-height)-64rpx)] w-full">
      <view v-if="loading" class="flex h-full items-center justify-center text-sm text-[#98a2b3]">
        加载中...
      </view>
      <view v-else-if="failed" class="flex h-full items-center justify-center text-sm text-[#98a2b3]">
        简历加载失败，请稍后重试
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <web-view v-if="!loading && !failed && previewUrl" class="h-full w-full" :src="previewUrl" />
      <!-- #endif -->
    </view>
  </view>
</template>

<style scoped>
.plain-button::after {
  border: 0;
}
</style>
