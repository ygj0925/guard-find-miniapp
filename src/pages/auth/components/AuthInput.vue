<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder: string
  icon?: string
  error?: string
  password?: boolean
  inputType?: 'text' | 'number'
  maxlength?: number
  actionText?: string
  disabled?: boolean
}>(), {
  icon: '',
  error: '',
  password: false,
  inputType: 'text',
  maxlength: 64,
  actionText: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'blur': []
  'action': []
}>()

const showPassword = ref(false)
const actualType = computed(() => props.password ? 'text' : props.inputType)

function updateValue(event: { detail: { value: string } }) {
  emit('update:modelValue', event.detail.value)
}
</script>

<template>
  <view class="mb-3">
    <view
      class="box-border min-h-96rpx flex items-center border-2rpx border-[#e1e9f5] rounded-26rpx bg-white/76 px-3 shadow-[inset_0_1rpx_0_rgba(255,255,255,0.9)] transition-[background-color,border-color,box-shadow] duration-180 ease-[cubic-bezier(0.32,0.72,0,1)] focus-within:border-brand-blue focus-within:bg-white motion-reduce:transition-none"
      :class="{
        'border-[#e95d63] bg-[#fff8f8]': error,
        'bg-[#f1f4fa] text-[#aeb9ca]': disabled,
      }"
    >
      <text v-if="icon" class="mr-2 h-42rpx w-42rpx flex items-center justify-center rounded-14rpx bg-[#eaf4ff] text-center text-sm text-brand-blue">{{ icon }}</text>
      <input
        class="min-w-0 flex-1 text-sm text-app-ink"
        :value="modelValue"
        :type="actualType"
        :password="password && !showPassword"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :disabled="disabled"
        @input="updateValue"
        @blur="emit('blur')"
      >
      <text
        v-if="password"
        class="min-w-64rpx cursor-pointer pl-2 text-right text-sm text-[#8390a6]"
        role="button"
        :aria-label="showPassword ? '隐藏密码' : '显示密码'"
        @tap="showPassword = !showPassword"
      >
        {{ showPassword ? '◉' : '◌' }}
      </text>
      <text v-else-if="actionText" class="min-w-64rpx cursor-pointer pl-2 text-right text-xs text-brand-blue font-700" role="button" @tap="emit('action')">{{ actionText }}</text>
    </view>
    <text v-if="error" class="block px-3 pt-1 text-2xs text-[#e95d63] leading-[1.4]">{{ error }}</text>
  </view>
</template>
