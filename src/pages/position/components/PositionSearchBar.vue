<script setup lang="ts">
withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false,
})

const emit = defineEmits<{
  tap: []
}>()
</script>

<template>
  <view
    class="box-border w-full flex cursor-pointer items-center border-1rpx border-white/70 rounded-full border-solid bg-white/92 text-[#8290a5] shadow-[0_8rpx_24rpx_rgba(39,105,180,0.08)] transition-[height,background-color,box-shadow] duration-180 ease-out active:opacity-78 motion-reduce:transition-none"
    :class="compact ? 'h-64rpx px-3 text-xs' : 'h-82rpx px-3 text-sm'"
    role="button"
    aria-label="搜索职位、城市或关键词"
    @tap="emit('tap')"
  >
    <view class="i-carbon-search mr-2 text-base text-[#94a3b8] leading-none" />
    <text class="overflow-hidden text-ellipsis whitespace-nowrap">搜索职位、城市或关键词</text>
  </view>
</template>
