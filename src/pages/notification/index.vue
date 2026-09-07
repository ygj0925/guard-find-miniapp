<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { useTokenStore } from '@/store/token'
import { tabbarStore } from '@/tabbar/store'
import { toLoginPage } from '@/utils/toLoginPage'

defineOptions({
  name: 'Notification',
})

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '消息',
    backgroundColor: '#EDF6FF',
  },
})

type NotificationKind = 'interview' | 'resume' | 'status'

interface NotificationItem {
  id: string
  kind: NotificationKind
  title: string
  subtitle: string
  description: string
  time: string
  unread: boolean
}

interface NotificationKindMeta {
  iconClass: string
  surfaceClass: string
}

const NOTIFICATION_PATH = '/pages/notification/index'
const POSITION_PATH = '/pages/position/index'

const kindMeta: Record<NotificationKind, NotificationKindMeta> = {
  interview: {
    iconClass: 'i-carbon-calendar',
    surfaceClass: 'bg-[#EAF1FF] text-app-info',
  },
  resume: {
    iconClass: 'i-carbon-document',
    surfaceClass: 'bg-[#EBFAF5] text-app-success',
  },
  status: {
    iconClass: 'i-carbon-task-complete',
    surfaceClass: 'bg-[#F3EEFF] text-brand-violet',
  },
}

const tokenStore = useTokenStore()
const reminderDismissed = ref(false)
const reminderEnabled = ref(false)
const notifications = ref<NotificationItem[]>([
  {
    id: 'interview-20260830',
    kind: 'interview',
    title: '面试邀请',
    subtitle: '三生制药 · 临床运营专员',
    description: '邀请你于 8月30日 14:00 参加线上面试',
    time: '10:26',
    unread: true,
  },
  {
    id: 'resume-supplement-01',
    kind: 'resume',
    title: '请补充简历',
    subtitle: '招聘经理希望了解你的项目经历和英语能力',
    description: '完善后将优先进入下一轮筛选',
    time: '09:48',
    unread: true,
  },
  {
    id: 'application-status-01',
    kind: 'status',
    title: '投递进展通知',
    subtitle: '研发管培生已进入简历筛选',
    description: '预计 3 个工作日内反馈结果',
    time: '昨天',
    unread: false,
  },
])

const isLoggedIn = computed(() => tokenStore.hasLogin)
const unreadCount = computed(() => notifications.value.filter(item => item.unread).length)

function syncUnreadBadge() {
  const badge = isLoggedIn.value ? unreadCount.value : 0
  tabbarStore.setTabbarItemBadgeByPath(NOTIFICATION_PATH, badge)
}

function handleLogin() {
  toLoginPage({
    queryString: `?redirect=${encodeURIComponent(NOTIFICATION_PATH)}`,
  })
}

function handleExplorePositions() {
  uni.switchTab({ url: POSITION_PATH })
}

function handleEnableReminder() {
  reminderEnabled.value = true
  uni.showToast({
    title: '提醒设置已保存',
    icon: 'success',
  })
}

function handleDismissReminder() {
  reminderDismissed.value = true
}

function handleMessageTap(item: NotificationItem) {
  item.unread = false
  uni.showToast({
    title: '已查看消息',
    icon: 'none',
  })
}

function handleMarkAllRead() {
  if (unreadCount.value === 0)
    return

  notifications.value = notifications.value.map(item => ({ ...item, unread: false }))
  uni.showToast({
    title: '已全部标为已读',
    icon: 'none',
  })
}

watch([isLoggedIn, unreadCount], syncUnreadBadge, { immediate: true })

onShow(() => {
  tokenStore.updateNowTime()
  syncUnreadBadge()
})
</script>

