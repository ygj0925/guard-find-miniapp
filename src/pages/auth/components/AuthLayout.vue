<script setup lang="ts">
import { ref } from 'vue'
import AppPageHeader from '@/components/AppPageHeader.vue'

withDefaults(defineProps<{
  title: string
  subtitle?: string
  showBack?: boolean
}>(), {
  subtitle: '',
  showBack: true,
})

const emit = defineEmits<{
  back: []
}>()

const headerScrolled = ref(false)
const headerBackground = 'transparent'
const scrolledHeaderBackground = 'var(--app-header-surface, rgba(255,255,255,0.98))'
const h5DesktopClasses = {
  root: '',
  scroll: '',
  content: '',
  card: '',
  logo: '',
}

// #ifdef H5
Object.assign(h5DesktopClasses, {
  root: 'md:flex-row',
  scroll: 'md:h-full md:w-52% md:flex-none',
  content: 'md:flex md:flex-col md:p-0',
  card: 'md:my-auto md:w-[calc(100%-128rpx)] md:rounded-40rpx md:px-12 md:py-11',
  logo: 'md:hidden',
})
// #endif

function handleScroll(event: { detail: { scrollTop?: number } }) {
  headerScrolled.value = (event.detail.scrollTop || 0) > 16
}
</script>

<template>
  <view class="h-[var(--app-viewport-height)] max-h-[var(--app-viewport-height)] flex flex-col overflow-hidden text-app-ink font-sans bg-blue-white-gradient" :class="h5DesktopClasses.root">
    <!-- #ifdef H5 -->
    <view class="relative box-border hidden w-48% flex-col justify-center overflow-hidden bg-[linear-gradient(180deg,#247cf0_0%,#43a9ef_62%,#9dd5f7_100%)] px-12 py-12 text-white md:flex lg:px-20">
      <image class="relative z-1 mb-9 h-120rpx w-120rpx brightness-0 invert" src="/static/logo.svg" mode="aspectFit" />
      <view class="relative z-1 flex flex-col">
        <text class="text-2xs font-700 tracking-5rpx opacity-75">SSS RECRUITMENT</text>
        <text class="mt-3.5 block text-3xl font-700 leading-[1.25]">遇见更好的职业机会</text>
        <text class="mt-4 block max-w-580rpx text-sm leading-[1.8] opacity-82">安全、清晰、连贯地管理你的求职与职业发展。</text>
      </view>
      <view class="absolute bottom--160rpx right--180rpx h-640rpx w-640rpx border-1rpx border-white/14 rounded-full" />
      <view class="absolute right-100rpx top-90rpx h-180rpx w-180rpx border-1rpx border-white/14 rounded-full bg-white/8" />
    </view>
    <!-- #endif -->

    <!-- #ifndef H5 -->
    <AppPageHeader
      :title="title"
      light
      transparent
      :background="headerBackground"
      :scrolled="headerScrolled"
      :scrolled-background="scrolledHeaderBackground"
    >
      <template #left>
        <view
          v-if="showBack"
          class="h-64rpx w-64rpx flex cursor-pointer items-center justify-center border-1rpx rounded-20rpx text-2xl leading-none transition-[background-color,border-color,color] duration-180 ease-out active:opacity-74 motion-reduce:transition-none"
          :class="headerScrolled ? 'border-[#d9e3f2] bg-white text-brand-blue' : 'border-white/22 bg-white/12 text-white'"
          role="button"
          aria-label="返回"
          @tap="emit('back')"
        >
          <text>‹</text>
        </view>
        <view v-else class="invisible h-64rpx w-64rpx" />
      </template>
      <template #right>
        <view
          class="h-64rpx w-64rpx flex cursor-pointer items-center justify-center border-1rpx rounded-20rpx text-sm font-700 leading-none transition-[background-color,border-color,color] duration-180 ease-out active:opacity-74 motion-reduce:transition-none"
          :class="headerScrolled ? 'border-[#d9e3f2] bg-white text-brand-blue' : 'border-white/22 bg-white/12 text-white'"
          aria-label="帮助"
        >
          ?
        </view>
      </template>
    </AppPageHeader>
    <!-- #endif -->

    <scroll-view class="h-0 flex-1 bg-blue-white-gradient" :class="h5DesktopClasses.scroll" scroll-y @scroll="handleScroll">
      <view class="relative box-border min-h-full overflow-hidden pb-auth-layout-safe" :class="h5DesktopClasses.content">
        <!-- #ifdef H5 -->
        <view class="relative z-1 flex items-center justify-between px-4.5 pt-3 md:px-8 md:pt-4.5">
          <view
            v-if="showBack"
            class="h-64rpx w-64rpx flex cursor-pointer items-center justify-center border-1rpx rounded-20rpx text-2xl leading-none transition-[background-color,border-color,color,box-shadow] duration-180 ease-out active:opacity-74 motion-reduce:transition-none"
            :class="headerScrolled ? 'border-[#d9e3f2] bg-white text-brand-blue shadow-[0_10rpx_26rpx_rgba(54,82,145,0.08)]' : 'border-white/22 bg-white/12 text-white shadow-none md:border-[#e8edf7] md:bg-white md:text-brand-blue md:shadow-[0_10rpx_26rpx_rgba(54,82,145,0.08)]'"
            role="button"
            aria-label="返回"
            @tap="emit('back')"
          >
            <text>‹</text>
          </view>
          <view v-else class="invisible h-64rpx w-64rpx" />
          <view
            class="h-64rpx w-64rpx flex cursor-pointer items-center justify-center border-1rpx rounded-20rpx text-sm font-700 leading-none transition-[background-color,border-color,color,box-shadow] duration-180 ease-out active:opacity-74 motion-reduce:transition-none"
            :class="headerScrolled ? 'border-[#d9e3f2] bg-white text-brand-blue shadow-[0_10rpx_26rpx_rgba(54,82,145,0.08)]' : 'border-white/22 bg-white/12 text-white shadow-none md:border-[#e8edf7] md:bg-white md:text-brand-blue md:shadow-[0_10rpx_26rpx_rgba(54,82,145,0.08)]'"
            aria-label="帮助"
          >
            ?
          </view>
        </view>
        <!-- #endif -->

        <view class="relative z-1 mx-auto mt-5.5 box-border max-w-680rpx w-[calc(100%-48rpx)] border-1rpx border-[rgba(232,237,247,0.92)] rounded-36rpx bg-white/96 px-5 pb-7 pt-5 shadow-[0_24rpx_60rpx_rgba(54,82,145,0.12)] backdrop-blur-10rpx" :class="h5DesktopClasses.card">
          <slot name="brand">
            <image class="mx-auto mb-4 block h-92rpx w-92rpx" :class="h5DesktopClasses.logo" src="/static/logo.svg" mode="aspectFit" />
          </slot>
          <view class="mb-7 flex flex-col items-center text-center">
            <text class="text-xl text-app-ink font-700 leading-[1.35]">{{ title }}</text>
            <text v-if="subtitle" class="mt-1.5 block text-xs text-[#7f8997] leading-[1.55]">{{ subtitle }}</text>
          </view>
          <slot />
        </view>
      </view>
    </scroll-view>
  </view>
</template>
