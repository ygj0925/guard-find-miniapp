<script setup lang="ts">
import { onHide, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import { getMiniappMessageDetail, getMiniappMessagePage, readAllMiniappMessages } from '@/api/message'
import type { ApplyProgressData, MiniappMessage, OfferConfirmData, PreOnboardData } from '@/api/message'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { useMessageStore } from '@/store/message'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

defineOptions({
  name: 'Notification',
})

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '消息',
    backgroundColor: '#EDF6FF',
    enablePullDownRefresh: true,
  },
})

interface TypeMeta {
  iconClass: string
  surfaceClass: string
  label: string
}

const NOTIFICATION_PATH = '/pages/notification/index'
const POSITION_PATH = '/pages/position/index'
const PAGE_SIZE = 20

const typeMetaMap: Record<number, TypeMeta> = {
  3: { iconClass: 'i-carbon-task-complete', surfaceClass: 'bg-[#F3EEFF] text-brand-violet', label: '投递进度' },
}
const DEFAULT_TYPE_META: TypeMeta = { iconClass: 'i-carbon-notification', surfaceClass: 'bg-[#EAF1FF] text-app-info', label: '通知消息' }

function typeMetaOf(type: number): TypeMeta {
  return typeMetaMap[type] ?? DEFAULT_TYPE_META
}

function summaryOf(message: MiniappMessage): string {
  switch (message.bizType) {
    case 'APPLY_PROGRESS': {
      const data = message.data as ApplyProgressData
      return `${data.positionName} · ${data.phaseName}`
    }
    case 'OFFER_CONFIRM': {
      const data = message.data as OfferConfirmData
      return `${data.positionName} · ${data.deadline} 前确认`
    }
    case 'PRE_ONBOARD': {
      const data = message.data as PreOnboardData
      return `${data.positionName} · ${data.onboardDate} 报到`
    }
    default:
      return typeMetaOf(message.type).label
  }
}

function toDisplayTime(dateStr: string) {
  if (!dateStr)
    return ''
  const d = new Date(dateStr.replace(' ', 'T'))
  if (Number.isNaN(d.getTime()))
    return ''
  const now = new Date()
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays === 0)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (diffDays === 1)
    return '昨天'
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const tokenStore = useTokenStore()
const messageStore = useMessageStore()
const bannerDismissed = ref(false)

const notifications = ref<MiniappMessage[]>([])
const total = ref(0)
const pageNum = ref(0)
const loading = ref(false)
const loadFailed = ref(false)
let requestVersion = 0

const isLoggedIn = computed(() => tokenStore.hasLogin)
const hasMore = computed(() => notifications.value.length < total.value)
const unreadCount = computed(() => messageStore.unreadCount)
const pageVisible = ref(false)

const hasUnread = computed(() => notifications.value.some(n => !n.isRead))
const showMessageList = computed(() => notifications.value.length > 0)
const showEmptyCard = computed(() => !loading.value && !notifications.value.length)

async function loadMessages(reset = false) {
  if (!isLoggedIn.value)
    return
  if (!reset && (loading.value || !hasMore.value))
    return

  const version = reset ? ++requestVersion : requestVersion
  if (reset) {
    pageNum.value = 0
    loadFailed.value = false
  }
  loading.value = true
  const nextPageNum = reset ? 1 : pageNum.value + 1
  try {
    const page = await getMiniappMessagePage({ page: nextPageNum, size: PAGE_SIZE })
    if (version !== requestVersion)
      return
    notifications.value = reset ? page.list : [...notifications.value, ...page.list]
    total.value = page.total
    pageNum.value = nextPageNum
    loadFailed.value = false
  }
  catch {
    if (reset && version === requestVersion)
      loadFailed.value = true
  }
  finally {
    if (version === requestVersion)
      loading.value = false
  }
}

function handleLogin() {
  toLoginPage({
    queryString: `?redirect=${encodeURIComponent(NOTIFICATION_PATH)}`,
  })
}

function handleExplorePositions() {
  uni.switchTab({ url: POSITION_PATH })
}

