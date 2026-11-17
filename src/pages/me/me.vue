<script setup lang="ts">
/**
 * 我的页面:用户信息与常用服务,管家独立房源管理入口。
 */
import type { IUserInfoRes } from '@/api/types/login'
import { getUserInfo, logout } from '@/api/login'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { refreshMessageBadge, setMessageBadge } from '@/utils/messageBadge'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationStyle: 'custom',
    backgroundColor: '#F7F9FF',
  },
})

const userStore = useUserStore()
const appName = import.meta.env.VITE_APP_TITLE
const tokenStore = useTokenStore()
const profile = ref<IUserInfoRes | null>(null)
const failedAvatar = ref('')
let version = 0
onHide(() => {
  version++
})
onUnload(() => {
  version++
})
const shortcuts = [
  { label: '我的收藏', icon: 'i-carbon-star', url: '/pages/property/personal?kind=favorites' },
  { label: '浏览记录', icon: 'i-carbon-time', url: '/pages/property/personal?kind=history' },
  { label: '看房预约', icon: 'i-carbon-calendar', url: '/pages/property/bookings' },
]
const agreements = [
  { type: 'user', label: '用户协议', icon: 'i-carbon-document' },
  { type: 'privacy', label: '隐私政策', icon: 'i-carbon-security' },
] as const

function openAgreement(type: 'user' | 'privacy') {
  uni.navigateTo({ url: `/pages/agreement/index?type=${type}` })
}

function go(url: string) {
  if (requireLogin())
    uni.navigateTo({ url })
}

onShow(() => {
  const current = ++version
  tokenStore.updateNowTime()
  void refreshMessageBadge()
  if (!tokenStore.hasLogin) {
    profile.value = null
    return
  }
  const accessToken = tokenStore.validToken
  getUserInfo()
    .then((info) => {
      if (current !== version || !tokenStore.updateNowTime().hasLogin || accessToken !== tokenStore.validToken)
        return
      profile.value = info
      userStore.setUserInfo(info)
    })
    .catch(() => {})
})

function requireLogin(): boolean {
  tokenStore.updateNowTime()
  if (tokenStore.hasLogin)
    return true
  toLoginPage()
  return false
}

function goSupport() {
  if (!requireLogin())
    return
  uni.navigateTo({
    url: '/pages/message/chat?mode=support',
  })
}

function onLogout() {
  uni.showModal({
    title: '退出登录',
    content: '退出后仍可浏览房源，收藏、预约和消息服务需重新登录。',
    confirmText: '退出登录',
    cancelText: '继续使用',
    confirmColor: '#3569DF',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await logout()
      }
      catch {}
      version++
      tokenStore.clearLoginState()
      userStore.clearUserInfo()
      profile.value = null
      setMessageBadge(0)
      uni.showToast({ title: '已退出', icon: 'none' })
    },
  })
}
</script>

