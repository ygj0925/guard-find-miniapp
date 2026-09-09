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

/** 后端 MessageTypeEnum 的业务类型取值，目前只有投递进度；未来新增类型时在此补充映射即可。 */
const typeMetaMap: Record<number, TypeMeta> = {
  3: { iconClass: 'i-carbon-task-complete', surfaceClass: 'bg-[#F3EEFF] text-brand-violet', label: '投递进度' },
}
const DEFAULT_TYPE_META: TypeMeta = { iconClass: 'i-carbon-notification', surfaceClass: 'bg-[#EAF1FF] text-app-info', label: '通知消息' }

function typeMetaOf(type: number): TypeMeta {
  return typeMetaMap[type] ?? DEFAULT_TYPE_META
}

/**
 * 列表项副标题：按业务类型渲染真实业务信息，让用户不点进去也能看到关键内容。
 *
 * 未知 bizType（后端新增了小程序还不认识的类型）或历史纯文本消息，回退显示类型描述，
 * 保证卡片不会出现空白行。
 */
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

/** 投递进度卡片专有的第二行：当前状态；其它类型返回空串不渲染该行。 */
function applyStatusOf(message: MiniappMessage): string {
  return message.bizType === 'APPLY_PROGRESS' ? (message.data as ApplyProgressData).statusName : ''
}

function toDisplayTime(dateStr: string) {
  if (!dateStr)
    return ''
  // iOS 的 Date 构造函数不支持 "yyyy-MM-dd HH:mm:ss"（空格分隔），要转成 "yyyy-MM-ddTHH:mm:ss"
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
const reminderDismissed = ref(false)
const reminderEnabled = ref(false)

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

// 三个状态卡用互斥的独立 v-if，而不是 v-if/v-else-if/v-else 条件链：
// 这条链位于 <template v-if="isLoggedIn"> 内、且前面紧邻另一个兄弟 v-if（提醒卡），
// 实测视图层已拿到列表分支为 true 的渲染数据，却仍然渲染了 v-else 的空状态卡
// （selectorQuery 查不到 .message-list-card 节点），导致有消息也显示"暂无历史消息"。
// 拆成独立条件后不依赖链式求值，条件本身保证三者互斥。
const showLoadingCard = computed(() => loading.value && !notifications.value.length)
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

async function handleMessageTap(item: MiniappMessage) {
  const wasUnread = !item.isRead
  item.isRead = true
  try {
    // 详情接口会在服务端同时标记该消息已读
    await getMiniappMessageDetail(item.id)
  }
  catch {
    // 标记已读失败不影响跳转，下次刷新会重新拉到真实已读状态
  }
  if (wasUnread)
    messageStore.refreshUnreadCount()

  if (item.path) {
    uni.navigateTo({ url: item.path })
  }
  else {
    uni.showToast({ title: '已查看消息', icon: 'none' })
  }
}

async function handleMarkAllRead() {
  if (unreadCount.value === 0)
    return

  try {
    await readAllMiniappMessages()
    notifications.value = notifications.value.map(item => ({ ...item, isRead: true }))
    uni.showToast({ title: '已全部标为已读', icon: 'none' })
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

// 停留在本页时收到 WS 推送只会更新未读数，列表不会自动重拉；未读数变多时主动重新拉取，
// 保证新消息不需要切出再切回才能看到。
// loading 中跳过：onShow 本身会同时触发 refreshUnreadCount 和 loadMessages，未读数
// 刷新更快时会在 loadMessages 请求还没返回前先触发这里，形成两个并发的 reset 请求，
// requestVersion 竞态会导致先完成、真正带着新数据的那个请求被当成"过期响应"丢弃。
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

        <view v-if="showLoadingCard" class="empty-card min-h-820rpx flex flex-col items-center justify-center rounded-32rpx bg-white px-5 py-7">
          <text class="text-sm text-app-muted">加载中...</text>
        </view>

        <view v-if="showMessageList" class="message-list-card overflow-hidden rounded-32rpx bg-white px-3.5 pb-0.5 pt-3">
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
              :class="typeMetaOf(notification.type).surfaceClass"
            >
              <view :class="typeMetaOf(notification.type).iconClass" />
            </view>

            <view class="min-w-0 flex-1">
              <view class="flex items-center justify-between gap-1.5">
                <view class="min-w-0 flex items-center gap-1.5">
                  <text class="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-app-ink font-700">
                    {{ notification.title }}
                  </text>
                  <view v-if="!notification.isRead" class="h-12rpx w-12rpx flex-[0_0_12rpx] rounded-full bg-app-danger" />
                </view>
                <text class="flex-none text-2xs text-app-muted">{{ toDisplayTime(notification.createTime) }}</text>
              </view>
              <text class="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-app-ink-soft font-500 leading-[1.45]">
                {{ summaryOf(notification) }}
              </text>
              <text v-if="applyStatusOf(notification)" class="mt-0.5 block text-2xs text-app-muted leading-[1.45]">
                当前状态：{{ applyStatusOf(notification) }}
              </text>
            </view>
          </view>

          <view v-if="loading" class="py-3.5 text-center text-2xs text-app-muted">
            加载中...
          </view>
          <view v-else-if="loadFailed" class="py-3.5 text-center text-2xs text-app-danger">
            加载失败，下拉页面重试
          </view>
          <view v-else-if="!hasMore" class="py-3.5 text-center text-2xs text-app-muted">
            没有更多了
          </view>
        </view>

        <view v-if="showEmptyCard" class="empty-card min-h-820rpx flex flex-col items-center justify-center rounded-32rpx bg-white px-5 py-7">
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
