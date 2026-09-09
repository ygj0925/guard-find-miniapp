<script setup lang="ts">
import { ref } from 'vue'
import { getFileUrl } from '@/api/resume'
import AppPageHeader from '@/components/AppPageHeader.vue'
// #ifdef H5
import { downloadH5File, resolveH5ResourceUrl } from '@/utils/h5File'
// #endif

defineOptions({ name: 'ResumePreview' })

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '在线预览' } })

const previewUrl = ref('')
const attachmentUrl = ref('')
const resumeId = ref('')
const loading = ref(true)
const downloading = ref(false)
const failed = ref(false)
const failureMessage = ref('简历加载失败，请稍后重试')
let requestSequence = 0

function withToken(url: string) {
  const token = String(uni.getStorageSync<string>('auth-access-token') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token)
    return url
  const hashIndex = url.indexOf('#')
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : ''
  return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}${hash}`
}

async function loadPreview() {
  if (!resumeId.value) {
    failed.value = true
    loading.value = false
    failureMessage.value = '缺少简历信息，无法预览'
    return
  }

  const requestId = ++requestSequence
  previewUrl.value = ''
  attachmentUrl.value = ''
  failed.value = false
  loading.value = true
  failureMessage.value = '简历加载失败，请稍后重试'

  try {
    const urls = await getFileUrl(resumeId.value)
    if (requestId !== requestSequence)
      return
    attachmentUrl.value = urls.attachmentUrl || ''
    if (!urls.previewUrl)
      throw new Error('简历预览地址不存在')

    // #ifdef H5
    // kkFileView 等预览服务必须保留自身 origin 和资源基址，不能 Fetch 后转成同源 Blob。
    previewUrl.value = resolveH5ResourceUrl(urls.previewUrl)
    // #endif

    // #ifndef H5
    previewUrl.value = withToken(urls.previewUrl)
    // #endif
  }
  catch (error) {
    if (requestId !== requestSequence)
      return
    failed.value = true
    failureMessage.value = error instanceof Error ? error.message : '简历加载失败，请稍后重试'
  }
  finally {
    if (requestId === requestSequence)
      loading.value = false
  }
}

onLoad((options) => {
  resumeId.value = typeof options?.id === 'string' ? options.id : ''
  void loadPreview()
})

onUnload(() => {
  requestSequence += 1
})

async function downloadOriginal() {
  if (!attachmentUrl.value || downloading.value)
    return
  downloading.value = true
  try {
    // #ifdef H5
    await downloadH5File(attachmentUrl.value, '简历')
    uni.showToast({ title: '下载已开始', icon: 'none' })
    // #endif
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '简历下载失败', icon: 'none' })
  }
  finally {
    downloading.value = false
  }
}

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
      <view v-if="loading" class="h-full flex items-center justify-center text-sm text-[#667085]" role="status">
        正在加载简历...
      </view>
      <view v-else-if="failed" class="box-border h-full flex flex-col items-center justify-center px-10 text-center">
        <view class="i-carbon-document-blank mb-4 text-40px text-[#98a2b3]" aria-hidden="true" />
        <text class="text-sm text-[#667085] leading-6" role="alert">{{ failureMessage }}</text>
        <view class="mt-6 max-w-560rpx w-full flex flex-col gap-3">
          <button
            class="plain-button min-h-88rpx w-full rounded-xl border-none bg-brand-blue px-5 text-sm text-white font-600"
            :disabled="loading"
            @tap="loadPreview"
          >
            重新加载
          </button>
          <!-- #ifdef H5 -->
          <button
            v-if="attachmentUrl"
            class="plain-button min-h-88rpx w-full border-2rpx border-[#d0d5dd] rounded-xl border-solid bg-white px-5 text-sm text-[#344054] font-600"
            :disabled="downloading"
            :loading="downloading"
            @tap="downloadOriginal"
          >
            下载原文件
          </button>
          <!-- #endif -->
        </view>
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <web-view v-if="!loading && !failed && previewUrl" class="h-full w-full" :src="previewUrl" />
      <!-- #endif -->
      <!-- #ifdef H5 -->
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
