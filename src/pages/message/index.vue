<script setup lang="ts">
/**
 * 消息沟通页:会话列表(未读角标)+ 公寓管家固定入口。
 * WebSocket 推送触发单飞刷新，可见期间轮询兜底。
 */
import type { ImConversation } from '@/api/im'
import type { ImSocketEvent } from '@/utils/imSocket'
import { fetchConversations, fetchSupportUnread } from '@/api/im'
import { useTokenStore } from '@/store/token'
import { debounce } from '@/utils/debounce'
import { disconnectImSocket, isImSocketConnected, subscribeImSocket } from '@/utils/imSocket'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationBarTitleText: '消息',
    backgroundColor: '#F7F8FA',
  },
})

const conversations = ref<ImConversation[]>([])
const supportUnread = ref(0)
const loading = ref(false)
const tokenStore = useTokenStore()
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
  if (!visible || !requireLogin())
    return
  sessionToken = tokenStore.validToken
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
  inFlight = (async () => {
    try {
      const [data, unread] = await Promise.all([fetchConversations(), fetchSupportUnread()])
      if (isCurrent()) {
        conversations.value = data
        supportUnread.value = unread
      }
    }
    catch {
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

function goSupport() {
  if (!requireLogin())
    return
  uni.navigateTo({
    url: '/pages/message/chat?mode=support',
  })
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
  <view class="min-h-full bg-#F7F8FA pb-4">
    <!-- 公寓管家 -->
    <view
      class="mx-3 mt-3 flex items-center rounded-2xl bg-white p-4 shadow-sm"
      @tap="goSupport"
    >
      <view
        class="h-12 w-12 flex items-center justify-center rounded-full bg-#1677FF text-lg text-white"
      >
        泊
      </view>
      <view class="ml-3 flex-1">
        <text class="block text-15px text-#303133 font-semibold">公寓管家</text>
        <text class="mt-0.5 block text-xs text-#909399">
          房源咨询 · 看房预约 · 问题反馈
        </text>
      </view>
      <view v-if="supportUnread > 0" class="mr-2 min-w-20px rounded-full bg-#FA5151 px-1 text-center text-10px text-white">
        {{ supportUnread > 99 ? '99+' : supportUnread }}
      </view>
      <text class="text-xs text-#C0C4CC">›</text>
    </view>

    <!-- 会话列表 -->
    <view
      v-if="conversations.length"
      class="mx-3 mt-3 overflow-hidden rounded-2xl bg-white shadow-sm"
    >
      <view
        v-for="conv in conversations"
        :key="conv.id"
        class="flex items-center border-b border-#F5F7FA border-solid p-4 last:border-b-0"
        @tap="goChat(conv)"
      >
        <view class="relative">
          <image
            v-if="conv.peerAvatar"
            :src="conv.peerAvatar"
            class="h-12 w-12 rounded-full bg-#EDF6FF"
          />
          <view
            v-else
            class="h-12 w-12 flex items-center justify-center rounded-full bg-#EDF6FF text-base text-#1677FF"
          >
            {{ (conv.peerNickname || "用").slice(0, 1) }}
          </view>
          <view
            v-if="conv.unreadCount > 0"
            class="absolute h-5 min-w-20px flex items-center justify-center rounded-full bg-#FA5151 px-1 -right-1 -top-1"
          >
            <text class="text-10px text-white">
              {{
                conv.unreadCount > 99 ? "99+" : conv.unreadCount
              }}
            </text>
          </view>
        </view>
        <view class="ml-3 flex-1">
          <text class="block text-15px text-#303133 font-semibold">
            {{
              conv.peerNickname || "用户"
            }}
          </text>
          <text class="mt-0.5 block truncate text-xs text-#909399">
            {{
              conv.lastMessage || "开始对话…"
            }}
          </text>
        </view>
      </view>
    </view>
    <view v-else-if="loading" class="py-20 text-center text-sm text-#909399">
      加载中…
    </view>
    <view v-else class="py-20 text-center text-sm text-#909399">
      还没有会话,从房源详情发起沟通吧
    </view>
  </view>
</template>

<style scoped></style>
