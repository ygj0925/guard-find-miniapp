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
  scrollProgress?: number
  scrolledBackground?: string
  scrolledLight?: boolean
  centerWide?: boolean
  safeAreaBackground?: string
}>(), {
  align: 'center',
  prominent: false,
  light: false,
  transparent: false,
  background: '',
  scrolled: false,
  scrollProgress: -1,
  scrolledBackground: 'rgba(237, 246, 255, 0.96)',
  scrolledLight: false,
  centerWide: false,
  safeAreaBackground: '',
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
const backgroundTop = computed(() => props.safeAreaBackground ? safeAreaTop : '0px')
const effectiveScrollProgress = computed(() => {
  if (props.scrollProgress >= 0)
    return Math.min(1, Math.max(0, props.scrollProgress))
  return props.scrolled ? 1 : 0
})
const safeAreaBackgroundStyle = computed(() => ({
  height: safeAreaTop,
  background: props.safeAreaBackground,
}))
const baseBackgroundStyle = computed(() => ({
  top: backgroundTop.value,
  background: props.background || (props.transparent ? 'transparent' : 'rgba(237, 246, 255, 0.96)'),
}))
const scrolledBackgroundStyle = computed(() => ({
  top: backgroundTop.value,
  background: props.scrolledBackground || 'rgba(237, 246, 255, 0.96)',
  opacity: effectiveScrollProgress.value,
}))
</script>

<template>
  <view class="box-content h-96rpx" :style="safeAreaStyle">
    <view
      class="fixed inset-x-0 top-0 z-100 box-content h-96rpx overflow-hidden border-b-1rpx border-b-transparent border-b-solid transition-[box-shadow,color,border-color] duration-180 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      :class="[
        effectiveScrollProgress >= 0.98 ? 'border-b-[rgba(107,139,204,0.14)] shadow-[0_8rpx_24rpx_rgba(55,94,174,0.1)]' : '',
        scrolled ? (scrolledLight ? 'text-white' : 'text-app-ink') : (light ? 'text-white' : 'text-app-ink'),
      ]"
      :style="safeAreaStyle"
    >
      <view
        v-if="safeAreaBackground"
        class="pointer-events-none absolute inset-x-0 top-0"
        :style="safeAreaBackgroundStyle"
      />
      <view
        class="pointer-events-none absolute inset-x-0 bottom-0 transition-opacity duration-180 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        :style="baseBackgroundStyle"
      />
      <view
        class="pointer-events-none absolute inset-x-0 bottom-0 transition-opacity duration-180 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
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
            ? 'absolute left-24rpx right-24rpx'
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
