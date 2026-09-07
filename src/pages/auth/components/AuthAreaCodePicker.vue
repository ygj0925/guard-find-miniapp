<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AreaCodeItem } from '../area-code'
import { groupAreaCodes, HOT_AREA_CODES, searchAreaCodes } from '../area-code'

const props = defineProps<{ selectedIso: string }>()
const emit = defineEmits<{
  cancel: []
  select: [area: AreaCodeItem]
}>()

const keyword = ref('')
const scrollTarget = ref('')
const results = computed(() => searchAreaCodes(keyword.value))
const groups = computed(() => groupAreaCodes(results.value))
const letters = computed(() => groups.value.map(group => group.letter))
const searching = computed(() => keyword.value.trim().length > 0)

function scrollToLetter(letter: string) {
  scrollTarget.value = `letter-${letter}`
}

function pick(area: AreaCodeItem) {
  emit('select', area)
}
</script>

<template>
  <view class="picker-mask" @tap.self="emit('cancel')">
    <view class="picker-panel" @tap.stop>
      <view class="picker-head">
        <text class="picker-cancel" @tap="emit('cancel')">取消</text>
        <text class="picker-title">选择国家和地区</text>
        <text class="picker-cancel picker-placeholder">取消</text>
      </view>

      <view class="search-box">
        <text class="search-icon">⌕</text>
        <input v-model="keyword" class="search-input" type="text" confirm-type="search" placeholder="搜索国家/地区或区号" placeholder-class="search-placeholder">
        <text v-if="keyword" class="search-clear" @tap="keyword = ''">✕</text>
      </view>

      <view class="picker-body">
        <scroll-view class="picker-scroll" scroll-y :scroll-into-view="scrollTarget" :scroll-with-animation="false">
          <view v-if="!searching" class="group">
            <view class="group-title">
              常用
            </view>
            <view
              v-for="area in HOT_AREA_CODES" :key="`hot-${area.iso}`" class="area-row"
              :class="{ active: area.iso === props.selectedIso }" @tap="pick(area)"
            >
              <view class="area-name">
                <text class="area-name-primary">{{ area.name }}</text>
              </view>
              <text class="area-code">+{{ area.code }}</text>
            </view>
          </view>

          <view v-for="group in groups" :key="group.letter" class="group">
            <view :id="`letter-${group.letter}`" class="group-title">
              {{ group.letter }}
            </view>
            <view
              v-for="area in group.items" :key="area.iso" class="area-row"
              :class="{ active: area.iso === props.selectedIso }" @tap="pick(area)"
            >
              <view class="area-name">
                <text class="area-name-primary">{{ area.name }}</text>
                <text class="area-en">{{ area.enName }}</text>
              </view>
              <text class="area-code">+{{ area.code }}</text>
            </view>
          </view>

          <view v-if="!results.length" class="empty">
            未找到相关国家或地区
          </view>
          <view class="scroll-tail" />
        </scroll-view>

        <view v-if="!searching" class="index-bar">
          <text v-for="letter in letters" :key="letter" class="index-letter" @tap="scrollToLetter(letter)">{{ letter }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.picker-mask {
  position: fixed;
  z-index: 20;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.45);
}
.picker-panel {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 82vh;
  border-radius: 28rpx 28rpx 0 0;
  background: #fff;
  padding-bottom: env(safe-area-inset-bottom);
}
.picker-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 32rpx 12rpx;
}
.picker-title {
  color: #222;
  font-size: 34rpx;
  font-weight: 600;
}
.picker-cancel {
  color: #999;
  font-size: 30rpx;
}
.picker-placeholder {
  visibility: hidden;
}
.search-box {
  display: flex;
  align-items: center;
  margin: 8rpx 32rpx 20rpx;
  height: 76rpx;
  border-radius: 38rpx;
  background: #f4f5f7;
  padding: 0 26rpx;
}
.search-icon {
  color: #b0b3b8;
  font-size: 32rpx;
}
.search-input {
  flex: 1;
  min-width: 0;
  margin-left: 14rpx;
  height: 100%;
  color: #333;
  font-size: 30rpx;
}
.search-placeholder {
  color: #b0b3b8;
}
.search-clear {
  padding-left: 16rpx;
  color: #b0b3b8;
  font-size: 26rpx;
}
.picker-body {
  position: relative;
  flex: 1;
  min-height: 0;
}
.picker-scroll {
  height: 100%;
}
.group-title {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f7f8fa;
  padding: 10rpx 32rpx;
  color: #8a8f99;
  font-size: 24rpx;
}
.area-row {
  box-sizing: border-box;
  min-height: 104rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 0 60rpx 0 32rpx;
  border-bottom: 1rpx solid #f2f2f2;
}
.area-name {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}
.area-name-primary {
  flex: none;
  color: var(--app-ink);
  font-size: 32rpx;
  line-height: 1.4;
}
.area-en {
  min-width: 0;
  overflow: hidden;
  color: var(--app-muted);
  font-size: 22rpx;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.area-code {
  flex: none;
  color: var(--app-ink-soft);
  font-size: 30rpx;
}
.area-row.active .area-name-primary,
.area-row.active .area-code {
  color: var(--app-brand-blue);
  font-weight: 600;
}
.empty {
  padding: 80rpx 0;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}
.scroll-tail {
  height: 40rpx;
}
.index-bar {
  position: absolute;
  top: 0;
  right: 6rpx;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 44rpx;
}
.index-letter {
  padding: 3rpx 0;
  width: 44rpx;
  color: #1677df;
  font-size: 21rpx;
  text-align: center;
}
</style>
