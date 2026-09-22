<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { PRIVACY_PAGE } from '@/router/config'
import { useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'
import { createMiniProgramShare, createMiniProgramTimelineShare } from '@/utils/miniProgramShare'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarBackgroundColor: '#dbeafe',
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '我的',
    backgroundColor: '#F5F7FA',
    backgroundColorTop: '#dbeafe',
    backgroundColorBottom: '#F5F7FA',
    enableShareAppMessage: true,
    enableShareTimeline: true,
  },
})

onShareAppMessage(() => createMiniProgramShare('生生智家 - 我的', '/pages/me/me'))
onShareTimeline(() => createMiniProgramTimelineShare('生生智家 - 我的'))

const userStore = useUserStore()
const tokenStore = useTokenStore()
const { userInfo } = storeToRefs(userStore)
const profileName = computed(() => userInfo.value.nickname || userInfo.value.username || '求职者')
const profileInitial = computed(() => profileName.value.slice(0, 1))
const profileSubtitle = computed(() => {
  if (!tokenStore.hasLogin)
    return '同步简历、投递记录与面试消息'
  return '查看并完善你的求职资料'
})
const headerScrolled = ref(false)
const profileScrolledBackground = 'var(--app-header-surface, rgba(255,255,255,0.98))'
const resumeShortcuts = [
  { label: '附件简历', icon: 'i-carbon-attachment' },
  { label: '投递记录', icon: 'i-carbon-send-alt' },
  { label: '我的分享', icon: 'i-carbon-share' },
]

const RESUME_PAGE = '/pages/resume/index'
const CERTIFICATION_PAGE = '/pages/certification/index'

onShow(() => {
  tokenStore.updateNowTime()
  console.log('userInfo', userInfo.value)
})

onPageScroll(({ scrollTop }) => {
  headerScrolled.value = scrollTop > 16
})

function handleLogin() {
  toLoginPage()
}

function handleProfileTap() {
  if (!tokenStore.updateNowTime().hasLogin) {
    handleLogin()
  }
}

function handleNotificationTap() {
  uni.switchTab({ url: '/pages/notification/index' })
}

function handleProfileSettings() {
  uni.navigateTo({ url: '/pages/me/profile' })
}

function handleCertification() {
  if (!tokenStore.updateNowTime().hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: CERTIFICATION_PAGE })
}

function handleLegalTap(url: string) {
  uni.navigateTo({ url })
}

function handleResumeShortcut(label: string) {
  if (!tokenStore.updateNowTime().hasLogin) {
    handleLogin()
    return
  }
  if (label === '附件简历') {
    uni.navigateTo({ url: RESUME_PAGE })
    return
  }
  if (label === '投递记录') {
    uni.navigateTo({ url: '/pages/position/applies' })
    return
  }
  if (label === '我的分享') {
    uni.navigateTo({ url: '/pages/favorites/index' })
    return
  }
  uni.showToast({ title: '功能开发中', icon: 'none' })
}

function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (!res.confirm)
        return

      try {
        const loggedOut = await tokenStore.logout()
        if (!loggedOut)
          throw new Error('退出登录未完成')
        uni.showToast({ title: '退出登录成功', icon: 'success' })
      }
      catch {
        uni.showToast({ title: '退出登录失败，请重试', icon: 'none' })
      }
    },
  })
}
</script>

