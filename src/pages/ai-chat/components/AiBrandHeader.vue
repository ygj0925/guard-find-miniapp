<script setup lang="ts">
import { aiHeaderMetrics } from '../aiLayout'

withDefaults(defineProps<{
  showHistory?: boolean
}>(), {
  showHistory: true,
})

const emit = defineEmits<{
  history: []
}>()

const headerStyle = {
  height: `${aiHeaderMetrics.height}px`,
  paddingTop: `${aiHeaderMetrics.statusBarHeight}px`,
  paddingRight: `${aiHeaderMetrics.rightPadding}px`,
}

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="ai-brand-header" :style="headerStyle">
    <view class="brand" @tap="goHome">
      <view class="brand-mark">
        <view class="brand-dot brand-dot-left" />
        <view class="brand-dot brand-dot-right" />
        <view class="brand-body" />
      </view>
      <text class="brand-name">麟才寻你</text>
    </view>

    <view v-if="showHistory" class="history-button" @tap="emit('history')">
      历史对话
    </view>
  </view>
</template>

<style scoped lang="scss">
.ai-brand-header {
  position: relative;
  z-index: 5;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding-left: 32rpx;
}

.brand {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.brand-name {
  color: var(--app-ink);
  font-size: 36rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
  white-space: nowrap;
}

.brand-mark {
  position: relative;
  width: 56rpx;
  height: 56rpx;
}

.brand-dot {
  position: absolute;
  top: 2rpx;
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
}

.brand-dot-left {
  left: 5rpx;
  background: var(--app-brand-sky);
}

.brand-dot-right {
  right: 5rpx;
  background: var(--app-brand-mint);
}

.brand-body {
  position: absolute;
  right: 5rpx;
  bottom: 2rpx;
  left: 5rpx;
  height: 37rpx;
  border-radius: 25rpx 25rpx 18rpx 18rpx;
  background: linear-gradient(135deg, #0879ff 12%, #13b8ed 55%, #4de3ba 100%);
  transform: rotate(3deg);
}

.brand-body::after {
  position: absolute;
  top: 7rpx;
  left: 17rpx;
  width: 16rpx;
  height: 22rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  content: '';
}

.history-button {
  margin-left: 24rpx;
  padding: 10rpx 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 8rpx 24rpx rgba(77, 115, 204, 0.08);
  color: var(--app-ink);
  font-size: 28rpx;
  white-space: nowrap;
}
</style>
