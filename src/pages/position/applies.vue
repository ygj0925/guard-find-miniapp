<script setup lang="ts">
import { computed, ref } from 'vue'
import { getPositionApplies } from '@/api/position'
import type { PositionApplyRecord } from '@/api/position'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { formatPositionSalary } from '@/utils/positionSalary'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '投递记录',
    backgroundColor: '#f5f7fa',
  },
})

const PROGRESS_PATH = '/pages/position/progress'

interface DayGroup {
  dateLabel: string
  records: PositionApplyRecord[]
}

const applies = ref<PositionApplyRecord[]>([])
const isLoading = ref(true)
const isError = ref(false)

const groups = computed<DayGroup[]>(() => {
  const map = new Map<string, PositionApplyRecord[]>()
  for (const r of applies.value) {
    const label = toDayLabel(r.createTime)
    if (!map.has(label))
      map.set(label, [])
    map.get(label)!.push(r)
  }
  return Array.from(map.entries()).map(([dateLabel, records]) => ({ dateLabel, records }))
})

function toDayLabel(dateStr: string) {
  if (!dateStr)
    return '未知日期'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime()))
    return dateStr
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}月${day}日`
}

function toTime(dateStr: string) {
  if (!dateStr)
    return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime()))
    return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function statusColor(statusName: string) {
  if (['已拒绝', '不合适', '失败'].includes(statusName))
    return 'text-[#9aa5b5]'
  if (['已通过', '录用', '已完成'].includes(statusName))
    return 'text-[#16a34a]'
  return 'text-[#9aa5b5]'
}

async function load() {
  isLoading.value = true
  isError.value = false
  try {
    applies.value = await getPositionApplies()
  }
  catch {
    isError.value = true
  }
  finally {
    isLoading.value = false
  }
}

function handleBack() {
  if (getCurrentPages().length > 1)
    uni.navigateBack()
  else
    uni.switchTab({ url: '/pages/me/me' })
}

function handleTapRecord(record: PositionApplyRecord) {
  uni.navigateTo({
    url: `${PROGRESS_PATH}?id=${encodeURIComponent(String(record.id))}`,
  })
}

onLoad(() => load())
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-[#f5f7fa]">
    <AppPageHeader title="投递记录" background="#f5f7fa" scrolled-background="#f5f7fa">
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
        <view class="skeleton-block mb-3 mt-4 h-5 w-20 rounded" />
        <view class="mb-3 rounded-2xl bg-white px-4 py-4">
          <view class="flex items-start justify-between gap-3">
            <view class="skeleton-block h-5 w-3/5 rounded" />
            <view class="skeleton-block h-5 w-14 rounded" />
          </view>
          <view class="skeleton-block mt-3 h-4 w-2/5 rounded" />
          <view class="mt-4 flex items-center justify-between">
            <view class="skeleton-block h-4 w-1/4 rounded" />
            <view class="skeleton-block h-4 w-10 rounded" />
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!applies.length && !isError" class="flex flex-col items-center justify-center px-8 py-24">
      <view class="i-carbon-send-alt mb-4 text-6xl text-[#dce3f0]" />
      <text class="text-base text-[#1a2640] font-700">暂无投递记录</text>
      <text class="mt-2 block text-center text-sm text-[#9aa5b5] leading-[1.6]">投递感兴趣的职位后，记录会在这里展示</text>
      <button
        class="plain-button mt-6 h-10 flex items-center gap-1.5 rounded-xl border-0 bg-brand-blue px-5 text-sm text-white font-600"
        @tap="() => uni.switchTab({ url: '/pages/position/index' })"
      >
        <view class="i-carbon-search text-base leading-none" />
        <text>去找职位</text>
      </button>
    </view>

    <!-- 错误状态 -->
    <view v-else-if="isError" class="flex flex-col items-center justify-center px-8 py-24">
      <view class="i-carbon-warning mb-4 text-6xl text-[#dce3f0]" />
      <text class="text-base text-[#1a2640] font-700">加载失败</text>
      <button
        class="plain-button mt-4 h-10 rounded-xl border border-solid border-[#dce2ea] bg-white px-5 text-sm text-[#4b5565] font-600"
        @tap="load"
      >
        重新加载
      </button>
    </view>

    <!-- 按日期分组的投递记录 -->
    <view v-else class="pb-10 pt-2">
      <view v-for="group in groups" :key="group.dateLabel">
        <!-- 日期标题 -->
        <text class="mx-4 mb-2 mt-4 block text-lg text-[#1a2640] font-700">{{ group.dateLabel }}</text>

        <!-- 当日记录卡片 -->
        <view class="mx-4 overflow-hidden rounded-2xl bg-white">
          <view
            v-for="(record, idx) in group.records"
            :key="record.id"
            class="active:bg-[#f7f9fd]"
            role="button"
            :aria-label="`查看 ${record.positionName || record.jobTitle} 投递进度`"
            @tap="handleTapRecord(record)"
          >
            <!-- 分割线（非首项） -->
            <view v-if="idx > 0" class="mx-4 h-px bg-[#f0f4fa]" />

            <view class="px-4 py-4">
              <!-- 第一行：职位名 + 薪资 -->
              <view class="flex items-start justify-between gap-3">
                <text class="min-w-0 flex-1 text-base text-[#1a2640] font-700 leading-[1.4]">
                  {{ record.positionName || record.jobTitle }}
                </text>
                <text class="flex-none pt-px text-sm text-brand-blue font-700 leading-[1.5]">
                  {{ formatPositionSalary(record) }}
                </text>
              </view>

              <!-- 第二行：流程名称 + 状态 -->
              <view class="mt-1.5 flex items-center justify-between gap-3 text-sm text-[#6b7a8d]">
                <text>{{ record.processName }}</text>
                <text class="flex-none text-xs leading-[1.5]" :class="statusColor(record.statusName)">
                  {{ record.statusName }}
                </text>
              </view>

              <!-- 失败原因 -->
              <view v-if="record.failedReason" class="mt-2 flex items-start gap-1.5 text-xs text-[#ef4444]">
                <view class="i-carbon-warning-alt mt-px flex-none text-sm leading-none" />
                <text class="leading-[1.5]">{{ record.failedReason }}</text>
              </view>

              <!-- 第三行：时间 -->
              <view class="mt-3 flex items-center justify-end">
                <text class="text-xs text-[#b0bac8]">{{ toTime(record.createTime) }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部提示 -->
      <text class="mx-auto mt-6 block px-8 text-center text-xs text-[#b0bac8] leading-[1.6]">
        仅显示最近的投递记录，最多 200 条
      </text>
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
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-block { animation: none; }
}
</style>
