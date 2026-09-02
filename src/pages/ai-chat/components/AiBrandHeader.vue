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
    <view class="header-left">
      <view class="brand-logo" @tap="goHome">
        <view class="brand-mark">
          <view class="brand-dot brand-dot-left" />
          <view class="brand-dot brand-dot-right" />
          <view class="brand-body" />
        </view>
      </view>
      <view class="back-button" @tap="goHome">
        <view class="back-icon" />
        <text>返回</text>
      </view>
    </view>

    <view v-if="showHistory" class="history-button" @tap="emit('history')">
      <text>历史对话</text>
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

.header-left {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12rpx;
}

.brand-logo {
  width: 68rpx;
  height: 68rpx;
  flex: 0 0 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
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

.back-button {
  box-sizing: border-box;
  height: 58rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 0 20rpx 0 16rpx;
  border-radius: 29rpx;
  background: #fff;
  color: #222938;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.back-icon {
  box-sizing: border-box;
  width: 20rpx;
  height: 20rpx;
  border-bottom: 4rpx solid #5c88eb;
  border-left: 4rpx solid #5c88eb;
  transform: rotate(45deg);
}

.history-button {
  box-sizing: border-box;
  width: 152rpx;
  height: 58rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  border-radius: 29rpx;
  background: #fff;
  color: #222938;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
</style>
