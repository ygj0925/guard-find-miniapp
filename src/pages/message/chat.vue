<script setup lang="ts">
/**
 * 聊天页:气泡流 + 输入条 + 3 秒轮询。
 * 三种入口:convId(会话)、peerId(房源详情,进入即建会话)、mode=support(联系公寓管家)。
 */
import type { ImMessage } from '@/api/im'
import { getUserInfo } from '@/api/login'
import { mergeMessages } from '@/utils/messageCursor'
import {
  fetchMessages,
  fetchSupportMessages,
  getOrCreateConversation,
  sendMessage,
  sendSupportMessage,
} from '@/api/im'

definePage({
  style: {
    navigationBarTitleText: '聊天',
    backgroundColor: '#F7F8FA',
  },
})

const peerName = ref('对方')
const convId = ref<string | number>('')
const isSupport = ref(false)
const messages = ref<ImMessage[]>([])
const draft = ref('')
const sending = ref(false)
const myUserId = ref('')
const lastId = ref<string | number>('')
let active = false
let generation = 0
let timer: ReturnType<typeof setTimeout> | undefined
let boot: Promise<void> = Promise.resolve()

onLoad((query) => {
  isSupport.value = query?.mode === 'support'
  peerName.value = isSupport.value
    ? '公寓管家'
    : query?.peerName
      ? decodeURIComponent(query.peerName)
      : '对方'
  convId.value = isSupport.value ? 'support' : String(query?.convId || '')
  uni.setNavigationBarTitle({ title: peerName.value })
  boot = (async () => {
    const info = await getUserInfo()
    myUserId.value = String(info.userId)
    if (!isSupport.value && !convId.value && query?.peerId)
      convId.value = (await getOrCreateConversation(String(query.peerId))).id
  })()
  // Install a rejection handler immediately; start() reports initialization failures.
  void boot.catch(() => {})
})
onShow(() => {
  active = true
  const current = ++generation
  void start(current)
})
function stop() {
  active = false
  generation++
  if (timer)
    clearTimeout(timer)
  timer = undefined
}
onHide(stop)
onUnload(stop)
async function start(current: number) {
  try {
    await boot
    if (current !== generation || !active || !convId.value)
      return
    await poll(current)
  }
  catch {
    if (current === generation && active)
      uni.showToast({ title: '会话加载失败，请返回重试', icon: 'none' })
  }
}
async function poll(current: number) {
  let count = 0
  try {
    const msgs = isSupport.value
      ? await fetchSupportMessages(lastId.value || undefined)
      : await fetchMessages(convId.value, lastId.value || undefined)
    if (current !== generation || !active)
      return
    count = msgs.length
    if (msgs.length) {
      messages.value = mergeMessages(messages.value, msgs)
      lastId.value = msgs[msgs.length - 1].id
      scrollBottom()
    }
  }
  catch {
  }
  finally {
    if (current === generation && active)
      timer = setTimeout(() => void poll(current), count === 100 ? 50 : 3000)
  }
}
async function onSend() {
  const content = draft.value.trim()
  if (!content || sending.value || !convId.value || !active)
    return
  const current = generation
  sending.value = true
  try {
    const msg = isSupport.value
      ? await sendSupportMessage(content)
      : await sendMessage(convId.value, content)
    if (current !== generation || !active)
      return
    messages.value = mergeMessages(messages.value, [msg])
    if (draft.value.trim() === content)
      draft.value = ''
    // The receive cursor advances only on reads; a send must not skip in-flight peer messages.
    scrollBottom()
  }
  catch (error) {
    if (current === generation && active) {
      uni.showToast({
        title: error instanceof Error ? error.message : '发送失败，请重试',
        icon: 'none',
      })
    }
  }
  finally {
    sending.value = false
  }
}
function scrollBottom() {
  nextTick(() => {
    if (active)
      uni.pageScrollTo({ scrollTop: 999999, duration: 120 })
  })
}
function fromPeer(item: ImMessage) {
  return String(item.senderId) !== myUserId.value
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
