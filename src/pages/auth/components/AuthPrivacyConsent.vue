<script setup lang="ts">
defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'privacy': []
}>()
</script>

<template>
  <view class="my-0.5 mb-4 min-h-54rpx flex flex-wrap items-center text-xs text-[#7f8ca1] leading-[1.6]">
    <wd-checkbox
      :model-value="modelValue"
      type="square"
      checked-color="var(--app-brand-blue)"
      custom-class="mr-0.5"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <text>我已阅读并同意</text>
    </wd-checkbox>
    <text class="cursor-pointer text-brand-blue" role="link" @tap="emit('privacy')">《隐私政策》</text>
  </view>
</template>
