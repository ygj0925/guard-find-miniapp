<script setup lang="ts">
/**
 * 消息沟通页:会话列表(未读角标)+ 公寓管家固定入口。
 * WebSocket 推送触发单飞刷新，可见期间轮询兜底。
 */
import type { ImConversation } from '@/api/im'
import type { ImSocketEvent } from '@/utils/imSocket'
import { computed } from 'vue'
import { deleteConversation, fetchConversations, fetchSupportUnread } from '@/api/im'
import { useTokenStore } from '@/store/token'
import { debounce } from '@/utils/debounce'
import { disconnectImSocket, isImSocketConnected, subscribeImSocket } from '@/utils/imSocket'
import { countUnread, setMessageBadge } from '@/utils/messageBadge'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationBarTitleText: '消息',
    backgroundColor: '#F7F8FA',
    enablePullDownRefresh: true,
  },
})

const conversations = ref<ImConversation[]>([])
const supportUnread = ref(0)
const failedAvatars = ref<string[]>([])
const loading = ref(false)
const error = ref(false)
const tokenStore = useTokenStore()
const isAuthenticated = computed(() => Boolean(tokenStore.validToken))
let visible = false
let version = 0
let sessionToken = ''
let inFlight: Promise<void> | undefined
let queued = false
let timer: ReturnType<typeof setTimeout> | undefined
let unsubscribeSocket: (() => void) | undefined

function requireLogin(): boolean {
  if (tokenStore.updateNowTime().validToken)
    return true
  toLoginPage()
  return false
}

const refreshSoon = debounce(() => void load(), 400)

function onSocketEvent(event: ImSocketEvent) {
  if (visible && (event.action === 'new_message' || event.action === 'admin_message'))
    refreshSoon()
}

function stop() {
  version++
  clearTimeout(timer)
  timer = undefined
  queued = false
  inFlight = undefined
  loading.value = false
  refreshSoon.cancel()
  unsubscribeSocket?.()
  unsubscribeSocket = undefined
}

function activate() {
  stop()
  sessionToken = tokenStore.updateNowTime().validToken
  if (!visible || !sessionToken) {
    conversations.value = []
    supportUnread.value = 0
    error.value = false
    setMessageBadge(0)
    return
  }
  unsubscribeSocket = subscribeImSocket(onSocketEvent, sessionToken, () => void load())
  void load()
}

watch(() => tokenStore.validToken, (token) => {
  if (token === sessionToken)
    return
  stop()
  if (!token)
    disconnectImSocket()
  sessionToken = token
  conversations.value = []
  supportUnread.value = 0
  setMessageBadge(0)
  if (visible)
    activate()
}, { flush: 'sync' })

function hide() {
  visible = false
  stop()
}
onHide(hide)
onUnload(hide)

function load(): Promise<void> {
  if (!visible || !sessionToken || tokenStore.updateNowTime().validToken !== sessionToken)
    return Promise.resolve()
  if (inFlight) {
    queued = true
    return inFlight
  }
  clearTimeout(timer)
  timer = undefined
  const current = version
  const token = sessionToken
  const isCurrent = () => visible && current === version && tokenStore.validToken === token
  loading.value = true
  error.value = false
  inFlight = (async () => {
    try {
      const [data, unread] = await Promise.all([fetchConversations(), fetchSupportUnread()])
      if (isCurrent()) {
        conversations.value = data
        supportUnread.value = unread
        setMessageBadge(countUnread(data, unread))
      }
    }
    catch {
      if (isCurrent())
        error.value = true
    }
    finally {
      if (isCurrent()) {
        loading.value = false
        inFlight = undefined
        const delay = queued ? 0 : isImSocketConnected() ? 15000 : 3000
        queued = false
        timer = setTimeout(() => void load(), delay)
      }
    }
  })()
  return inFlight
}

function goChat(conv: ImConversation) {
  const name = encodeURIComponent(conv.peerNickname || '用户')
  uni.navigateTo({
    url: `/pages/message/chat?convId=${conv.id}&peerId=${conv.peerUserId}&peerName=${name}`,
  })
}

async function removeConversation(conv: ImConversation) {
  const token = sessionToken
  const action = await uni.showActionSheet({ itemList: ['删除会话'] }).catch(() => undefined)
  if (action?.tapIndex !== 0)
    return
  const { confirm } = await uni.showModal({
    title: '删除会话',
    content: '会话将从列表移除，对方再次发消息时会重新出现。',
    confirmText: '删除',
    confirmColor: '#D93025',
  })
  if (!confirm || tokenStore.validToken !== token)
    return
  try {
    await deleteConversation(conv.id)
    if (tokenStore.validToken !== token)
      return
    conversations.value = conversations.value.filter(item => item.id !== conv.id)
    setMessageBadge(countUnread(conversations.value, supportUnread.value))
    uni.showToast({ icon: 'none', title: '已删除' })
    void load()
  }
  catch {}
}

