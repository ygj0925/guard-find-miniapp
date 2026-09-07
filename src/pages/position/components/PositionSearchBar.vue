<script setup lang="ts">
interface PositionSearchInputEvent {
  detail: {
    value: string
  }
}

withDefaults(defineProps<{
  compact?: boolean
  modelValue?: string
}>(), {
  compact: false,
  modelValue: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'search': [value: string]
}>()

function handleInput(event: PositionSearchInputEvent) {
  emit('update:modelValue', event.detail.value)
}

function handleConfirm(event: PositionSearchInputEvent) {
  const value = event.detail.value.trim()
  emit('update:modelValue', value)
  emit('search', value)
}

function clearKeyword() {
  emit('update:modelValue', '')
  emit('search', '')
}
</script>

<template>
  <view
    class="box-border min-w-0 w-full flex items-center overflow-hidden rounded-full text-app-muted transition-[height,padding,background-color,border-color,box-shadow,transform,opacity] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
    :class="compact
      ? 'h-68rpx border-1rpx border-[rgba(47,111,232,0.24)] border-solid bg-white/96 px-3 text-xs shadow-[0_8rpx_24rpx_rgba(35,84,168,0.16)] backdrop-blur-12rpx'
      : 'h-82rpx border-1rpx border-white/90 border-solid bg-[#f2f6fb] px-3 text-sm shadow-[0_10rpx_28rpx_rgba(39,105,180,0.08)]'"
    role="search"
  >
    <view class="i-carbon-search mr-2 flex-none text-base leading-none" :class="compact ? 'text-brand-blue' : 'text-app-muted'" />
    <input
      class="h-full min-w-0 flex-1 text-app-ink"
      type="text"
      confirm-type="search"
      :value="modelValue"
      :maxlength="50"
      :cursor-spacing="24"
      placeholder="搜索职位、城市或关键词"
      placeholder-class="text-app-muted"
      aria-label="搜索职位、城市或关键词"
      @input="handleInput"
      @confirm="handleConfirm"
    >
    <view
      v-if="modelValue"
      class="ml-1 h-52rpx w-52rpx flex flex-none cursor-pointer items-center justify-center rounded-full text-app-muted active:bg-black/6 active:opacity-70"
      role="button"
      aria-label="清空搜索关键词"
      @tap.stop="clearKeyword"
    >
      <view class="i-carbon-close-filled text-sm leading-none" />
    </view>
  </view>
</template>