<template>
  <view class="pencil-page profile-page app-tab-page">
    <view class="profile-content app-content pb-48rpx pt-40rpx">
      <text class="mb-40rpx block text-64rpx font-bold leading-80rpx">我的</text>

      <view class="app-panel overflow-hidden p-32rpx">
        <view class="min-w-0 flex items-center gap-24rpx py-8rpx">
          <image
            v-if="tokenStore.hasLogin && profile?.avatar && profile.avatar !== failedAvatar"
            :src="profile.avatar"
            mode="aspectFill"
            class="h-144rpx w-144rpx shrink-0 rounded-full bg-app-soft"
            aria-hidden="true"
            @error="failedAvatar = profile.avatar"
          />
          <view
            v-else
            class="h-144rpx w-144rpx flex shrink-0 items-center justify-center rounded-full bg-app-soft text-brand-blue"
            aria-hidden="true"
          >
            <view class="i-carbon-user h-72rpx w-72rpx" />
          </view>
          <view class="min-w-0 flex-1">
            <text class="block truncate text-40rpx font-bold leading-56rpx">
              {{ tokenStore.hasLogin ? (profile?.nickname || '已登录用户') : '未登录' }}
            </text>
            <text class="mt-8rpx block text-28rpx text-app-ink-soft leading-40rpx">
              {{ tokenStore.hasLogin ? '收藏房源，查看预约与消息' : '登录后使用收藏与消息服务' }}
            </text>
          </view>
        </view>
        <button
          v-if="!tokenStore.hasLogin"
          class="app-tap mt-24rpx app-primary-button w-full"
          aria-label="登录账号"
          @tap="requireLogin"
        >
          登录账号
        </button>

        <button
          v-else
          class="app-tap mt-24rpx app-secondary-button w-full"
          aria-label="编辑昵称和头像"
          @tap="go('/pages/me/profile')"
        >
          编辑资料
        </button>

        <view class="mt-32rpx flex border-0 border-t border-app-border border-solid pt-16rpx">
          <button
            v-for="entry in shortcuts"
            :key="entry.url"
            class="app-tap min-h-144rpx min-w-0 flex flex-1 flex-col items-center justify-center gap-16rpx border-0 border-r border-app-border border-solid bg-white px-8rpx py-24rpx text-center leading-normal last:border-r-0"
            :aria-label="entry.label"
            @tap="go(entry.url)"
          >
            <view :class="entry.icon" class="h-56rpx w-56rpx text-brand-blue" aria-hidden="true" />
            <text class="block text-28rpx text-app-ink leading-40rpx">{{ entry.label }}</text>
          </button>
        </view>
      </view>

      <view class="mt-40rpx">
        <text class="block app-section-title">我的服务</text>
        <view class="mt-20rpx app-panel overflow-hidden">
          <button
            class="app-tap min-h-136rpx w-full flex items-center gap-24rpx border-0 border-b border-app-border border-solid bg-white p-32rpx text-left leading-normal"
            aria-label="我的租约，合同签署与续租"
            @tap="go('/pages/property/leases')"
          >
            <view class="i-carbon-document h-48rpx w-48rpx shrink-0 text-brand-blue" aria-hidden="true" />
            <view class="min-w-0 flex-1">
              <text class="block text-32rpx text-app-ink leading-44rpx">我的租约</text><text class="mt-6rpx block text-24rpx text-app-muted">合同签署 · 续租申请 · 临期提醒</text>
            </view>
            <view class="i-carbon-chevron-right h-36rpx w-36rpx shrink-0 text-app-muted" aria-hidden="true" />
          </button>
          <button
            class="app-tap min-h-136rpx w-full flex items-center gap-24rpx border-0 border-b border-app-border border-solid bg-white p-32rpx text-left leading-normal"
            aria-label="查看业务通知"
            @tap="go('/pages/message/notices')"
          >
            <view class="i-carbon-notification h-48rpx w-48rpx shrink-0 text-brand-blue" aria-hidden="true" />
            <text class="min-w-0 flex-1 text-32rpx text-app-ink leading-44rpx">业务通知</text>
            <view class="i-carbon-chevron-right h-36rpx w-36rpx shrink-0 text-app-muted" aria-hidden="true" />
          </button>
          <button
            class="app-tap min-h-136rpx w-full flex items-center gap-24rpx bg-white p-32rpx text-left leading-normal"
            aria-label="联系公寓管家"
            @tap="goSupport"
          >
            <view class="i-carbon-headset h-48rpx w-48rpx shrink-0 text-brand-blue" aria-hidden="true" />
            <text class="min-w-0 flex-1 text-32rpx text-app-ink leading-44rpx">联系公寓管家</text>
            <view class="i-carbon-chevron-right h-36rpx w-36rpx shrink-0 text-app-muted" aria-hidden="true" />
          </button>
        </view>
      </view>

      <!-- 仅管家可见,发布与维护沿用现有房源列表能力 -->
      <view v-if="tokenStore.hasLogin && profile?.isPropertyManager" class="mt-24rpx app-panel overflow-hidden">
        <button
          class="app-tap min-h-152rpx w-full flex items-center gap-24rpx bg-white p-32rpx text-left leading-normal"
          aria-label="房源管理，发布与维护房源"
          @tap="go('/pages/property/personal?kind=mine')"
        >
          <view class="i-carbon-building h-48rpx w-48rpx shrink-0 text-brand-blue" aria-hidden="true" />
          <view class="min-w-0 flex-1">
            <text class="block text-32rpx text-app-ink font-semibold leading-44rpx">房源管理</text>
            <text class="mt-8rpx block text-28rpx text-app-muted leading-40rpx">发布与维护房源</text>
          </view>
          <view class="i-carbon-chevron-right h-36rpx w-36rpx shrink-0 text-app-muted" aria-hidden="true" />
        </button>
      </view>

      <view class="mt-24rpx app-panel overflow-hidden">
        <button
          v-for="(doc, index) in agreements"
          :key="doc.type"
          class="app-tap min-h-120rpx w-full flex items-center gap-24rpx border-0 border-app-border border-solid bg-white px-32rpx text-left leading-normal"
          :class="index < agreements.length - 1 ? 'border-b' : ''"
          :aria-label="`查看${doc.label}`"
          @tap="openAgreement(doc.type)"
        >
          <view :class="doc.icon" class="h-44rpx w-44rpx shrink-0 text-app-muted" aria-hidden="true" />
          <text class="min-w-0 flex-1 text-30rpx text-app-ink-soft leading-44rpx">{{ doc.label }}</text>
          <view class="i-carbon-chevron-right h-36rpx w-36rpx shrink-0 text-app-muted" aria-hidden="true" />
        </button>
      </view>

      <button
        v-if="tokenStore.hasLogin"
        class="app-tap mt-32rpx min-h-44px w-full flex items-center justify-center gap-16rpx bg-transparent py-24rpx text-28rpx text-app-muted leading-40rpx"
        aria-label="退出当前账号登录"
        @tap="onLogout"
      >
        <view class="i-carbon-logout h-36rpx w-36rpx shrink-0" aria-hidden="true" />
        <text>退出登录</text>
      </button>
      <view class="mt-40rpx text-center text-24rpx text-app-muted leading-36rpx">
        {{ appName }} · 管家服务
      </view>
    </view>
  </view>
</template>

<style scoped>
.profile-page {
  padding-bottom: calc(var(--app-page-bottom-safe) + 40rpx);
}
.profile-content {
  padding-top: calc(var(--status-bar-height, 0px) + 52rpx);
}
.profile-content > text:first-child {
  margin-bottom: 32rpx;
  color: #173b92;
  font-size: 45rpx;
  line-height: 60rpx;
}
.profile-content > .app-panel {
  border-radius: 38rpx;
  box-shadow: 0 6rpx 19rpx #c6d2ea44;
}
.profile-content .app-panel {
  border-color: #edf1fa;
}
.profile-content .app-section-title {
  color: #26365e;
}
.profile-content .app-tap:active {
  opacity: 0.76;
}
</style>
