<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { AGREEMENT_PAGE, PRIVACY_PAGE } from '@/router/config'
import { usePositionStore, useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarBackgroundColor: '#2D6FE6',
    navigationBarTextStyle: 'white',
    navigationBarTitleText: '我的',
    backgroundColor: '#FFFFFF',
    backgroundColorTop: '#2D6FE6',
    backgroundColorBottom: '#FFFFFF',
  },
})

const userStore = useUserStore()
const tokenStore = useTokenStore()
const positionStore = usePositionStore()
const { userInfo } = storeToRefs(userStore)
const profileName = computed(() => userInfo.value.username || '求职者')
const profileInitial = computed(() => profileName.value.slice(0, 1))
const headerScrolled = ref(false)
const profileStats = computed(() => [
  { label: '投递', value: tokenStore.hasLogin ? String(positionStore.appliedIds.length) : '**' },
  { label: '收藏', value: tokenStore.hasLogin ? String(positionStore.favoriteIds.length) : '**' },
  { label: '面试', value: tokenStore.hasLogin ? '0' : '**' },
  { label: '足迹', value: tokenStore.hasLogin ? String(positionStore.appliedIds.length + positionStore.favoriteIds.length) : '**' },
])
const resumeShortcuts = [
  { label: '在线简历', icon: 'i-carbon-document' },
  { label: '附件简历', icon: 'i-carbon-attachment' },
  { label: '求职意向', icon: 'i-carbon-favorite' },
  { label: '简历模板', icon: 'i-carbon-template' },
]

const profileScrolledBackground = 'var(--app-header-surface, rgba(255,255,255,0.98))'
const RESUME_PAGE = '/pages/resume/index'

onPageScroll(({ scrollTop }) => {
  headerScrolled.value = scrollTop > 16
})

function handleLogin() {
  toLoginPage()
}

function handleProfileTap() {
  if (!tokenStore.hasLogin) {
    handleLogin()
  }
}

function handleLegalTap(url: string) {
  uni.navigateTo({ url })
}

function handleResumeShortcut(label: string) {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  if (label === '附件简历') {
    uni.navigateTo({ url: RESUME_PAGE })
    return
  }
  uni.showToast({ title: '功能开发中', icon: 'none' })
}

function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        useTokenStore().logout()
        uni.showToast({
          title: '退出登录成功',
          icon: 'success',
        })
      }
    },
  })
}
</script>