async function handleMessageTap(item: MiniappMessage) {
  const wasUnread = !item.isRead
  item.isRead = true
  try {
    await getMiniappMessageDetail(item.id)
  }
  catch {
    // 标记已读失败不影响跳转
  }
  if (wasUnread)
    messageStore.refreshUnreadCount()

  if (item.path)
    uni.navigateTo({ url: item.path })
}

async function handleMarkAllRead() {
  if (unreadCount.value === 0)
    return

  try {
    await readAllMiniappMessages()
    notifications.value = notifications.value.map(item => ({ ...item, isRead: true }))
    uni.showToast({ title: '已全部标为已读', icon: 'success' })
  }
  catch {
    uni.showToast({ title: '操作失败，请重试', icon: 'none' })
  }
  finally {
    messageStore.refreshUnreadCount()
  }
}

onShow(() => {
  pageVisible.value = true
  tokenStore.updateNowTime()
  if (isLoggedIn.value) {
    messageStore.refreshUnreadCount()
    loadMessages(true)
  }
})

onHide(() => {
  pageVisible.value = false
})

watch(unreadCount, (val, oldVal) => {
  if (pageVisible.value && isLoggedIn.value && val > oldVal && !loading.value)
    loadMessages(true)
})

onPullDownRefresh(async () => {
  if (isLoggedIn.value)
    await Promise.all([messageStore.refreshUnreadCount(), loadMessages(true)])
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadMessages()
})
</script>

