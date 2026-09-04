<script setup lang="ts">
import { ref } from 'vue'
import AppPageHeader from '@/components/AppPageHeader.vue'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的分享',
    backgroundColor: '#f5f7fa',
  },
})

interface ShareItem {
  positionId: string
  positionName: string
  company: string
  salary: string
  status: 'active' | 'closed'
  location: string
  experience: string
  edu: string
  recruiterAvatar: string
  recruiterName: string
  recruiterRole: string
  sharedAt: string
}

const shareList = ref<ShareItem[]>([
  {
    positionId: '1001',
    positionName: '高级前端工程师',
    company: '三生制药',
    salary: '20-35K',
    status: 'active',
    location: '上海·浦东新区',
    experience: '3-5年',
    edu: '本科',
    recruiterAvatar: '',
    recruiterName: '李女士',
    recruiterRole: 'HR',
    sharedAt: '09月01日',
  },
  {
    positionId: '1002',
    positionName: '产品经理',
    company: '三生生物',
    salary: '15-25K',
    status: 'closed',
    location: '上海·静安区',
    experience: '1-3年',
    edu: '本科',
    recruiterAvatar: '',
    recruiterName: '王先生',
    recruiterRole: '招聘者',
    sharedAt: '08月28日',
  },
])

const loading = ref(false)

function handleBack() {
  if (getCurrentPages().length > 1)
    uni.navigateBack()
  else
    uni.switchTab({ url: '/pages/me/me' })
}

function handleTapPosition(positionId: string) {
  uni.navigateTo({ url: `/pages/position/detail?id=${encodeURIComponent(positionId)}` })
}

onShow(() => {
  // TODO: 接入分享记录接口
})
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-[#f5f7fa]">
    <AppPageHeader title="我的分享" background="#ffffff" scrolled-background="#ffffff">
      <template #left>
        <button
          class="plain-button h-12 w-12 flex cursor-pointer items-center justify-center border-0 rounded-full bg-transparent p-0 text-xl text-[#17233d] leading-none active:bg-[#eef4ff]"
          aria-label="返回"
          @tap="handleBack"
        >
          <view class="i-carbon-chevron-left" />
        </button>
      </template>
    </AppPageHeader>

    <!-- 加载中 -->
    <view v-if="loading" class="flex flex-col items-center justify-center py-24 text-sm text-[#98a2b3]">
      加载中...
    </view>

    <!-- 空状态 -->
    <view v-else-if="!shareList.length" class="flex flex-col items-center justify-center px-8 py-24">
      <view class="i-carbon-share mb-4 text-6xl text-[#dce3f0]" />
      <text class="text-base text-[#1a2640] font-700">暂无分享记录</text>
      <text class="mt-2 block text-center text-sm text-[#9aa5b5] leading-[1.6]">分享感兴趣的职位给好友，记录会在这里展示</text>
    </view>

    <!-- 分享列表 -->
    <view v-else class="px-3 pb-8 pt-3">
      <text class="mb-3 block px-1 text-xs text-[#9aa5b5]">共 {{ shareList.length }} 条分享记录</text>
      <view class="flex flex-col gap-3">
        <view
          v-for="item in shareList"
          :key="item.positionId"
          class="overflow-hidden rounded-2xl bg-white shadow-[0_4rpx_16rpx_rgba(38,64,105,0.06)] active:opacity-90"
          @tap="handleTapPosition(item.positionId)"
        >
          <view class="px-4 pb-3 pt-4">
            <!-- 职位名 + 薪资/停止招聘 -->
            <view class="flex items-start justify-between gap-2">
              <text
                class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-base font-700 leading-[1.4]"
                :class="item.status === 'closed' ? 'text-[#b0bac8]' : 'text-[#1a2640]'"
              >
                {{ item.positionName }}
              </text>
              <text v-if="item.status === 'closed'" class="flex-shrink-0 text-base text-[#9aa5b5] font-700">
                停止招聘
              </text>
              <text v-else class="flex-shrink-0 text-base text-brand-blue font-700">
                {{ item.salary }}
              </text>
            </view>

            <!-- 公司 -->
            <text class="mt-1 block text-xs" :class="item.status === 'closed' ? 'text-[#c8d0dc]' : 'text-[#6b7a8d]'">{{ item.company }}</text>

            <!-- 地点/经验/学历 -->
            <view class="mt-1.5 flex flex-wrap items-center gap-1.5">
              <text v-if="item.location" class="text-xs" :class="item.status === 'closed' ? 'text-[#c8d0dc]' : 'text-[#9aa5b5]'">{{ item.location }}</text>
              <text v-if="item.location && item.experience" class="text-xs text-[#c8d0dc]">·</text>
              <text v-if="item.experience" class="text-xs" :class="item.status === 'closed' ? 'text-[#c8d0dc]' : 'text-[#9aa5b5]'">{{ item.experience }}</text>
              <text v-if="item.edu && (item.location || item.experience)" class="text-xs text-[#c8d0dc]">·</text>
              <text v-if="item.edu" class="text-xs" :class="item.status === 'closed' ? 'text-[#c8d0dc]' : 'text-[#9aa5b5]'">{{ item.edu }}</text>
            </view>
          </view>

          <!-- 底部：发布人 + 分享时间 -->
          <view class="flex items-center justify-between border-t-1rpx border-t-[#f0f4fa] border-t-solid px-4 py-3">
            <!-- 发布人 -->
            <view class="flex items-center gap-2">
              <view class="h-56rpx w-56rpx flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8f0fd]">
                <image
                  v-if="item.recruiterAvatar"
                  class="h-full w-full"
                  :src="item.recruiterAvatar"
                  mode="aspectFill"
                />
                <view v-else class="i-carbon-user-avatar text-base text-brand-blue leading-none" />
              </view>
              <view class="flex flex-col">
                <text class="text-xs font-600 leading-[1.3]" :class="item.status === 'closed' ? 'text-[#c8d0dc]' : 'text-[#1a2640]'">{{ item.recruiterName }}</text>
                <text class="text-2xs leading-[1.3]" :class="item.status === 'closed' ? 'text-[#c8d0dc]' : 'text-[#9aa5b5]'">{{ item.recruiterRole }}</text>
              </view>
            </view>

            <!-- 分享时间 -->
            <text class="text-xs text-[#b0bac8]">{{ item.sharedAt }} 分享</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.plain-button::after {
  border: 0;
}
</style>
