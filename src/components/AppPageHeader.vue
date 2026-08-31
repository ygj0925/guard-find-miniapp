<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  align?: 'center' | 'left'
  prominent?: boolean
  light?: boolean
  transparent?: boolean
  background?: string
  scrolled?: boolean
  scrolledBackground?: string
  scrolledLight?: boolean
  centerWide?: boolean
}>(), {
  align: 'center',
  prominent: false,
  light: false,
  transparent: false,
  background: '',
  scrolled: false,
  scrolledBackground: 'rgba(237, 246, 255, 0.96)',
  scrolledLight: false,
  centerWide: false,
})

let statusBarHeight = 0

try {
  statusBarHeight = uni.getWindowInfo?.().statusBarHeight || uni.getSystemInfoSync().statusBarHeight || 0
}
catch {
  statusBarHeight = 0
}

let safeAreaTop = `${statusBarHeight}px`
// #ifdef H5
safeAreaTop = 'env(safe-area-inset-top)'
// #endif

const safeAreaStyle = { paddingTop: safeAreaTop }
const baseBackgroundStyle = computed(() => ({
  background: props.background || (props.transparent ? 'transparent' : 'rgba(237, 246, 255, 0.96)'),
}))
const scrolledBackgroundStyle = computed(() => ({
  background: props.scrolledBackground || 'var(--app-header-surface, rgba(255, 255, 255, 0.98))',
}))
</script>

<template>
  <view class="box-content h-96rpx" :style="safeAreaStyle">
    <view
      class="fixed inset-x-0 top-0 z-100 box-content h-96rpx overflow-hidden border-b-1rpx border-b-transparent border-b-solid transition-[box-shadow,color] duration-180 ease-out"
      :class="[
        scrolled ? 'border-b-[rgba(107,139,204,0.14)] shadow-[0_8rpx_24rpx_rgba(55,94,174,0.1)]' : '',
        scrolled ? (scrolledLight ? 'text-white' : 'text-[#121c39]') : (light ? 'text-white' : 'text-[#121c39]'),
      ]"
      :style="safeAreaStyle"
    >
      <view class="pointer-events-none absolute inset-0 transition-opacity duration-[var(--app-motion-duration-fast,180ms)] ease-[var(--app-motion-easing-standard,ease-out)] motion-reduce:transition-none" :style="baseBackgroundStyle" />
      <view
        class="pointer-events-none absolute inset-0 transition-opacity duration-[var(--app-motion-duration-fast,180ms)] ease-[var(--app-motion-easing-standard,ease-out)] motion-reduce:transition-none"
        :class="scrolled ? 'opacity-100' : 'opacity-0'"
        :style="scrolledBackgroundStyle"
      />

      <view
        class="relative z-1 h-96rpx flex items-center px-3"
        :class="align === 'left' ? 'justify-start' : 'justify-center'"
      >
        <view class="absolute left-24rpx top-0 z-1 h-96rpx w-96rpx flex items-center justify-center">
          <slot name="left" />
        </view>

        <view
          v-if="$slots.center"
          class="min-w-0"
          :class="centerWide
            ? 'absolute left-24rpx right-136rpx'
            : (align === 'left' ? 'max-w-[calc(100%_-_130rpx)]' : 'max-w-[calc(100%_-_220rpx)]')"
        >
          <slot name="center" />
        </view>
        <text
          v-else
          class="overflow-hidden text-ellipsis whitespace-nowrap leading-[1.35] tracking-1rpx"
          :class="[
            align === 'left' ? 'max-w-[calc(100%_-_130rpx)]' : 'max-w-[calc(100%_-_220rpx)]',
            prominent ? 'text-xl font-700' : 'text-lg font-600',
          ]"
        >
          {{ title }}
        </text>

        <view class="absolute right-24rpx top-0 z-1 h-96rpx w-96rpx flex items-center justify-center">
          <slot name="right" />
        </view>
      </view>
    </view>
  </view>
</template>
