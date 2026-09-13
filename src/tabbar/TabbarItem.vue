<script setup lang="ts">
import type { CustomTabBarItem } from './types'
import { computed } from 'vue'
import { getI18nText } from './i18n'
import { tabbarStore } from './store'

const props = defineProps<{
  item: CustomTabBarItem
  index: number
  isBulge?: boolean
}>()

const showBackToTop = computed(() => !props.isBulge && tabbarStore.isBackToTopPath(props.item.pagePath))
const displayText = computed(() => showBackToTop.value ? '回顶部' : getI18nText(props.item.text))

function getIconByIndex(index: number, item: CustomTabBarItem) {
  if (!item.iconActive) {
    return item.icon
  }
  return tabbarStore.curIdx === index ? item.iconActive : item.icon
}
</script>

<template>
  <view class="relative flex flex-col items-center justify-center">
    <template v-if="item.iconType === 'uiLib'" />

    <template v-if="item.iconType === 'unocss' || item.iconType === 'iconfont'">
      <view class="leading-none" :class="[showBackToTop ? 'i-carbon-up-to-top' : getIconByIndex(index, item), isBulge ? 'text-7xl' : 'text-xl']" />
    </template>

    <template v-if="item.iconType === 'image'">
      <image :src="getIconByIndex(index, item)" mode="scaleToFill" :class="isBulge ? 'h-116px w-116px' : 'h-24px w-24px'" />
    </template>

    <view v-if="!isBulge" class="mt-0.5 text-xs">
      {{ displayText }}
    </view>
    <view v-if="item.badge">
      <template v-if="item.badge === 'dot'">
        <view class="absolute right-0 top-0 h-2 w-2 rounded-full bg-#f56c6c" />
      </template>
      <template v-else>
        <view class="absolute top-0 box-border h-5 min-w-5 center rounded-full bg-#f56c6c px-1 text-center text-xs text-white -right-3">
          {{ item.badge > 99 ? '99+' : item.badge }}
        </view>
      </template>
    </view>
  </view>
</template>
