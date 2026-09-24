<script setup lang="ts">
import type { ResumeItem } from '@/api/resume'

defineProps<{
  resumes: ResumeItem[]
  selectedResumeId?: string
  loading: boolean
  uploading: boolean
  selecting: boolean
  error: boolean
  safeBottom: number
}>()

defineEmits<{
  close: []
  retry: []
  select: [resume: ResumeItem]
  upload: []
  send: []
}>()

function resumeIcon(fileType?: string) {
  return String(fileType || '').replace(/^\./, '').toLowerCase() === 'pdf'
    ? { label: 'PDF', bg: 'bg-[#e84040]' }
    : { label: 'DOC', bg: 'bg-[#2b5fd9]' }
}
</script>

<template>
  <view class="fixed inset-0 z-200 flex items-end bg-black/42" @tap="$emit('close')">
    <view
      class="max-h-[78vh] w-full overflow-hidden rounded-t-[28rpx] bg-white shadow-[0_-18rpx_56rpx_rgba(26,48,86,0.16)]"
      :style="{ paddingBottom: `${safeBottom}px` }"
      @tap.stop
    >
      <view class="mx-auto mt-2.5 h-1 w-9 rounded-full bg-[#d7dee8]" />
      <view class="flex items-start justify-between px-5 pb-3 pt-2.5">
        <view class="min-w-0 flex-1 pr-4">
          <text class="block text-base text-app-ink font-700 leading-tight">选择发送简历</text>
          <text class="mt-1 block text-xs text-app-muted leading-relaxed">选择一份附件简历发送给 AI</text>
        </view>
        <button class="plain-button h-10 w-10 flex flex-none items-center justify-center border-0 rounded-full bg-[#f3f5f8] p-0 text-lg text-app-ink-soft active:bg-[#e5eaf1]" aria-label="关闭简历选择" @tap="$emit('close')">
          <text class="text-xl leading-none">×</text>
        </button>
      </view>

      <view class="bg-[#f7f9fc] pt-3">
        <view v-if="loading" class="mx-4 mb-3 flex items-center rounded-xl bg-white px-3.5 py-3.5 shadow-[0_6rpx_18rpx_rgba(36,58,91,0.06)]">
          <view class="skeleton-block h-11 w-11 flex-none rounded-xl" />
          <view class="ml-3 min-w-0 flex-1">
            <view class="skeleton-block h-5 w-2/5 rounded-lg" />
            <view class="skeleton-block mt-2 h-4 w-3/5 rounded-lg" />
          </view>
          <view class="skeleton-block ml-3 h-5.5 w-5.5 flex-none rounded-full" />
        </view>

        <view v-else-if="error" class="mx-4 mb-3 flex flex-col items-center rounded-xl bg-white px-6 py-7 text-center">
          <text class="text-sm text-app-ink-soft">简历加载失败</text>
          <button class="plain-button mt-4 h-11 border border-[#dce2ea] rounded-xl border-solid bg-white px-5 text-xs text-brand-blue font-650" @tap="$emit('retry')">
            重新加载
          </button>
        </view>

        <scroll-view v-else-if="resumes.length" scroll-y class="box-border max-h-[40vh] w-full px-4" role="radiogroup" aria-label="可发送简历">
          <view
            v-for="resume in resumes"
            :key="resume.id"
            class="mb-2.5 flex cursor-pointer items-center border rounded-xl border-solid px-3.5 py-3.5 active:scale-[0.99]"
            :class="selectedResumeId === resume.id
              ? 'border-[rgba(45,111,230,0.45)] bg-white shadow-[0_8rpx_22rpx_rgba(45,111,230,0.11)]'
              : 'border-[#edf0f4] bg-white shadow-[0_4rpx_14rpx_rgba(36,58,91,0.05)]'"
            role="radio"
            :aria-checked="selectedResumeId === resume.id"
            :aria-label="`选择简历 ${resume.name}`"
            @tap="$emit('select', resume)"
          >
            <view class="h-11 w-11 flex flex-none items-center justify-center rounded-xl text-white" :class="resumeIcon(resume.fileType).bg">
              <text class="text-xs font-700">{{ resumeIcon(resume.fileType).label }}</text>
            </view>
            <view class="ml-3 min-w-0 flex-1">
              <view class="flex items-center gap-2">
                <text class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-app-ink font-650">{{ resume.name }}</text>
                <text v-if="resume.isDefault" class="flex-none rounded-md bg-[#e8f1ff] px-2 py-0.5 text-3xs text-brand-blue font-600">默认</text>
              </view>
              <view class="mt-1 flex items-center text-2xs text-app-muted">
                <text class="overflow-hidden text-ellipsis whitespace-nowrap">上传于 {{ resume.uploadedAt }}</text>
              </view>
            </view>
            <view
              class="ml-3 h-5.5 w-5.5 flex flex-none items-center justify-center border-2 rounded-full"
              :class="selectedResumeId === resume.id ? 'border-brand-blue bg-brand-blue text-white' : 'border-[#cbd5e1] bg-white'"
            >
              <text v-if="selectedResumeId === resume.id" class="text-xs leading-none">✓</text>
            </view>
          </view>
        </scroll-view>

        <view v-else class="mx-4 mb-3 flex flex-col items-center border border-[#edf0f4] rounded-xl border-solid bg-white px-6 py-7 text-center shadow-[0_4rpx_14rpx_rgba(36,58,91,0.05)]">
          <view class="h-12 w-12 flex items-center justify-center rounded-xl bg-[#edf4ff] text-2xl text-brand-blue">
            <text class="text-2xl leading-none">＋</text>
          </view>
          <text class="mt-3 block text-sm text-app-ink font-650">还没有附件简历</text>
          <text class="mt-1 block text-xs text-app-muted leading-relaxed">上传一份简历即可发送给 AI</text>
        </view>

        <button
          v-if="!loading && !error"
          class="plain-button mx-4 mb-3 h-11 flex items-center justify-center border border-[rgba(45,111,230,0.2)] rounded-xl border-solid bg-[#edf4ff] px-5 text-xs text-brand-blue font-650 active:bg-[#dce9ff] disabled:opacity-45"
          :disabled="uploading || selecting"
          @tap="$emit('upload')"
        >
          <text class="mr-2 text-base leading-none">↑</text>
          <text>{{ uploading ? '上传中…' : '上传新简历' }}</text>
        </button>
      </view>

      <view class="flex items-center gap-3 border-t border-[#e7ebf1] bg-white px-4 py-3">
        <button class="plain-button h-12 w-24 flex flex-none items-center justify-center border border-[#dce2ea] rounded-xl border-solid bg-white text-sm text-app-ink-soft font-600 active:bg-[#f1f4f8]" @tap="$emit('close')">
          取消
        </button>
        <button
          class="plain-button h-12 min-w-0 flex flex-1 items-center justify-center border-0 rounded-xl bg-brand-blue px-4 text-sm text-white font-700 shadow-[0_8rpx_20rpx_rgba(45,111,230,0.2)] active:scale-[0.99] disabled:bg-[#9bb8e8] disabled:shadow-none"
          :disabled="!selectedResumeId || loading || uploading || selecting || error"
          @tap="$emit('send')"
        >
          <text class="mr-2 text-lg leading-none">↑</text>
          <text>发送给 AI</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.plain-button::after {
  border: 0;
}
.skeleton-block {
  background: linear-gradient(90deg, #edf1f7 25%, #f6f8fb 50%, #edf1f7 75%);
  background-size: 200% 100%;
  animation: loading 1.4s ease-in-out infinite;
}
@keyframes loading {
  to {
    background-position-x: -200%;
  }
}
</style>
