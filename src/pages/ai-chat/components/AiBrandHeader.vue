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
  uni.navigateBack({
    delta: 1,
    fail: () => uni.switchTab({ url: '/pages/index/index' }),
  })
}
</script>

<template>
  <view class="ai-brand-header" :style="headerStyle">
    <view class="header-left">
      <view class="brand-logo" role="button" aria-label="返回首页" @tap="goHome">
        <image
          class="brand-logo-image"
          src="https://static1.3sbio.com/assets/lingcai/%E5%9B%BE%E6%A0%87.png"
          mode="aspectFill"
          aria-hidden="true"
        />
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

.brand-logo-image {
  width: 60rpx;
  height: 60rpx;
  overflow: hidden;
  border-radius: 50%;
  box-shadow: 0 4rpx 14rpx rgba(45, 111, 230, 0.16);
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
