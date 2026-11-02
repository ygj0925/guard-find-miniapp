<script setup lang="ts">
/**
 * 聊天页:气泡流 + 输入条 + 3 秒轮询。
 * 三种入口:convId(会话)、peerId(房源详情,进入即建会话)、mode=support(联系客服)。
 */
import type { ImMessage } from '@/api/im'
import { getUserInfo } from '@/api/login'
import { useTokenStore } from '@/store/token'
import {
  fetchMessages, fetchSupportMessages, getOrCreateConversation, sendSupportMessage, sendMessage,
} from '@/api/im'

definePage({
  style: {
    navigationBarTitleText: '聊天',
    backgroundColor: '#F7F8FA',
  },
})

const peerName = ref('对方')
const convId = ref<number | string>('')
const isSupport = ref(false)
const peerId = ref('')

const messages = ref<ImMessage[]>([])
const draft = ref('')
const sending = ref(false)
const lastId = ref(0)
let pollTimer: ReturnType<typeof setInterval> | null = null
let createLock = false

const myUserId = ref(0)

onLoad(async (query) => {
  isSupport.value = query?.mode === 'support'
  peerName.value = query?.peerName ? decodeURIComponent(query.peerName) : (isSupport.value ? '官方客服' : '对方')
  peerId.value = String(query?.peerId ?? '')
  convId.value = isSupport.value ? 'support' : String(query?.convId ?? '')
  uni.setNavigationBarTitle({ title: peerName.value })

  // 我的用户 ID(用于区分气泡方向;客服消息 senderId=0)
  try {
    const info = await getUserInfo()
    myUserId.value = Number(info.userId)
  }
  catch {}

  if (!isSupport.value && !convId.value && peerId.value)
    await ensureConversation()
  await loadInitial()
  pollTimer = setInterval(() => void pollNew(), 3000)
})

onUnload(() => {
  if (pollTimer)
    clearInterval(pollTimer)
})

async function ensureConversation() {
  if (createLock)
    return
  createLock = true
  try {
    const conv = await getOrCreateConversation(peerId.value)
    convId.value = conv.id
  }
  catch {}
  finally {
    createLock = false
  }
}

async function loadInitial() {
  if (!convId.value)
    return
  try {
    const msgs = isSupport.value ? await fetchSupportMessages() : await fetchMessages(convId.value)
    messages.value = msgs
    if (msgs.length)
      lastId.value = Number(msgs[msgs.length - 1].id)
  }
  catch {}
}

async function pollNew() {
  if (!convId.value)
    return
  try {
    const msgs = isSupport.value
      ? await fetchSupportMessages(lastId.value || undefined)
      : await fetchMessages(convId.value, lastId.value || undefined)
    if (msgs.length) {
      messages.value = [...messages.value, ...msgs]
      lastId.value = Number(msgs[msgs.length - 1].id)
      scrollBottom()
    }
  }
  catch {}
}

async function onSend() {
  const content = draft.value.trim()
  if (!content || sending.value || !convId.value)
    return
  sending.value = true
  draft.value = ''
  try {
    const msg = isSupport.value
      ? await sendSupportMessage(content)
      : await sendMessage(convId.value, content)
    messages.value = [...messages.value, msg]
    lastId.value = Number(msg.id)
    scrollBottom()
  }
  catch (error) {
    draft.value = content
    const message = error instanceof Error ? error.message : '发送失败,请稍后再试'
    uni.showToast({ title: message, icon: 'none' })
  }
  finally {
    sending.value = false
  }
}

function scrollBottom() {
  nextTick(() => {
    uni.pageScrollTo({ scrollTop: 999999, duration: 120 })
  })
}

function fromPeer(item: ImMessage) {
  return Number(item.senderId) !== myUserId.value
}

function formatTime(value?: string) {
  return value ? value.replace('T', ' ').slice(5, 16) : ''
}
</script>

<template>
  <view class="min-h-full bg-#F7F8FA pb-24">
    <view v-if="messages.length" class="px-3 pt-3">
      <view
        v-for="item in messages" :key="item.id"
        class="mb-3 flex" :class="fromPeer(item) ? 'justify-start' : 'justify-end'"
      >
        <view
          class="max-w-70% rounded-2xl px-3 py-2"
          :class="fromPeer(item) ? 'border border-solid border-#EBEEF5 bg-white' : 'bg-#1677FF'"
        >
          <text class="block break-all text-sm leading-6" :class="fromPeer(item) ? 'text-#303133' : 'text-white'">{{ item.content }}</text>
          <text v-if="formatTime(item.createTime)" class="mt-1 block text-right text-10px" :class="fromPeer(item) ? 'text-#C0C4CC' : 'text-white/70'">
            {{ formatTime(item.createTime) }}
          </text>
        </view>
      </view>
    </view>
    <view v-else class="py-20 text-center text-sm text-#909399">
      还没有消息,说点什么吧
    </view>

    <!-- 输入条 -->
    <view class="fixed inset-x-0 bottom-0 flex items-center gap-2 border-t border-solid border-#F0F0F0 bg-white px-3 py-2 pb-6">
      <input
        v-model="draft"
        class="h-9 flex-1 rounded-full border border-solid border-#DCDFE6 bg-#F7F8FA px-4 text-sm"
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

<style scoped>
</style>
