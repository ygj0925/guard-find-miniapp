<script setup lang="ts">
import { reactive, ref } from 'vue'
import { getPositionShareList } from '@/api/position'
import type { PositionListItem } from '@/api/position'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { formatPositionSalary } from '@/utils/positionSalary'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '分享列表',
    backgroundColor: '#f5f7fa',
  },
})

const positions = ref<PositionListItem[]>([])
const isLoading = ref(true)
const isError = ref(false)
const publisherAvatarErrors = reactive<Record<string, boolean>>({})

function publisherAvatarUrl(job: PositionListItem) {
  const avatar = job.publisherAvatar?.trim()
  return avatar && !publisherAvatarErrors[job.positionId] ? avatar : ''
}

function handlePublisherAvatarError(positionId: string) {
  publisherAvatarErrors[positionId] = true
}

function handleBack() {
  uni.switchTab({ url: '/pages/index/index' })
}

function handleTapPosition(positionId: string) {
  uni.navigateTo({ url: `/pages/position/detail?id=${encodeURIComponent(positionId)}` })
}

async function load(shareId: string) {
  isLoading.value = true
  isError.value = false
  try {
    positions.value = await getPositionShareList(shareId)
  }
  catch {
    isError.value = true
  }
  finally {
    isLoading.value = false
  }
}

onLoad(async (options) => {
  // shareId 为空时直接跳转到职位详情页
  if (!options?.shareId) {
    if (options?.id) {
      uni.redirectTo({ url: `/pages/position/detail?id=${encodeURIComponent(options.id)}` })
    }
    isLoading.value = false
    return
  }

  // 保存 shareId 到本地，以逗号拼接方式累积
  const existing = uni.getStorageSync('shareIds')
  uni.setStorageSync('shareIds', existing ? `${existing},${options.shareId}` : options.shareId)

  // 调用分享列表接口
  await load(options.shareId)
})
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-[#f5f7fa]">
    <AppPageHeader title="分享列表" background="#f5f7fa" scrolled-background="#f5f7fa">
      <template #left>
        <button
          class="plain-button h-12 w-12 flex cursor-pointer items-center justify-center border-0 rounded-full bg-transparent p-0 text-xl text-[#17233d] leading-none active:bg-[rgba(0,0,0,0.06)]"
          aria-label="返回首页"
          @tap="handleBack"
        >
          <view class="i-carbon-chevron-left" />
        </button>
      </template>
    </AppPageHeader>

    <!-- 骨架屏 -->
    <view v-if="isLoading" class="px-3 pt-3">
      <view v-for="i in 4" :key="i" class="mb-3 rounded-2xl bg-white px-4 py-4">
        <view class="flex items-start justify-between gap-3">
          <view class="skeleton-block h-5 w-3/5 rounded" />
          <view class="skeleton-block h-5 w-14 rounded" />
        </view>
        <view class="mt-2.5 flex gap-1.5">
          <view class="skeleton-block h-5 w-16 rounded" />
          <view class="skeleton-block h-5 w-12 rounded" />
          <view class="skeleton-block h-5 w-12 rounded" />
        </view>
        <view class="mt-3 flex items-center justify-between border-t-1rpx border-t-[#f1f3f6] border-t-solid pt-3">
          <view class="skeleton-block h-4 w-28 rounded" />
          <view class="skeleton-block h-4 w-16 rounded" />
        </view>
      </view>
    </view>

    <!-- 错误状态 -->
    <view v-else-if="isError" class="flex flex-col items-center justify-center px-8 py-24">
      <view class="i-carbon-warning mb-4 text-6xl text-[#dce3f0]" />
      <text class="text-base text-[#1a2640] font-700">加载失败</text>
      <button
        class="plain-button mt-4 h-10 border border-[#dce2ea] rounded-xl border-solid bg-white px-5 text-sm text-[#4b5565] font-600"
        @tap="() => load('')"
      >
        重新加载
      </button>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!positions.length" class="flex flex-col items-center justify-center px-8 py-24">
      <view class="i-carbon-document mb-4 text-6xl text-[#dce3f0]" />
      <text class="text-base text-[#1a2640] font-700">暂无职位</text>
      <text class="mt-2 block text-center text-sm text-[#9aa5b5] leading-[1.6]">该分享链接中暂无职位信息</text>
    </view>

    <!-- 职位列表 -->
    <view v-else class="px-3 pb-6 pt-3">
      <view class="flex flex-col gap-3">
        <view
          v-for="job in positions"
          :key="job.positionId"
          class="cursor-pointer rounded-2xl bg-white px-4 py-4 shadow-[0_8rpx_24rpx_rgba(38,64,105,0.05)] active:opacity-74"
          role="button"
          @tap="handleTapPosition(job.positionId)"
        >
          <view class="flex items-start justify-between gap-3">
            <text class="min-w-0 flex-1 text-base text-app-ink font-700 leading-[1.35]">{{ job.positionName }}</text>
            <text class="flex-none text-sm text-brand-blue font-700">{{ formatPositionSalary(job) }}</text>
          </view>
          <view v-if="[job.location, job.edu, job.experience].some(Boolean)" class="mt-2.5 flex flex-wrap gap-1.5">
            <text
              v-for="meta in [job.location, job.edu, job.experience].filter(Boolean)"
              :key="meta"
              class="rounded-10rpx bg-[#f1f5fb] px-2 py-1 text-2xs text-app-ink-soft"
            >
              {{ meta }}
            </text>
          </view>
          <view v-if="job.tags?.some(Boolean)" class="mt-3 flex flex-wrap gap-2">
            <text v-for="tag in job.tags.filter(Boolean)" :key="tag" class="rounded-lg bg-[#f2f4f7] px-2 py-1 text-xs text-app-ink-soft">{{ tag }}</text>
          </view>
          <view class="mt-3 flex items-center justify-between border-t-1rpx border-t-[#f1f3f6] border-t-solid pt-3">
            <view class="min-w-0 flex items-center">
              <template v-if="job.publisherName || job.publisherAvatar">
                <image
                  v-if="publisherAvatarUrl(job)"
                  class="h-42rpx w-42rpx flex-none rounded-full"
                  :src="publisherAvatarUrl(job)"
                  mode="aspectFill"
                  alt=""
                  @error="handlePublisherAvatarError(job.positionId)"
                />
                <view v-else class="h-42rpx w-42rpx flex flex-none items-center justify-center rounded-full bg-[#e9f3ff] text-sm text-brand-blue leading-none">
                  <view class="i-carbon-user-avatar" />
                </view>
                <text class="ml-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-app-ink-soft">
                  {{ job.publisherName }}
                </text>
              </template>
              <template v-else>
                <view class="h-42rpx w-42rpx flex flex-none items-center justify-center rounded-full bg-[#e9f3ff] text-sm text-brand-blue leading-none">
                  <view class="i-carbon-user-avatar" />
                </view>
                <text class="ml-2 text-xs text-app-ink-soft">招聘团队 · 简历直投</text>
              </template>
            </view>
            <text class="ml-3 flex-none text-xs text-app-muted">{{ job.location }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.plain-button::after {
  border: 0;
}

.skeleton-block {
  background: linear-gradient(90deg, #edf1f6 25%, #f7f9fc 42%, #edf1f6 64%);
  background-size: 300% 100%;
  animation: skeleton-shimmer 1.3s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-block {
    animation: none;
  }
}
</style>
