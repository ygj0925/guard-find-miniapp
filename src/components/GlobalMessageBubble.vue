<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { ApplyProgressData, OfferConfirmData, PreOnboardData } from '@/api/message'
import { useMessageStore } from '@/store/message'
import type { PushedMessage } from '@/store/message'

const messageStore = useMessageStore()
const { latestMessage } = storeToRefs(messageStore)

const visible = ref(false)
const current = ref<PushedMessage | null>(null)
/** 用于重启 progress bar 动画：每次新消息进来递增 */
const animKey = ref(0)
let dismissTimer: ReturnType<typeof setTimeout> | null = null

let statusBarHeight = 0
try {
  statusBarHeight = uni.getWindowInfo?.().statusBarHeight ?? uni.getSystemInfoSync().statusBarHeight ?? 0
}
catch {}

interface BizMeta {
  iconClass: string
  surfaceClass: string
  accentColor: string
}

const bizMetaMap: Record<string, BizMeta> = {
  APPLY_PROGRESS: { iconClass: 'i-carbon-task-complete', surfaceClass: 'bg-[#F3EEFF] text-brand-violet', accentColor: '#9b59f6' },
  OFFER_CONFIRM: { iconClass: 'i-carbon-certificate', surfaceClass: 'bg-[#FFF3E8] text-[#f57c00]', accentColor: '#f57c00' },
  PRE_ONBOARD: { iconClass: 'i-carbon-document-add', surfaceClass: 'bg-[#E8F5E9] text-[#2e7d32]', accentColor: '#2e7d32' },
}
const DEFAULT_BIZ_META: BizMeta = { iconClass: 'i-carbon-notification-filled', surfaceClass: 'bg-[#EAF1FF] text-app-info', accentColor: '#3974f6' }

function metaOf(msg: PushedMessage): BizMeta {
  return msg.bizType ? (bizMetaMap[msg.bizType] ?? DEFAULT_BIZ_META) : DEFAULT_BIZ_META
}

function subtitleOf(msg: PushedMessage): string {
  if (!msg.bizType || !msg.data)
    return ''
  switch (msg.bizType) {
    case 'APPLY_PROGRESS': {
      const d = msg.data as ApplyProgressData
      return `${d.positionName} · ${d.statusName}`
    }
    case 'OFFER_CONFIRM': {
      const d = msg.data as OfferConfirmData
      return `${d.positionName} · ${d.deadline} 前确认`
    }
    case 'PRE_ONBOARD': {
      const d = msg.data as PreOnboardData
      return `${d.positionName} · ${d.onboardDate} 报到`
    }
    default:
      return ''
  }
}

function clearDismissTimer() {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
}

function dismiss() {
  visible.value = false
  clearDismissTimer()
  setTimeout(() => {
    current.value = null
    messageStore.consumeLatestMessage()
  }, 340)
}

function handleTap() {
  const path = current.value?.path
  dismiss()
  if (path)
    setTimeout(() => uni.navigateTo({ url: path }), 80)
}

function handleClose() {
  dismiss()
}

watch(latestMessage, (msg) => {
  if (!msg)
    return
  current.value = msg
  animKey.value += 1
  visible.value = true
  clearDismissTimer()
  dismissTimer = setTimeout(() => dismiss(), 5000)
})

onUnmounted(() => clearDismissTimer())
</script>

<template>
  <view
    v-if="current"
    class="bubble fixed left-3 right-3 overflow-hidden rounded-[18px] bg-white"
    :class="visible ? 'bubble--in' : 'bubble--out'"
    :style="{ top: `${statusBarHeight + 10}px`, zIndex: 9999 }"
    @tap="handleTap"
  >
    <!-- 左侧色条 -->
    <view
      class="absolute bottom-0 left-0 top-0 w-[3px]"
      :style="{ background: current ? metaOf(current).accentColor : 'transparent' }"
    />

    <view class="flex items-center gap-3 py-3 pl-4 pr-3">
      <!-- 图标 -->
      <view
        class="h-[42px] w-[42px] flex-shrink-0 flex items-center justify-center rounded-[12px] text-xl leading-none"
        :class="metaOf(current).surfaceClass"
      >
        <view :class="metaOf(current).iconClass" />
      </view>

      <!-- 文字 -->
      <view class="min-w-0 flex-1">
        <text class="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#1a1a1a] font-700 leading-[1.35]">
          {{ current.title }}
        </text>
        <text
          v-if="subtitleOf(current)"
          class="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#888] leading-[1.4]"
        >
          {{ subtitleOf(current) }}
        </text>
      </view>

      <!-- 关闭按钮 -->
      <view
        class="h-8 w-8 flex-shrink-0 flex items-center justify-center"
        @tap.stop="handleClose"
      >
        <view class="i-carbon-close text-base text-[#bbb]" />
      </view>
    </view>

    <!-- 自动关闭进度条 -->
    <view
      :key="animKey"
      class="h-[2px] w-full bubble__progress"
      :style="{ background: current ? metaOf(current).accentColor : 'transparent', opacity: 0.4 }"
    />
  </view>
</template>

<style scoped>
.bubble {
  box-shadow: 0 12rpx 48rpx rgba(0, 0, 0, 0.16);
  transition:
    transform 340ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 280ms cubic-bezier(0.32, 0.72, 0, 1);
  transform-origin: top center;
}

.bubble--in {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.bubble--out {
  transform: translateY(-120%) scale(0.94);
  opacity: 0;
}

.bubble__progress {
  transform-origin: left center;
  animation: bubble-countdown 5s linear forwards;
}

@keyframes bubble-countdown {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .bubble {
    transition: opacity 200ms;
  }

  .bubble--out {
    transform: none;
    opacity: 0;
  }

  .bubble__progress {
    animation: none;
  }
}
</style>