<template>
  <view class="relative app-tab-page bg-[#f5f7fa] font-['Noto_Sans_SC','Microsoft_YaHei',sans-serif]">
    <!-- 浅色渐变背景层 -->
    <view class="pointer-events-none absolute inset-x-0 top-0 h-[var(--app-viewport-height)] bg-[linear-gradient(160deg,#dbeafe_0%,#eff6ff_50%,#f5f7fa_100%)]" aria-hidden="true" />

    <!-- 顶部区域：导航栏 + 个人信息 -->
    <view class="relative z-1 box-border px-5 pb-6">
      <AppPageHeader
        title="我的"
        transparent
        :scrolled="headerScrolled"
        :scrolled-background="profileScrolledBackground"
      />

      <!-- 个人信息行 -->
      <view
        class="mt-2 flex items-center"
        :class="!tokenStore.hasLogin ? 'cursor-pointer active:opacity-82' : ''"
        :role="tokenStore.hasLogin ? undefined : 'button'"
        @tap="handleProfileTap"
      >
        <!-- 头像 -->
        <view class="mr-3.5 h-120rpx w-120rpx flex flex-shrink-0 items-center justify-center overflow-hidden border-2rpx border-[rgba(45,111,230,0.2)] rounded-full border-solid bg-[rgba(45,111,230,0.12)] shadow-[0_4rpx_16rpx_rgba(42,92,178,0.12)]">
          <image v-if="tokenStore.hasLogin && userInfo.avatar" class="h-full w-full" :src="userInfo.avatar" mode="aspectFill" />
          <text v-else-if="tokenStore.hasLogin" class="text-2xl text-brand-blue font-700 leading-none">{{ profileInitial }}</text>
          <view v-else class="i-carbon-user-avatar text-4xl text-brand-blue leading-none" />
        </view>

        <!-- 姓名 + 副标题 -->
        <view class="min-w-0 flex flex-1 flex-col">
          <text class="overflow-hidden text-ellipsis whitespace-nowrap text-xl text-[#1a2640] font-700 leading-[1.3]">
            {{ tokenStore.hasLogin ? profileName : '点击登录 / 注册' }}
          </text>
          <view v-if="tokenStore.hasLogin && userInfo.deptName" class="mt-1 flex items-center gap-1">
            <text class="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-brand-blue leading-[1.4]">{{ userInfo.deptName }}</text>
            <view v-if="userInfo.isInternalEmployee" class="h-28rpx w-28rpx flex flex-shrink-0 items-center justify-center rounded-full bg-[#07c160]">
              <view class="i-carbon-checkmark text-[13px] text-white leading-none" />
            </view>
          </view>
          <text v-if="!tokenStore.hasLogin" class="mt-1.5 block text-sm text-[#6b7a8d] leading-[1.4]">
            {{ profileSubtitle }}
          </text>
        </view>

        <!-- 右箭头 -->
        <view v-if="!tokenStore.hasLogin" class="i-carbon-chevron-right ml-2 flex-shrink-0 text-2xl text-[#bec7d4]" />
      </view>
    </view>

    <!-- 常用功能 -->
    <view class="relative z-1 mx-4 mt-4">
      <text class="mx-1 mb-2 block text-base text-[#263249] font-700">常用功能</text>
      <view class="rounded-2xl bg-white px-0.5 py-2 shadow-[0_4rpx_20rpx_rgba(42,92,178,0.08)]">
        <view class="grid grid-cols-3">
          <view
            v-for="shortcut in resumeShortcuts"
            :key="shortcut.label"
            class="min-h-158rpx min-w-0 flex flex-col cursor-pointer items-center justify-center text-sm text-[#263249] leading-[1.4] active:bg-[#f7f9fd]"
            role="button"
            @tap="handleResumeShortcut(shortcut.label)"
          >
            <view class="mb-2 text-xl text-brand-blue leading-none" :class="shortcut.icon" />
            <text class="font-500">{{ shortcut.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 求职服务 -->
    <view class="relative z-1 mx-4 mt-4">
      <text class="mx-1 mb-2 block text-base text-[#263249] font-700">其他功能</text>
      <view class="rounded-2xl bg-white px-3.5 shadow-[0_4rpx_20rpx_rgba(42,92,178,0.08)]">
        <view class="min-h-116rpx flex cursor-pointer items-center border-b-1rpx border-b-[#edf1f7] border-b-solid last:border-b-0 active:opacity-70" @tap="handleCertification">
          <view class="i-carbon-certificate mr-3 w-44rpx flex flex-[0_0_44rpx] items-center justify-center text-xl text-brand-blue leading-none" />
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="text-sm text-[#263249] font-600">{{ userInfo.isInternalEmployee ? '更改认证' : '员工认证' }}</text>
            <text class="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#9aa5b5]">{{ userInfo.isInternalEmployee ? `邮箱：${userInfo.email}` : '验证员工身份，解锁更多权益' }}</text>
          </view>
          <view class="i-carbon-chevron-right ml-2 text-base text-[#bec7d4] leading-none" />
        </view>
        <view class="min-h-116rpx flex cursor-pointer items-center border-b-1rpx border-b-[#edf1f7] border-b-solid last:border-b-0 active:opacity-70" @tap="handleNotificationTap">
          <view class="i-carbon-notification mr-3 w-44rpx flex flex-[0_0_44rpx] items-center justify-center text-xl text-brand-blue leading-none" />
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="text-sm text-[#263249] font-600">消息通知</text>
            <text class="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#9aa5b5]">职位进展与面试提醒</text>
          </view>
          <view class="i-carbon-chevron-right ml-2 text-base text-[#bec7d4] leading-none" />
        </view>
        <view class="min-h-116rpx flex cursor-pointer items-center border-b-1rpx border-b-[#edf1f7] border-b-solid last:border-b-0 active:opacity-70" @tap="handleProfileSettings">
          <view class="i-carbon-settings mr-3 w-44rpx flex flex-[0_0_44rpx] items-center justify-center text-xl text-brand-blue leading-none" />
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="text-sm text-[#263249] font-600">账号设置</text>
            <text class="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#9aa5b5]">个人信息</text>
          </view>
          <view class="i-carbon-chevron-right ml-2 text-base text-[#bec7d4] leading-none" />
        </view>
        <view
          class="min-h-116rpx flex cursor-pointer items-center border-b-1rpx border-b-[#edf1f7] border-b-solid last:border-b-0 active:opacity-70"
          role="link"
          @tap="handleLegalTap(PRIVACY_PAGE)"
        >
          <view class="i-carbon-locked mr-3 w-44rpx flex flex-[0_0_44rpx] items-center justify-center text-xl text-brand-blue leading-none" />
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="text-sm text-[#263249] font-600">隐私政策</text>
          </view>
          <view class="i-carbon-chevron-right ml-2 text-base text-[#bec7d4] leading-none" />
        </view>
      </view>
    </view>

    <!-- 已登录：退出登录 -->
    <view class="relative z-1 mx-4 mb-8 mt-4">
      <view
        v-if="tokenStore.hasLogin"
        class="min-h-92rpx flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white text-sm text-[#df555b] font-600 shadow-[0_4rpx_20rpx_rgba(42,92,178,0.08)] active:bg-[#fff7f7]"
        role="button"
        @tap="handleLogout"
      >
        <view class="i-carbon-logout text-base" />
        <text>退出登录</text>
      </view>
    </view>
  </view>
</template>