<template>
  <view class="app-tab-page bg-[#EDF6FF]">
    <AppPageHeader title="消息" align="left" prominent />

    <template v-if="isLoggedIn">
      <!-- 消息通知栏 -->
      <view v-if="!bannerDismissed" class="flex items-start gap-2.5 bg-[#EFF6FF] px-4 py-3">
        <view class="i-carbon-notification-filled mt-px flex-shrink-0 text-base text-[#3974f6]" />
        <text class="min-w-0 flex-1 text-xs text-[#3974f6] leading-[1.6]">
          在这里可以查看投递进度，状态变更、材料准备、预入职通知等消息
        </text>
        <view
          class="i-carbon-close ml-1 mt-px flex-shrink-0 cursor-pointer text-sm text-[#3974f6]"
          @tap="bannerDismissed = true"
        />
      </view>

      <!-- 加载骨架屏 -->
      <view v-if="showLoadingCard" class="pb-4 pt-2">
        <view
          v-for="i in 5"
          :key="i"
          class="mb-2 flex items-center gap-3.5 bg-white px-4 py-3.5"
        >
          <view class="skeleton-block h-[52px] w-[52px] flex-shrink-0 rounded-[14px]" />
          <view class="flex-1 flex flex-col gap-2">
            <view class="flex items-center justify-between gap-2">
              <view class="skeleton-block h-4 w-2/5 rounded" />
              <view class="skeleton-block h-3 w-[50px] rounded" />
            </view>
            <view class="skeleton-block h-3 w-3/5 rounded" />
          </view>
        </view>
      </view>

      <!-- 消息列表 -->
      <view v-if="showMessageList" class="pb-6 pt-2">
        <view v-if="hasUnread" class="flex justify-end px-4 pb-2">
          <text
            class="text-xs text-app-info"
            @tap="handleMarkAllRead"
          >全部标为已读</text>
        </view>
        <view
          v-for="notification in notifications"
          :key="notification.id"
          class="message-row mb-2 flex cursor-pointer items-center gap-3.5 bg-white px-4 py-3.5 active:bg-[#f7f9fd]"
          role="button"
          :aria-label="`查看${notification.title}`"
          @tap="handleMessageTap(notification)"
        >
          <!-- 左侧图标 -->
          <view
            class="h-[52px] w-[52px] flex-shrink-0 flex items-center justify-center rounded-[14px] text-xl leading-none"
            :class="typeMetaOf(notification.type).surfaceClass"
          >
            <view :class="typeMetaOf(notification.type).iconClass" />
          </view>

          <!-- 右侧内容 -->
          <view class="min-w-0 flex-1 flex flex-col gap-1">
            <!-- 标题 + 时间 -->
            <view class="flex items-center gap-2">
              <text class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#1a1a1a] font-600">
                {{ notification.title }}
              </text>
              <text class="flex-shrink-0 text-xs text-[#aaa]">{{ toDisplayTime(notification.createTime) }}</text>
            </view>
            <!-- 摘要 + 未读标志 -->
            <view class="flex items-center gap-2">
              <text class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#999]">
                {{ summaryOf(notification) }}
              </text>
              <view
                v-if="!notification.isRead"
                class="h-[10px] w-[10px] flex-shrink-0 rounded-full bg-[#ff4d4f]"
              />
            </view>
          </view>
        </view>

        <view v-if="loading" class="py-4 text-center text-xs text-[#bbb]">加载中...</view>
        <view v-else-if="loadFailed" class="py-4 text-center text-xs text-[#ff4d4f]">加载失败，下拉页面重试</view>
        <view v-else-if="!hasMore" class="py-4 text-center text-xs text-[#ccc]">没有更多了</view>
      </view>

      <!-- 空状态 -->
      <view v-if="showEmptyCard" class="flex flex-col items-center justify-center px-8 py-24">
        <image
          class="h-300rpx w-360rpx rounded-[14px]"
          src="https://static1.3sbio.com/assets/lingcai/DjcLa.png"
          mode="aspectFit"
          aria-label="暂无消息插画"
        />
        <text class="mt-4 text-base text-[#1a2640] font-700">暂无历史消息</text>
        <text class="mt-2 block text-center text-xs text-[#9aa5b5] leading-[1.6]">
          投递简历后，面试和进展消息都会在这里同步
        </text>
        <button
          class="plain-button mt-6 h-10 flex items-center justify-center border-0 rounded-full bg-app-info px-7 text-sm text-white font-700 leading-none"
          @click="handleExplorePositions"
        >
          去看看职位
        </button>
      </view>
    </template>

    <!-- 未登录状态 -->
    <view v-else class="flex flex-col items-center justify-center px-8 py-20">
      <image
        class="h-300rpx w-360rpx rounded-[14px]"
        src="https://static1.3sbio.com/assets/lingcai/DjcLa.png"
        mode="aspectFit"
        aria-label="蓝色消息盒插画"
      />
      <text class="mt-4 text-lg text-[#1a2640] font-700">登录后查看消息</text>
      <text class="mt-2 block whitespace-pre-line text-center text-xs text-[#9aa5b5] leading-[1.65]">
        {{ '面试邀请、简历补充和投递进展\n都会在这里及时同步' }}
      </text>

      <view class="mt-3 flex items-center gap-1.5">
        <view class="flex items-center gap-1 rounded-full bg-[#EAF1FF] px-2.5 py-1.5 text-app-info">
          <view class="i-carbon-calendar text-xs leading-none" />
          <text class="text-2xs font-600">面试</text>
        </view>
        <view class="flex items-center gap-1 rounded-full bg-[#EAF1FF] px-2.5 py-1.5 text-app-info">
          <view class="i-carbon-document text-xs leading-none" />
          <text class="text-2xs font-600">简历</text>
        </view>
        <view class="flex items-center gap-1 rounded-full bg-[#EAF1FF] px-2.5 py-1.5 text-app-info">
          <view class="i-carbon-notification text-xs leading-none" />
          <text class="text-2xs font-600">进展</text>
        </view>
      </view>

      <button
        class="plain-button mt-5 h-[46px] w-[210px] flex items-center justify-center border-0 rounded-full bg-app-info text-sm text-white font-700 leading-none"
        style="box-shadow: 0 14rpx 34rpx rgba(57,116,246,0.22);"
        @click="handleLogin"
      >
        登录 / 注册
      </button>
      <button
        class="plain-button mt-3 flex items-center gap-1 border-0 p-0 text-xs text-app-info font-500 leading-none"
        @click="handleExplorePositions"
      >
        <text>先看看职位</text>
        <view class="i-carbon-arrow-right text-xs leading-none" />
      </button>
    </view>
  </view>
</template>

<style scoped>
.plain-button::after {
  border: 0;
}

.message-row {
  transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.skeleton-block {
  background: linear-gradient(90deg, #edf1f6 25%, #f7f9fc 42%, #edf1f6 64%);
  background-size: 300% 100%;
  animation: skeleton-shimmer 1.3s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-block {
    animation: none;
  }
}
</style>
