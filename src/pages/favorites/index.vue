<script setup lang="ts">
import { computed, ref } from 'vue'
import { getPositionShares } from '@/api/position'
import type { PositionShareItem } from '@/api/position'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { formatPositionSalary } from '@/utils/positionSalary'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的分享',
    backgroundColor: '#f5f7fa',
  },
})

const DETAIL_PATH = '/pages/position/detail'
const PAGE_SIZE = 100

const shareList = ref<PositionShareItem[]>([])
const isLoading = ref(true)
const isLoadingMore = ref(false)
const isError = ref(false)
const total = ref(0)
const pageNum = ref(0)
const hasMore = computed(() => shareList.value.length < total.value)

function formatDate(dateStr: string) {
  if (!dateStr)
    return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime()))
    return dateStr
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}月${day}日 ${h}:${min}`
}

function handleBack() {
  if (getCurrentPages().length > 1)
    uni.navigateBack()
  else
    uni.switchTab({ url: '/pages/me/me' })
}

function handleTapPosition(positionId: string) {
  uni.navigateTo({ url: `${DETAIL_PATH}?id=${encodeURIComponent(positionId)}` })
}

async function load(reset = false) {
  if (!reset && (isLoadingMore.value || !hasMore.value))
    return

  if (reset) {
    isLoading.value = true
    isError.value = false
    shareList.value = []
    total.value = 0
    pageNum.value = 0
  }
  else {
    isLoadingMore.value = true
  }

  const nextPage = reset ? 1 : pageNum.value + 1
  try {
    const res = await getPositionShares({ pageNum: nextPage, pageSize: PAGE_SIZE })
    shareList.value = reset ? (res?.list ?? []) : [...shareList.value, ...(res?.list ?? [])]
    total.value = res?.total ?? 0
    pageNum.value = nextPage
  }
  catch {
    if (reset)
      isError.value = true
  }
  finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

onLoad(async () => {
  await load(true)
  // 首屏内容不足以滚动时，自动加载下一页确保 onReachBottom 可触发
  if (hasMore.value)
    load()
})

onReachBottom(() => load())
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-[#f5f7fa]">
    <AppPageHeader title="我的分享" background="#f5f7fa" scrolled-background="#f5f7fa">
      <template #left>
        <button
          class="plain-button h-12 w-12 flex cursor-pointer items-center justify-center border-0 rounded-full bg-transparent p-0 text-xl text-[#17233d] leading-none active:bg-[rgba(0,0,0,0.06)]"
          aria-label="返回"
          @tap="handleBack"
        >
          <view class="i-carbon-chevron-left" />
        </button>
      </template>
    </AppPageHeader>

    <!-- 骨架屏 -->
    <view v-if="isLoading" class="px-4 pt-2">
      <view v-for="i in 3" :key="i">
        <view class="mb-3 mt-4 rounded-2xl bg-white px-4 py-4">
          <view class="flex items-start justify-between gap-3">
            <view class="skeleton-block h-5 w-3/5 rounded" />
            <view class="skeleton-block h-5 w-14 rounded" />
          </view>
          <view class="mt-2.5 flex gap-1.5">
            <view class="skeleton-block h-5 w-16 rounded" />
            <view class="skeleton-block h-5 w-12 rounded" />
          </view>
          <view class="mt-3 flex items-center justify-between border-t-1rpx border-t-[#f0f4fa] border-t-solid pt-3">
            <view class="skeleton-block h-5 w-24 rounded" />
            <view class="skeleton-block h-5 w-16 rounded" />
          </view>
        </view>
      </view>
    </view>

    <!-- 错误状态 -->
    <view v-else-if="isError" class="flex flex-col items-center justify-center px-8 py-24">
      <view class="i-carbon-warning mb-4 text-6xl text-[#dce3f0]" />
      <text class="text-base text-[#1a2640] font-700">加载失败</text>
      <button
        class="plain-button mt-4 h-10 border border-[#dce2ea] rounded-xl border-solid bg-white px-5 text-sm text-[#4b5565] font-600"
        @tap="load(true)"
      >
        重新加载
      </button>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!shareList.length" class="flex flex-col items-center justify-center px-8 py-24">
      <view class="i-carbon-share mb-4 text-6xl text-[#dce3f0]" />
      <text class="text-base text-[#1a2640] font-700">暂无分享记录</text>
      <text class="mt-2 block text-center text-sm text-[#9aa5b5] leading-[1.6]">分享感兴趣的职位给好友，记录会在这里展示</text>
    </view>

    <!-- 分享记录列表 -->
    <view v-else class="pb-10 pt-3">
      <text class="mb-3 block px-4 text-xs text-[#b0bac8]">共 {{ total }} 条分享记录</text>
      <view v-for="share in shareList" :key="share.id">
        <!-- 该次分享包含的职位卡片 -->
        <view class="px-4">
          <view
            v-for="job in share.positions"
            :key="job.positionId"
            class="mb-3 overflow-hidden rounded-2xl bg-white px-4 py-4 active:bg-[#f7f9fd]"
            role="button"
            @tap="handleTapPosition(job.positionId)"
          >
            <!-- 职位名 + 薪资/停止招聘 -->
            <view class="flex items-start justify-between gap-3">
              <text class="min-w-0 flex-1 text-base text-app-ink font-700 leading-[1.35]">{{ job.positionName }}</text>
              <text v-if="job.status === '1'" class="flex-none pt-px text-sm text-brand-blue font-700 leading-[1.5]">{{ formatPositionSalary(job) }}</text>
              <text v-else class="flex-none pt-px text-base text-[#999] font-700 leading-[1.35]">停止招聘</text>
            </view>

            <!-- 地点 / 学历 / 经验 标签 -->
            <view v-if="[job.location, job.edu, job.experience].some(Boolean)" class="mt-2.5 flex flex-wrap gap-1.5">
              <text
                v-for="meta in [job.location, job.edu, job.experience].filter(Boolean)"
                :key="meta"
                class="rounded-10rpx bg-[#f1f5fb] px-2 py-1 text-2xs text-app-ink-soft"
              >
                {{ meta }}
              </text>
            </view>

            <!-- 标签 -->
            <view v-if="job.tags?.some(Boolean)" class="mt-3 flex flex-wrap gap-2">
              <text v-for="tag in job.tags.filter(Boolean)" :key="tag" class="rounded-lg bg-[#f2f4f7] px-2 py-1 text-xs text-app-ink-soft">{{ tag }}</text>
            </view>

            <!-- 底部：招聘信息 + 日期 -->
            <view class="mt-3 flex items-center justify-between border-t-1rpx border-t-[#f1f3f6] border-t-solid pt-3">
              <view class="flex items-center text-2xs text-app-muted">
                <view class="i-carbon-building mr-1 text-sm leading-none" />
                <text>三生制药 · 官方直招</text>
              </view>
              <text class="ml-3 text-xs text-app-muted">{{ formatDate(share.createTime) }}</text>
            </view>
          </view>

          <!-- positions 为空时的占位 -->
          <view v-if="!share.positions?.length" class="px-4 py-4">
            <text class="text-sm text-[#b0bac8]">暂无职位信息</text>
          </view>
        </view>
      </view>

      <view v-if="isLoadingMore" class="py-6 text-center text-xs text-[#b0bac8]">
        加载中...
      </view>
      <view v-else-if="shareList.length && !hasMore" class="py-6 text-center text-xs text-[#b0bac8]">
        没有更多记录了
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
