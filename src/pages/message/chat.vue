<script setup lang="ts">
import type { ImMessage } from '@/api/im'
import type { ChatState } from '@/utils/chatSync'
import {
  fetchMessages,
  fetchSupportMessages,
  getOrCreateConversation,
  sendMessage,
  sendSupportMessage,
} from '@/api/im'
import { getUserInfo } from '@/api/login'
import { useTokenStore } from '@/store/token'
import { createChatSync } from '@/utils/chatSync'
import { disconnectImSocket, isImSocketConnected, subscribeImSocket } from '@/utils/imSocket'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationBarTitleText: '聊天',
    backgroundColor: '#F7F8FA',
  },
})

const state = reactive<ChatState>({
  convId: '',
  myUserId: '',
  messages: [],
  lastId: '',
  draft: '',
  sending: false,
})
const { messages, draft, sending } = toRefs(state)
const route = { convId: '', peerId: '', support: false }
const tokenStore = useTokenStore()
const sync = createChatSync(state, route, {
  token: () => tokenStore.validToken,
  user: getUserInfo,
  conversation: getOrCreateConversation,
  read: (id, afterId) => route.support ? fetchSupportMessages(afterId) : fetchMessages(id, afterId),
  send: (id, content) => route.support ? sendSupportMessage(content) : sendMessage(id, content),
  subscribe: (refresh, token) => subscribeImSocket((event) => {
    if (route.support
      ? event.action === 'admin_message'
      : event.action === 'new_message' && String(event.conversationId) === String(state.convId)) {
      refresh()
    }
  }, token, refresh),
  connected: isImSocketConnected,
  login: toLoginPage,
  error: title => uni.showToast({ title, icon: 'none' }),
  scroll: valid => nextTick(() => {
    if (valid())
      uni.pageScrollTo({ scrollTop: 999999, duration: 120 })
  }),
})

onLoad((query) => {
  route.support = query?.mode === 'support'
  route.convId = String(query?.convId || '')
  route.peerId = String(query?.peerId || '')
  const title = route.support ? '公寓管家' : query?.peerName ? decodeURIComponent(query.peerName) : '对方'
  uni.setNavigationBarTitle({ title })
})
watch(() => tokenStore.validToken, (token) => {
  if (!token)
    disconnectImSocket()
  sync.tokenChanged(token)
}, { flush: 'sync' })
watch(draft, () => sync.draftChanged(), { flush: 'sync' })
onShow(() => {
  // Refresh expiry while still hidden, then initialize exactly once for this show.
  tokenStore.updateNowTime()
  sync.show()
})
onHide(sync.hide)
onUnload(sync.unload)
const onSend = () => sync.send()

function fromPeer(item: ImMessage) {
  return String(item.senderId) !== state.myUserId
}

function formatTime(value?: string) {
  return value ? value.replace('T', ' ').slice(5, 16) : ''
}
</script>

<template>
  <view class="min-h-full bg-#F7F8FA pb-24">
    <view v-if="messages.length" class="px-3 pt-3">
      <view
        v-for="item in messages"
        :key="item.id"
        class="mb-3 flex"
        :class="fromPeer(item) ? 'justify-start' : 'justify-end'"
      >
        <view
          class="max-w-70% rounded-2xl px-3 py-2"
          :class="
            fromPeer(item)
              ? 'border border-solid border-#EBEEF5 bg-white'
              : 'bg-#1677FF'
          "
        >
          <text
            class="block break-all text-sm leading-6"
            :class="fromPeer(item) ? 'text-#303133' : 'text-white'"
          >
            {{ item.content }}
          </text>
          <text
            v-if="formatTime(item.createTime)"
            class="mt-1 block text-right text-10px"
            :class="fromPeer(item) ? 'text-#C0C4CC' : 'text-white/70'"
          >
            {{ formatTime(item.createTime) }}
          </text>
        </view>
      </view>
    </view>
    <view v-else class="py-20 text-center text-sm text-#909399">
      还没有消息,说点什么吧
    </view>

    <!-- 输入条 -->
    <view
      class="fixed inset-x-0 bottom-0 flex items-center gap-2 border-t border-#F0F0F0 border-solid bg-white px-3 py-2 pb-6"
    >
      <input
        v-model="draft"
        :maxlength="2000"
        class="h-9 flex-1 border border-#DCDFE6 rounded-full border-solid bg-#F7F8FA px-4 text-sm"
        placeholder="输入消息…"
        confirm-type="send"
        :adjust-position="true"
        @confirm="onSend"
      >
      <button
        class="m-0 rounded-full bg-#1677FF px-4 py-2 text-sm text-white"
        :disabled="!draft.trim() || sending"
        @tap="onSend"
      >
        发送
      </button>
    </view>
  </view>
</template>

<style scoped></style>
