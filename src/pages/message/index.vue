<script setup lang="ts">
/**
 * 消息沟通页:会话列表(未读角标)+ 公寓管家固定入口。
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

let version = 0
onHide(() => {
  version++
})
onUnload(() => {
  version++
})
async function load() {
  const current = ++version
  if (!requireLogin()) {
    conversations.value = []
    return
  }
  loading.value = true
  try {
    const data = await fetchConversations()
    if (current === version && tokenStore.updateNowTime().hasLogin)
      conversations.value = data
  }
  catch {
  }
  finally {
    loading.value = false
  }
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

onShow(() => load())
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
