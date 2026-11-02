<script setup lang="ts">
/**
 * 消息沟通页:会话列表(未读角标)+ 官方客服固定入口。
 */
import type { ImConversation } from '@/api/im'
import { fetchConversations } from '@/api/im'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationBarTitleText: '消息',
    backgroundColor: '#F7F8FA',
  },
})

const conversations = ref<ImConversation[]>([])
const loading = ref(false)

const tokenStore = useTokenStore()

function requireLogin(): boolean {
  tokenStore.updateNowTime()
  if (tokenStore.hasLogin)
    return true
  toLoginPage()
  return false
}

async function load() {
  if (!requireLogin())
    return
  loading.value = true
  try {
    conversations.value = await fetchConversations()
  }
  catch {}
  finally {
    loading.value = false
  }
}

function goChat(conv: ImConversation) {
  const name = encodeURIComponent(conv.peerNickname || '用户')
  uni.navigateTo({ url: `/pages/message/chat?convId=${conv.id}&peerId=${conv.peerUserId}&peerName=${name}` })
}

function goSupport() {
  uni.navigateTo({ url: '/pages/message/chat?mode=support&peerName=%E5%AE%98%E6%96%B9%E5%AE%A2%E6%9C%8D' })
}

onShow(() => load())
onPullDownRefresh(() => {
  load().finally(() => uni.stopPullDownRefresh())
})
</script>

<template>
  <view class="min-h-full bg-#F7F8FA pb-4">
    <!-- 官方客服 -->
    <view class="mx-3 mt-3 flex items-center rounded-2xl bg-white p-4 shadow-sm" @tap="goSupport">
      <view class="flex h-12 w-12 items-center justify-center rounded-full bg-#1677FF text-lg text-white">
        客
      </view>
      <view class="ml-3 flex-1">
        <text class="block text-15px font-semibold text-#303133">官方客服</text>
        <text class="mt-0.5 block text-xs text-#909399">问题反馈 · 意见建议</text>
      </view>
      <text class="text-xs text-#C0C4CC">›</text>
    </view>

    <!-- 会话列表 -->
    <view v-if="conversations.length" class="mx-3 mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
      <view
        v-for="conv in conversations" :key="conv.id"
        class="flex items-center border-b border-solid border-#F5F7FA p-4 last:border-b-0"
        @tap="goChat(conv)"
      >
        <view class="relative">
          <image
            v-if="conv.peerAvatar" :src="conv.peerAvatar" class="h-12 w-12 rounded-full bg-#EDF6FF"
          />
          <view v-else class="flex h-12 w-12 items-center justify-center rounded-full bg-#EDF6FF text-base text-#1677FF">
            {{ (conv.peerNickname || '用').slice(0, 1) }}
          </view>
          <view v-if="conv.unreadCount > 0" class="absolute -right-1 -top-1 flex h-5 min-w-20px items-center justify-center rounded-full bg-#FA5151 px-1">
            <text class="text-10px text-white">{{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}</text>
          </view>
        </view>
        <view class="ml-3 flex-1">
          <text class="block text-15px font-semibold text-#303133">{{ conv.peerNickname || '用户' }}</text>
          <text class="mt-0.5 block truncate text-xs text-#909399">{{ conv.lastMessage || '开始对话…' }}</text>
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

<style scoped>
</style>