<template>
  <view class="relative app-tab-page overflow-hidden bg-white font-['Noto_Sans_SC','Microsoft_YaHei',sans-serif]">
    <view class="pointer-events-none absolute inset-x-0 top-0 h-[var(--app-viewport-height)] bg-[var(--app-blue-white-gradient)]" aria-hidden="true" />
    <view class="relative z-1 box-border min-h-72 px-6.5 pb-20 text-white">
      <AppPageHeader
        title="我的"
        light
        transparent
        :scrolled="headerScrolled"
        :scrolled-background="profileScrolledBackground"
      />
      <view
        class="flex items-center -mt-16"
        :class="!tokenStore.hasLogin ? 'cursor-pointer active:opacity-82' : ''"
        :role="tokenStore.hasLogin ? undefined : 'button'"
        @tap="handleProfileTap"
      >
        <view
          class="mr-3 h-112rpx w-112rpx flex flex-[0_0_112rpx] items-center justify-center border-2rpx border-[rgba(255,255,255,0.22)] rounded-full border-solid bg-[rgba(255,255,255,0.22)] text-xl text-white font-700 leading-none shadow-[inset_0_2rpx_8rpx_rgba(255,255,255,0.14)]"
        >
          <text v-if="tokenStore.hasLogin">{{ profileInitial }}</text>
          <view v-else class="i-carbon-user-avatar text-3xl leading-none" />
        </view>
        <view class="min-w-0 flex flex-1 flex-col">
          <text class="overflow-hidden text-ellipsis whitespace-nowrap text-lg font-700 leading-[1.35]">
            {{ tokenStore.hasLogin ? profileName : '点击登录/注册' }}
          </text>
          <text class="mt-1 block text-sm leading-[1.45] opacity-78">
            {{ tokenStore.hasLogin ? '查看并完善你的求职资料' : '可解锁全部信息' }}
          </text>
        </view>
      </view>

      <view class="grid grid-cols-4 mt-7 border-t-1rpx border-t-[rgba(255,255,255,0.24)] border-t-solid pt-5">
        <view v-for="stat in profileStats" :key="stat.label" class="min-w-0 flex flex-col items-center text-center">
          <text class="text-xl font-700 leading-[1.3]">{{ stat.value }}</text>
          <text class="mt-1.5 block text-sm leading-[1.35] opacity-75">{{ stat.label }}</text>
        </view>
      </view>
    </view>

    <view class="relative z-1 px-4 -mt-10">
      <view class="rounded-28rpx bg-white px-0.5 py-4 shadow-[0_16rpx_40rpx_rgba(42,92,178,0.12)]">
        <view class="grid grid-cols-4">
          <view
            v-for="shortcut in resumeShortcuts"
            :key="shortcut.label"
            class="min-h-158rpx min-w-0 flex flex-col cursor-pointer items-center justify-center text-sm text-app-ink leading-[1.4] active:bg-[#f7f9fd]"
            role="button"
            @tap="handleResumeShortcut(shortcut.label)"
          >
            <view class="mb-2 text-3xl text-brand-blue leading-none" :class="[shortcut.icon]" />
            <text>{{ shortcut.label }}</text>
          </view>
        </view>
      </view>

      <view class="mt-4">
        <text class="mx-1 mb-2 block text-base text-app-ink font-700">求职服务</text>
        <view class="rounded-28rpx bg-white px-3.5 shadow-[0_10rpx_28rpx_rgba(42,92,178,0.08)]">
          <view class="min-h-116rpx flex cursor-pointer items-center border-b-1rpx border-b-[#edf1f7] border-b-solid last:border-b-0 active:opacity-70">
            <view class="i-carbon-location mr-2 w-48rpx flex flex-[0_0_48rpx] items-center justify-center text-lg text-brand-blue leading-none" />
            <view class="min-w-0 flex flex-1 flex-col">
              <text class="text-sm text-[#263249] font-600">求职意向</text>
              <text class="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#9aa5b5]">设置期望职位与工作城市</text>
            </view>
            <view class="i-carbon-chevron-right ml-2 text-base text-[#bec7d4] leading-none" />
          </view>
          <view class="min-h-116rpx flex cursor-pointer items-center border-b-1rpx border-b-[#edf1f7] border-b-solid last:border-b-0 active:opacity-70">
            <view class="i-carbon-notification mr-2 w-48rpx flex flex-[0_0_48rpx] items-center justify-center text-lg text-brand-blue leading-none" />
            <view class="min-w-0 flex flex-1 flex-col">
              <text class="text-sm text-[#263249] font-600">消息通知</text>
              <text class="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#9aa5b5]">职位进展与面试提醒</text>
            </view>
            <view class="i-carbon-chevron-right ml-2 text-base text-[#bec7d4] leading-none" />
          </view>
          <view class="min-h-116rpx flex cursor-pointer items-center border-b-1rpx border-b-[#edf1f7] border-b-solid last:border-b-0 active:opacity-70">
            <view class="i-carbon-help mr-2 w-48rpx flex flex-[0_0_48rpx] items-center justify-center text-lg text-brand-blue leading-none" />
            <view class="min-w-0 flex flex-1 flex-col">
              <text class="text-sm text-[#263249] font-600">帮助与反馈</text>
              <text class="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#9aa5b5]">常见问题与意见反馈</text>
            </view>
            <view class="i-carbon-chevron-right ml-2 text-base text-[#bec7d4] leading-none" />
          </view>
          <view class="min-h-116rpx flex cursor-pointer items-center border-b-1rpx border-b-[#edf1f7] border-b-solid last:border-b-0 active:opacity-70">
            <view class="i-carbon-settings mr-2 w-48rpx flex flex-[0_0_48rpx] items-center justify-center text-lg text-brand-blue leading-none" />
            <view class="min-w-0 flex flex-1 flex-col">
              <text class="text-sm text-[#263249] font-600">账号设置</text>
              <text class="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#9aa5b5]">隐私、安全与个人信息</text>
            </view>
            <view class="i-carbon-chevron-right ml-2 text-base text-[#bec7d4] leading-none" />
          </view>
          <view class="min-h-116rpx flex cursor-pointer items-center border-b-1rpx border-b-[#edf1f7] border-b-solid last:border-b-0 active:opacity-70" role="link" @tap="handleLegalTap(AGREEMENT_PAGE)">
            <view class="i-carbon-document mr-2 w-48rpx flex flex-[0_0_48rpx] items-center justify-center text-lg text-brand-blue leading-none" />
            <view class="min-w-0 flex flex-1 flex-col">
              <text class="text-sm text-[#263249] font-600">服务使用协议</text>
              <text class="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#9aa5b5]">了解服务使用规则</text>
            </view>
            <view class="i-carbon-chevron-right ml-2 text-base text-[#bec7d4] leading-none" />
          </view>
          <view class="min-h-116rpx flex cursor-pointer items-center border-b-1rpx border-b-[#edf1f7] border-b-solid last:border-b-0 active:opacity-70" role="link" @tap="handleLegalTap(PRIVACY_PAGE)">
            <view class="i-carbon-locked mr-2 w-48rpx flex flex-[0_0_48rpx] items-center justify-center text-lg text-brand-blue leading-none" />
            <view class="min-w-0 flex flex-1 flex-col">
              <text class="text-sm text-[#263249] font-600">隐私政策</text>
              <text class="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#9aa5b5]">了解个人信息处理方式</text>
            </view>
            <view class="i-carbon-chevron-right ml-2 text-base text-[#bec7d4] leading-none" />
          </view>
        </view>
      </view>

      <view v-if="!tokenStore.hasLogin" class="mt-3 flex flex-col items-center rounded-28rpx bg-white px-3.5 py-4 text-center shadow-[0_10rpx_28rpx_rgba(42,92,178,0.08)]">
        <text class="text-sm text-[#263249] font-600">登录后使用完整求职服务</text>
        <text class="mt-1 block text-xs text-[#9aa5b5]">同步简历、投递记录与面试消息</text>
        <view
          class="mt-3 box-border min-h-84rpx w-full flex cursor-pointer items-center justify-center rounded-14rpx bg-brand-blue text-base text-white font-600 transition-[opacity,transform] duration-180 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-99 active:opacity-88 motion-reduce:transition-none"
          @tap="handleLogin"
        >
          前往登录
        </view>
      </view>

      <view
        v-else
        class="mt-3 min-h-92rpx flex cursor-pointer items-center justify-center gap-1.5 rounded-28rpx bg-white text-sm text-[#df555b] font-600 shadow-[0_10rpx_28rpx_rgba(42,92,178,0.08)] active:bg-[#fff7f7]"
        role="button"
        @tap="handleLogout"
      >
        <view class="i-carbon-logout" />
        <text>退出登录</text>
      </view>
    </view>
  </view>
</template>
