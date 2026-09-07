<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  cancel: []
  confirm: [value: string]
}>()

const value = ref('')
const error = ref('')
const captcha = '0793'

function confirm() {
  if (value.value !== captcha) {
    error.value = '验证码不正确，请重新输入'
    return
  }
  emit('confirm', value.value)
}
</script>

<template>
  <view class="fixed inset-0 z-99 flex items-center justify-center bg-[rgba(35,50,82,0.5)] p-6" @tap.self="emit('cancel')">
    <view class="box-border max-w-560rpx w-full border-1rpx border-white/72 rounded-34rpx bg-white px-5 pb-4 pt-6 shadow-[0_28rpx_70rpx_rgba(31,51,95,0.22)]" role="dialog" aria-label="图形验证码" @tap.stop>
      <text class="block text-center text-base text-app-ink font-700">安全验证</text>
      <text class="mt-1.5 block text-center text-2xs text-#9aa5b8">请输入图形验证码后继续</text>
      <view class="mt-4 h-84rpx flex items-center border-2rpx border-#e8edf7 rounded-22rpx bg-#f8faff px-3">
        <input v-model="value" class="min-w-0 flex-1 text-xs text-app-ink" placeholder="图形验证码" :maxlength="4">
        <text class="py-0 pl-2.5 pr-1.5 text-lg text-#467bff font-700 tracking-6rpx italic">{{ captcha }}</text>
      </view>
      <text v-if="error" class="mt-1.5 block text-2xs text-#e95d63">{{ error }}</text>
      <view class="mt-5 flex justify-between border-t-1rpx border-#edf1f8 px-10.5 py-3.5 text-sm text-#7f8aa0 -mx-5 -mb-4">
        <text class="cursor-pointer" role="button" @tap="emit('cancel')">取消</text>
        <text class="cursor-pointer text-#467bff font-700" role="button" @tap="confirm">确定</text>
      </view>
    </view>
  </view>
</template>
