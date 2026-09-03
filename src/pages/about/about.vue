<script setup lang="ts">
definePage({
  style: {
    navigationBarTitleText: '关于生生智家',
    backgroundColor: '#EDF6FF',
  },
})
</script>

<template>
  <view class="app-page px-3 py-4">
    <view class="rounded-24rpx bg-white p-4 shadow-[0_12rpx_36rpx_rgba(42,92,178,0.08)]">
      <text class="block text-lg font-700">生生智家</text>
      <text class="mt-1.5 block text-xs text-[#7f8ca1] leading-7">帮助你发现合适岗位、完善求职资料并持续跟进职业进展。</text>
    </view>
    <wd-cell-group custom-class="mt-3 overflow-hidden rounded-24rpx">
      <wd-cell title="服务版本" value="1.0.0" />
      <wd-cell title="服务使用协议" is-link to="/pages/auth/agreement" />
      <wd-cell title="隐私政策" is-link to="/pages/auth/privacy" />
    </wd-cell-group>
  </view>
</template>
