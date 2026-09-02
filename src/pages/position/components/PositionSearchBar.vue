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
    class="box-border min-w-0 w-full flex cursor-pointer items-center overflow-hidden border-0 rounded-full bg-[#f2f4f7] text-app-muted shadow-none transition-[height,padding,background-color,transform,opacity] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] active:opacity-78 motion-reduce:transition-none"
    :class="compact ? 'h-64rpx px-3 text-xs' : 'h-82rpx px-3 text-sm'"
    role="button"
    aria-label="搜索职位、城市或关键词"
    @tap="emit('tap')"
  >
    <view class="i-carbon-search mr-2 flex-none text-base text-app-muted leading-none" />
    <text class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">搜索职位、城市或关键词</text>
  </view>
</template>
