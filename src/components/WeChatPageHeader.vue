<script setup lang="ts">
import { onMounted, ref } from 'vue'

declare const wx: {
  getMenuButtonBoundingClientRect: () => { width: number, height: number, top: number, right: number }
}

withDefaults(defineProps<{
  title: string
  subtitle?: string
  showBack?: boolean
  transparent?: boolean
}>(), {
  subtitle: '',
  showBack: true,
  transparent: false,
})

const capsuleSpace = ref(94)

onMounted(() => {
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined') {
    const menu = wx.getMenuButtonBoundingClientRect()
    if (menu.width > 0)
      capsuleSpace.value = menu.width + 24
  }
  // #endif
})

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="wechat-header" :class="{ 'wechat-header-transparent': transparent }">
    <view class="wechat-header-safe" />
    <view class="wechat-header-row" :style="{ '--wechat-capsule-space': `${capsuleSpace}px` }">
      <button v-if="showBack" class="wechat-header-back app-tap" aria-label="返回" @tap="goBack">
        <view class="i-carbon-arrow-left text-5" aria-hidden="true" />
      </button>
      <view class="wechat-header-copy" :class="{ 'wechat-header-copy-offset': showBack }">
        <text class="wechat-header-title">{{ title }}</text>
        <text v-if="subtitle" class="wechat-header-subtitle">{{ subtitle }}</text>
      </view>
      <view class="wechat-header-capsule-space" aria-hidden="true" />
    </view>
  </view>
</template>

<style scoped>
.wechat-header {
  position: relative;
  z-index: 10;
  background: rgba(245, 248, 255, 0.9);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.wechat-header-transparent {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.wechat-header-safe {
  height: env(safe-area-inset-top);
  min-height: 24px;
}
.wechat-header-row {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 0 16px;
  box-sizing: border-box;
}
.wechat-header-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: 0 4px 0 -8px;
  padding: 0;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.7);
  color: #1f315e;
}
.wechat-header-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}
.wechat-header-copy-offset {
  margin-left: 2px;
}
.wechat-header-title {
  overflow: hidden;
  color: #172753;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wechat-header-subtitle {
  overflow: hidden;
  color: #6d7b9b;
  font-size: 11px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wechat-header-capsule-space {
  width: var(--wechat-capsule-space, 94px);
  min-width: var(--wechat-capsule-space, 94px);
  height: 44px;
}
</style>
