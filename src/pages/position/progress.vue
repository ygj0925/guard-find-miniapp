<script setup lang="ts">
import { computed, ref } from 'vue'
import { getPositionApplyProgress } from '@/api/position'
import type { PositionApplyProgress } from '@/api/position'
import AppPageHeader from '@/components/AppPageHeader.vue'

defineOptions({
  name: 'PositionApplyProgress',
})

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '投递进度',
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F5F7FA',
  },
})

const progress = ref<PositionApplyProgress>()
const isLoading = ref(true)
const applyRecordId = ref('')
const hasProgress = computed(() => Boolean(progress.value?.progressList.length))
const importStatus = computed(() => String(progress.value?.apply.importStatus || '').toUpperCase())
const isProcessing = computed(() => importStatus.value === 'PROCESSING')
const isFailed = computed(() => importStatus.value === 'FAILED')
const currentProgress = computed(() => progress.value?.progressList[0] || progress.value?.apply)
const statusLabel = computed(() => {
  if (isProcessing.value)
    return '投递处理中'
  if (isFailed.value)
    return '投递失败'
  if (importStatus.value === 'SUCCESS')
    return '投递成功'
  return '投递状态'
})

async function loadProgress() {
  if (!applyRecordId.value)
    return
  isLoading.value = true
  try {
    progress.value = await getPositionApplyProgress(applyRecordId.value)
  }
  catch {
    progress.value = undefined
  }
  finally {
    isLoading.value = false
  }
}

function handleBack() {
  uni.navigateBack()
}

onLoad(async (options) => {
  applyRecordId.value = String(options?.id ?? '').trim()
  if (!applyRecordId.value) {
    isLoading.value = false
    uni.showToast({ title: '投递记录不存在', icon: 'none' })
    return
  }

  await loadProgress()
})
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-app-surface text-app-ink">
    <AppPageHeader title="投递进度" background="#ffffff" scrolled-background="#ffffff">
      <template #left>
        <button class="plain-button h-12 w-12 flex items-center justify-center border-0 rounded-full bg-transparent p-0 text-xl text-app-ink active:bg-[#eef4ff]" aria-label="返回" @tap="handleBack">
          <view class="i-carbon-chevron-left" />
        </button>
      </template>
    </AppPageHeader>

    <view v-if="isLoading" class="flex items-center justify-center py-24 text-sm text-app-muted">
      <view class="loading-spinner mr-2 h-5 w-5 border-2 border-[#bdd1ef] border-t-brand-blue rounded-full" />
      <text>正在加载投递进度</text>
    </view>

    <view v-else-if="progress" class="px-4 py-4">
      <view class="rounded-xl bg-white px-4 py-5 shadow-[0_8rpx_24rpx_rgba(38,64,105,0.05)]">
        <view class="flex items-center justify-between gap-3">
          <text class="block min-w-0 flex-1 text-lg text-app-ink font-700">{{ progress.apply.jobTitle || '职位投递' }}</text>
          <text
            class="flex-none rounded-full px-3 py-1 text-xs font-600"
            :class="isFailed ? 'bg-[#fff1f0] text-[#d6453d]' : isProcessing ? 'bg-[#fff7e6] text-[#c77b16]' : 'bg-[#edf8f1] text-[#2f8f55]'"
          >
            {{ statusLabel }}
          </text>
        </view>
        <text v-if="progress.apply.failedReason" class="mt-2 block text-sm text-[#d6453d]">
          {{ progress.apply.failedReason }}
        </text>
        <text v-else-if="currentProgress" class="mt-2 block text-sm text-app-ink-soft">
          当前进度：{{ currentProgress.phaseName || currentProgress.processName || (isProcessing ? '等待招聘系统确认' : '处理中') }}{{ currentProgress.statusName ? `（${currentProgress.statusName}）` : '' }}
        </text>
        <text v-if="isProcessing" class="mt-2 block text-xs text-app-muted">投递已提交，系统正在等待招聘平台返回结果</text>
      </view>

      <view class="mt-3 rounded-xl bg-white px-5 py-6 shadow-[0_8rpx_24rpx_rgba(38,64,105,0.05)]">
        <view v-if="hasProgress" class="relative">
          <view v-for="(item, index) in progress.progressList" :key="`${item.createTime}-${index}`" class="relative flex pb-7 last:pb-0">
            <view class="relative z-1 mt-1 h-4 w-4 flex flex-none items-center justify-center rounded-full" :class="index === 0 ? 'bg-brand-blue' : 'bg-[#d6dee9]'">
              <view v-if="index === 0" class="h-1.5 w-1.5 rounded-full bg-white" />
            </view>
            <view v-if="index < progress.progressList.length - 1" class="absolute bottom-0 left-[7rpx] top-5 w-px bg-[#dce3ec]" />
            <view class="ml-3 min-w-0 flex-1">
              <text class="block text-base text-app-ink font-600">{{ item.phaseName || item.processName || '投递进度更新' }}</text>
              <text v-if="item.statusName" class="mt-1 block text-sm text-brand-blue">{{ item.statusName }}</text>
              <text v-if="item.createTime" class="mt-1 block text-xs text-app-muted">{{ item.createTime }}</text>
            </view>
          </view>
        </view>
        <view v-else class="py-8 text-center">
          <view class="i-carbon-time mx-auto text-4xl text-[#b7c2d0]" />
          <text class="mt-3 block text-base text-app-ink">暂未更新进度</text>
          <text class="mt-1 block text-sm text-app-muted">招聘团队处理后会同步最新状态</text>
        </view>
      </view>
    </view>

    <view v-else class="py-24 text-center">
      <view class="i-carbon-warning-alt mx-auto text-4xl text-[#b7c2d0]" />
      <text class="mt-3 block text-base text-app-ink">投递进度加载失败</text>
    </view>
  </view>
</template>

<style scoped>
.plain-button::after {
  border: 0;
}

.loading-spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
