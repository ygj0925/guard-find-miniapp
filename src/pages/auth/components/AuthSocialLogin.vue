<script setup lang="ts">
const emit = defineEmits<{
  wechat: []
  unavailable: [provider: string]
}>()
</script>

<template>
  <view class="mt-10">
    <view class="flex items-center gap-3 text-2xs text-[#a2acbc]">
      <view class="h-1rpx flex-1 bg-[#e8edf7]" />
      <text>其他登录方式</text>
      <view class="h-1rpx flex-1 bg-[#e8edf7]" />
    </view>
    <view class="mt-4 flex justify-center gap-4">
      <view class="h-82rpx w-82rpx flex cursor-pointer items-center justify-center border-1rpx border-[#e1e9f5] rounded-26rpx bg-white/88 shadow-[0_10rpx_24rpx_rgba(54,82,145,0.06)] transition-[background-color,transform,box-shadow] duration-180 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-94 active:bg-white motion-reduce:transition-none" role="button" aria-label="微信登录" @tap="emit('wechat')">
        <text class="h-52rpx w-52rpx flex items-center justify-center rounded-18rpx bg-[#12bd70] text-xs text-white font-700">微</text>
      </view>
      <view class="h-82rpx w-82rpx flex cursor-pointer items-center justify-center border-1rpx border-[#e1e9f5] rounded-26rpx bg-white/88 shadow-[0_10rpx_24rpx_rgba(54,82,145,0.06)] transition-[background-color,transform,box-shadow] duration-180 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-94 active:bg-white motion-reduce:transition-none" role="button" aria-label="QQ 登录" @tap="emit('unavailable', 'QQ')">
        <text class="h-52rpx w-52rpx flex items-center justify-center rounded-18rpx bg-[#4f8cf4] text-xs text-white font-700">Q</text>
      </view>
      <view class="h-82rpx w-82rpx flex cursor-pointer items-center justify-center border-1rpx border-[#e1e9f5] rounded-26rpx bg-white/88 shadow-[0_10rpx_24rpx_rgba(54,82,145,0.06)] transition-[background-color,transform,box-shadow] duration-180 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-94 active:bg-white motion-reduce:transition-none" role="button" aria-label="Apple 登录" @tap="emit('unavailable', 'Apple')">
        <text class="h-52rpx w-52rpx flex items-center justify-center rounded-18rpx bg-[#263249] text-3xs text-white font-700">●</text>
      </view>
    </view>
  </view>
</template>