<template>
  <view class="app-tab-page">
    <AppPageHeader title="消息" align="left" prominent>
      <template #right>
        <button
          v-if="isLoggedIn && unreadCount > 0"
          class="plain-button m-0 border-0 p-0 text-2xs text-app-info font-500 leading-none"
          aria-label="全部标为已读"
          @click="handleMarkAllRead"
        >
          全部已读
        </button>
      </template>
    </AppPageHeader>

    <view class="box-border flex flex-col gap-3 px-3 pb-3.5 pt-3">
      <template v-if="isLoggedIn">
        <view v-if="!reminderDismissed" class="subscription-card rounded-32rpx bg-white p-3.5">
          <view class="flex items-center gap-1.5">
            <view class="i-carbon-notification-filled text-lg text-app-info leading-none" />
            <text class="text-base text-app-ink font-700">
              {{ reminderEnabled ? '消息提醒已开启' : '收到以下消息提醒' }}
            </text>
          </view>

          <view class="mt-3 flex items-center justify-between px-px">
            <view class="flex items-center gap-1 text-app-muted">
              <view class="i-carbon-calendar text-sm leading-none" />
              <text class="text-xs font-500">面试邀请</text>
            </view>
            <view class="flex items-center gap-1 text-app-muted">
              <view class="i-carbon-document text-sm leading-none" />
              <text class="text-xs font-500">简历补充</text>
            </view>
            <view class="flex items-center gap-1 text-app-muted">
              <view class="i-carbon-email-new text-sm leading-none" />
              <text class="text-xs font-500">新消息</text>
            </view>
          </view>

          <view class="mt-3 flex gap-2">
            <button
              class="action-button plain-button m-0 h-80rpx flex flex-1 items-center justify-center border-0 rounded-full bg-[#EAF1FF] p-0 text-sm text-app-info font-600 leading-none"
              hover-class="button-pressed"
              aria-label="暂不接收消息提醒"
              @click="handleDismissReminder"
            >
              暂不提醒
            </button>
            <button
              class="action-button plain-button m-0 h-80rpx flex flex-1 items-center justify-center border-0 rounded-full bg-app-info p-0 text-sm text-white font-700 leading-none"
              hover-class="button-pressed"
              aria-label="开启消息提醒"
              @click="handleEnableReminder"
            >
              {{ reminderEnabled ? '已开启' : '开启提醒' }}
            </button>
          </view>
        </view>

        <view v-if="notifications.length > 0" class="message-list-card overflow-hidden rounded-32rpx bg-white px-3.5 pb-0.5 pt-3">
          <view class="h-60rpx flex items-center justify-between">
            <text class="text-sm text-app-ink font-700">最近消息</text>
            <view v-if="unreadCount > 0" class="flex items-center gap-1 rounded-full bg-[#FFF1F3] px-2 py-1">
              <view class="h-11rpx w-11rpx rounded-full bg-app-danger" />
              <text class="text-2xs text-app-danger font-600">{{ unreadCount }} 条未读</text>
            </view>
          </view>

          <view
            v-for="(notification, index) in notifications"
            :key="notification.id"
            class="message-row flex cursor-pointer items-start gap-2.5 py-3.5"
            :class="index < notifications.length - 1 ? 'border-b-1rpx border-b-[#E9EEF7]' : ''"
            role="button"
            :aria-label="`查看${notification.title}`"
            hover-class="message-row--pressed"
            @click="handleMessageTap(notification)"
          >
            <view
              class="h-78rpx w-78rpx flex flex-[0_0_78rpx] items-center justify-center rounded-23rpx text-lg leading-none"
              :class="kindMeta[notification.kind].surfaceClass"
            >
              <view :class="kindMeta[notification.kind].iconClass" />
            </view>

            <view class="min-w-0 flex-1">
              <view class="flex items-center justify-between gap-1.5">
                <view class="min-w-0 flex items-center gap-1.5">
                  <text class="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-app-ink font-700">
                    {{ notification.title }}
                  </text>
                  <view v-if="notification.unread" class="h-12rpx w-12rpx flex-[0_0_12rpx] rounded-full bg-app-danger" />
                </view>
                <text class="flex-none text-2xs text-app-muted">{{ notification.time }}</text>
              </view>
              <text class="mt-1 block text-xs text-app-ink-soft font-500 leading-[1.45]">
                {{ notification.subtitle }}
              </text>
              <text class="mt-1 block text-2xs text-app-muted leading-[1.45]">
                {{ notification.description }}
              </text>
            </view>
          </view>
        </view>

        <view v-else class="empty-card min-h-820rpx flex flex-col items-center justify-center rounded-32rpx bg-white px-5 py-7">
          <image
            class="h-300rpx w-360rpx rounded-28rpx"
            src="https://static1.3sbio.com/assets/lingcai/DjcLa.png"
            mode="aspectFit"
            aria-label="蓝色消息盒插画"
          />
          <text class="mt-3 block text-base text-app-ink font-700">暂无历史消息</text>
          <text class="mt-1.5 block text-center text-xs text-app-muted leading-[1.6]">投递简历后，面试和进展消息都会在这里同步</text>
          <button
            class="action-button plain-button mx-0 mt-4 h-88rpx w-300rpx flex items-center justify-center border-0 rounded-full bg-app-info p-0 text-sm text-white font-700 leading-none"
            hover-class="button-pressed"
            @click="handleExplorePositions"
          >
            去看看职位
          </button>
        </view>
      </template>

      <view v-else class="empty-card min-h-900rpx flex flex-col items-center justify-center rounded-32rpx bg-white px-4.5 py-7.5">
        <image
          class="h-308rpx w-368rpx rounded-28rpx"
          src="https://static1.3sbio.com/assets/lingcai/DjcLa.png"
          mode="aspectFit"
          aria-label="蓝色消息盒插画"
        />
        <text class="mt-3.5 block text-lg text-app-ink font-700">登录后查看消息</text>
        <text class="mt-2 block whitespace-pre-line text-center text-xs text-app-muted leading-[1.65]">
          {{ '面试邀请、简历补充和投递进展\n都会在这里及时同步' }}
        </text>

        <view class="mt-3 flex items-center justify-center gap-1.5">
          <view class="flex items-center gap-1 rounded-full bg-[#EAF1FF] px-2 py-1.5 text-app-info">
            <view class="i-carbon-calendar text-xs leading-none" />
            <text class="text-2xs font-600">面试</text>
          </view>
          <view class="flex items-center gap-1 rounded-full bg-[#EAF1FF] px-2 py-1.5 text-app-info">
            <view class="i-carbon-document text-xs leading-none" />
            <text class="text-2xs font-600">简历</text>
          </view>
          <view class="flex items-center gap-1 rounded-full bg-[#EAF1FF] px-2 py-1.5 text-app-info">
            <view class="i-carbon-notification text-xs leading-none" />
            <text class="text-2xs font-600">进展</text>
          </view>
        </view>

        <button
          class="action-button login-button plain-button mx-0 mt-4 h-90rpx w-420rpx flex items-center justify-center border-0 rounded-full bg-app-info p-0 text-sm text-white font-700 leading-none"
          hover-class="button-pressed"
          aria-label="登录或注册"
          @click="handleLogin"
        >
          登录 / 注册
        </button>
        <button
          class="plain-button mx-0 mt-3 flex items-center gap-1 border-0 p-0 text-xs text-app-info font-500 leading-none"
          hover-class="link-pressed"
          @click="handleExplorePositions"
        >
          <text>先看看职位</text>
          <view class="i-carbon-arrow-right text-xs leading-none" />
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.plain-button::after {
  border: 0;
}

.subscription-card,
.message-list-card,
.empty-card {
  box-shadow: 0 8rpx 32rpx rgba(55, 94, 174, 0.08);
}

.action-button,
.message-row,
.plain-button {
  transition:
    opacity 180ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.button-pressed {
  opacity: 0.88;
  transform: scale(0.985);
}

.message-row--pressed,
.link-pressed {
  opacity: 0.72;
}

.login-button {
  box-shadow: 0 14rpx 34rpx rgba(57, 116, 246, 0.22);
}

@media (prefers-reduced-motion: reduce) {
  .action-button,
  .message-row,
  .plain-button {
    transition: none;
  }
}
</style>
