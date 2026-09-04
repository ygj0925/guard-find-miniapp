<script setup lang="ts">
import { aiHeaderMetrics } from '../aiLayout'

withDefaults(defineProps<{
  showHistory?: boolean
  showNewChat?: boolean
}>(), {
  showHistory: true,
  showNewChat: true,
})

const emit = defineEmits<{
  'history': []
  'new-chat': []
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
    <view class="header-left">
      <view class="brand-logo" role="button" aria-label="返回首页" @tap="goHome">
        <view class="brand-mark">
          <view class="brand-dot brand-dot-left" />
          <view class="brand-dot brand-dot-right" />
          <view class="brand-body" />
        </view>
      </view>
      <view class="back-button" role="button" aria-label="返回首页" @tap="goHome">
        <view class="i-carbon-chevron-left back-icon" />
        <text>返回</text>
      </view>
    </view>

    <view class="header-actions">
      <view v-if="showNewChat" class="new-chat-button" role="button" aria-label="新建对话" @tap="emit('new-chat')">
        <view class="i-carbon-add-alt" />
      </view>
      <view v-if="showHistory" class="history-button" role="button" aria-label="查看历史对话" @tap="emit('history')">
        <view class="i-carbon-time history-icon" />
        <text>历史</text>
      </view>
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
  padding-left: 24rpx;
}

.header-left,
.header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.header-left {
  gap: 8rpx;
}

.header-actions {
  gap: 10rpx;
  margin-left: auto;
}

.brand-logo {
  width: 64rpx;
  height: 64rpx;
  flex: 0 0 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-mark {
  position: relative;
  width: 54rpx;
  height: 54rpx;
}

.brand-dot {
  position: absolute;
  top: 2rpx;
  width: 17rpx;
  height: 17rpx;
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
  height: 36rpx;
  border-radius: 25rpx 25rpx 18rpx 18rpx;
  background: linear-gradient(135deg, #0879ff 12%, #13b8ed 55%, #4de3ba 100%);
  transform: rotate(3deg);
}

.brand-body::after {
  position: absolute;
  top: 7rpx;
  left: 16rpx;
  width: 15rpx;
  height: 21rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  content: '';
}

.back-button,
.new-chat-button,
.history-button {
  box-sizing: border-box;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(127, 155, 211, 0.18);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 5rpx 16rpx rgba(71, 100, 162, 0.08);
  color: #29354b;
  line-height: 1;
  transition:
    transform 0.18s ease,
    background-color 0.18s ease;
}

.back-button:active,
.new-chat-button:active,
.history-button:active {
  background: #eef4ff;
  transform: scale(0.96);
}

.back-button {
  gap: 3rpx;
  padding: 0 18rpx 0 10rpx;
  border-radius: 30rpx;
  font-size: 27rpx;
  font-weight: 500;
}

.back-icon {
  color: #5b86e6;
  font-size: 30rpx;
}

.new-chat-button {
  width: 60rpx;
  flex: 0 0 60rpx;
  border-radius: 50%;
  color: #4a78dc;
  font-size: 30rpx;
}

.history-button {
  min-width: 112rpx;
  gap: 8rpx;
  padding: 0 18rpx;
  border-radius: 30rpx;
  font-size: 26rpx;
  font-weight: 500;
  white-space: nowrap;
}

.history-icon {
  color: #5b86e6;
  font-size: 27rpx;
}

@media (prefers-reduced-motion: reduce) {
  .back-button,
  .new-chat-button,
  .history-button {
    transition: none;
  }
}
</style>