function goSupport() {
  if (!requireLogin())
    return
  uni.navigateTo({
    url: '/pages/message/chat?mode=support',
  })
}

function goNotices() {
  if (!requireLogin())
    return
  uni.navigateTo({ url: '/pages/message/notices' })
}

function goBrowse() {
  uni.switchTab({ url: '/pages/index/index' })
}

function conversationTime(value: ImConversation['lastTime']): string {
  if (!value)
    return ''
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!match)
    return value
  const [, year, month, day, hour, minute] = match
  const now = new Date()
  if (Number(year) === now.getFullYear() && Number(month) === now.getMonth() + 1 && Number(day) === now.getDate())
    return `${hour}:${minute}`
  return Number(year) === now.getFullYear() ? `${month}-${day} ${hour}:${minute}` : `${year}-${month}-${day}`
}

onShow(() => {
  visible = true
  activate()
})
onPullDownRefresh(() => {
  load().finally(() => uni.stopPullDownRefresh())
})
</script>

<template>
  <view class="message-page app-tab-page bg-app-surface text-app-ink">
    <view class="app-content pb-48rpx pt-40rpx">
      <view class="mb-40rpx">
        <text class="block text-64rpx font-bold leading-80rpx">消息</text>
        <text class="mt-12rpx block text-28rpx text-app-ink-soft leading-40rpx">
          房源咨询与看房动态
        </text>
      </view>

      <view v-if="!isAuthenticated" class="guest-state app-panel">
        <view class="guest-icon" aria-hidden="true">
          <view class="i-carbon-chat h-64rpx w-64rpx" />
        </view>
        <text class="guest-title">登录后查看消息</text>
        <text class="guest-copy">登录后可联系公寓管家、查看看房预约和服务通知。</text>
        <button class="guest-login app-primary-button" aria-label="登录或注册" @tap="toLoginPage">
          登录 / 注册
        </button>
        <button class="guest-browse app-tap" @tap="goBrowse">
          先逛房源
        </button>
      </view>

      <template v-else>
        <!-- 固定服务入口不随会话状态变化 -->
        <view class="app-panel overflow-hidden">
          <button
            class="app-tap min-h-160rpx w-full flex items-center gap-24rpx bg-white p-32rpx text-left leading-normal"
            :aria-label="supportUnread > 0 ? `联系公寓管家，${supportUnread}条未读消息` : '联系公寓管家'"
            @tap="goSupport"
          >
            <view class="h-80rpx w-80rpx flex shrink-0 items-center justify-center text-brand-blue" aria-hidden="true">
              <view class="i-carbon-headset h-64rpx w-64rpx" />
            </view>
            <view class="min-w-0 flex-1">
              <text class="block text-36rpx text-app-ink font-semibold leading-48rpx">公寓管家</text>
              <text class="mt-8rpx block text-28rpx text-app-ink-soft leading-40rpx">
                房源咨询 · 看房预约
              </text>
            </view>
            <view v-if="supportUnread > 0" class="h-40rpx min-w-40rpx shrink-0 rounded-full bg-current px-8rpx text-center text-app-danger">
              <text class="block text-22rpx text-white leading-40rpx">
                {{ supportUnread > 99 ? '99+' : supportUnread }}
              </text>
            </view>
            <view class="i-carbon-chevron-right h-36rpx w-36rpx shrink-0 text-app-muted" aria-hidden="true" />
          </button>
        </view>
        <view class="mt-16rpx app-panel overflow-hidden">
          <button
            class="app-tap min-h-160rpx w-full flex items-center gap-24rpx bg-white p-32rpx text-left leading-normal"
            aria-label="查看业务通知"
            @tap="goNotices"
          >
            <view class="h-80rpx w-80rpx flex shrink-0 items-center justify-center text-brand-blue" aria-hidden="true">
              <view class="i-carbon-notification h-64rpx w-64rpx" />
            </view>
            <view class="min-w-0 flex-1">
              <text class="block text-36rpx text-app-ink font-semibold leading-48rpx">业务通知</text>
              <text class="mt-8rpx block text-28rpx text-app-ink-soft leading-40rpx">
                预约确认等服务通知
              </text>
            </view>
            <view class="i-carbon-chevron-right h-36rpx w-36rpx shrink-0 text-app-muted" aria-hidden="true" />
          </button>
        </view>

        <view class="mt-40rpx">
          <view class="flex items-baseline justify-between gap-16rpx">
            <text class="app-section-title">会话</text>
            <text v-if="conversations.length" class="text-24rpx text-app-muted">长按会话可删除</text>
          </view>
          <view v-if="conversations.length" class="mt-20rpx app-panel overflow-hidden">
            <button
              v-for="conv in conversations"
              :key="conv.id"
              class="app-tap min-h-160rpx w-full flex items-center gap-24rpx border-0 border-b border-app-border border-solid bg-white p-32rpx text-left leading-normal last:border-b-0"
              :aria-label="`与${conv.peerNickname || '用户'}的会话${conv.unreadCount > 0 ? `，${conv.unreadCount}条未读消息` : ''}，长按可删除`"
              @tap="goChat(conv)"
              @longpress="removeConversation(conv)"
            >
              <image
                v-if="conv.peerAvatar && !failedAvatars.includes(conv.peerAvatar)"
                :src="conv.peerAvatar"
                mode="aspectFill"
                class="h-104rpx w-104rpx shrink-0 rounded-full bg-app-soft"
                aria-hidden="true"
                @error="failedAvatars.push(conv.peerAvatar)"
              />
              <view
                v-else
                class="h-104rpx w-104rpx flex shrink-0 items-center justify-center rounded-full bg-app-soft text-brand-blue"
                aria-hidden="true"
              >
                <text v-if="conv.peerNickname" class="text-40rpx font-semibold">
                  {{ conv.peerNickname.slice(0, 1) }}
                </text>
                <view v-else class="i-carbon-user h-48rpx w-48rpx" />
              </view>
              <view class="min-w-0 flex-1">
                <view class="min-w-0 flex items-center gap-16rpx">
                  <text class="min-w-0 flex-1 truncate text-32rpx text-app-ink font-semibold leading-44rpx">
                    {{ conv.peerNickname || '用户' }}
                  </text>
                  <text
                    v-if="conv.lastTime"
                    class="max-w-220rpx shrink-0 truncate text-24rpx text-app-muted leading-36rpx"
                    :aria-label="`最后消息时间：${conv.lastTime}`"
                  >
                    {{ conversationTime(conv.lastTime) }}
                  </text>
                </view>
                <view class="mt-8rpx min-w-0 flex items-center gap-16rpx">
                  <text class="min-w-0 flex-1 truncate text-28rpx text-app-ink-soft leading-40rpx">
                    {{ conv.lastMessage || '开始对话…' }}
                  </text>
                  <view v-if="conv.unreadCount > 0" class="h-36rpx min-w-36rpx shrink-0 rounded-full bg-current px-8rpx text-center text-app-danger">
                    <text class="block text-20rpx text-white leading-36rpx">
                      {{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}
                    </text>
                  </view>
                </view>
              </view>
            </button>
            <view v-if="error" class="app-state !py-24rpx">
              <text>刷新失败，已保留现有会话</text>
              <button class="app-secondary-button" @tap="load()">
                重新加载
              </button>
            </view>
          </view>
          <view v-else-if="loading" class="app-state text-28rpx text-app-muted">
            <text>正在加载会话…</text>
          </view>
          <view v-else-if="error" class="app-state">
            <text>会话加载失败，请重试</text>
            <button class="app-secondary-button" @tap="load()">
              重新加载
            </button>
          </view>
          <view v-else class="app-state">
            <view class="mx-auto h-112rpx w-112rpx flex items-center justify-center rounded-full bg-app-soft text-brand-blue" aria-hidden="true">
              <view class="i-carbon-chat h-56rpx w-56rpx" />
            </view>
            <text class="mt-24rpx block text-32rpx text-app-ink font-semibold">还没有会话</text>
            <text class="mt-12rpx block text-28rpx text-app-muted leading-44rpx">
              从房源详情发起沟通，或联系公寓管家
            </text>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped>
.message-page {
  box-sizing: border-box;
  min-height: calc(100vh + env(safe-area-inset-bottom));
}
.guest-state {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 64rpx 40rpx 48rpx;
  text-align: center;
}
.guest-icon {
  display: flex;
  width: 128rpx;
  height: 128rpx;
  align-items: center;
  justify-content: center;
  border-radius: 40rpx;
  background: #eaf2ff;
  color: #2d6fe6;
}
.guest-title {
  margin-top: 32rpx;
  color: #121c39;
  font-size: 34rpx;
  font-weight: 600;
  line-height: 48rpx;
}
.guest-copy {
  max-width: 540rpx;
  margin-top: 16rpx;
  color: #657086;
  font-size: 28rpx;
  line-height: 44rpx;
}
.guest-login {
  width: 100%;
  margin-top: 40rpx;
}
.guest-browse {
  min-height: 88rpx;
  margin-top: 16rpx;
  padding: 0 24rpx;
  background: transparent;
  color: #2d6fe6;
  font-size: 28rpx;
}
</style>
