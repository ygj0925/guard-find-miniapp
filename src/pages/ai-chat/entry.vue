<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'

defineOptions({
  name: 'AiChatEntry',
})

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '生生智家',
    backgroundColor: '#EDF6FF',
  },
})

const AI_CHAT_PATH = '/pages/ai-chat/index'
const HOME_PATH = '/pages/index/index'
const AI_CHAT_ENTRY_QUERY = '?fromEntry=1'
let chatOpened = false
let navigating = false

function openChat() {
  if (navigating)
    return

  navigating = true
  uni.navigateTo({
    url: `${AI_CHAT_PATH}${AI_CHAT_ENTRY_QUERY}`,
    animationType: 'none',
    animationDuration: 0,
    success: () => {
      chatOpened = true
    },
    fail: () => {
      chatOpened = false
      uni.switchTab({ url: HOME_PATH })
    },
    complete: () => {
      navigating = false
    },
  })
}

onLoad(() => {
  openChat()
})

onShow(() => {
  if (navigating)
    return

  if (chatOpened) {
    chatOpened = false
    uni.switchTab({ url: HOME_PATH })
    return
  }

  openChat()
})
</script>

<template>
  <view class="ai-entry-page" />
</template>

<style scoped>
.ai-entry-page {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  background: #edf6ff url('https://static1.3sbio.com/assets/lingcai/%E8%83%8C%E6%99%AF.jpg') center / cover no-repeat;
}
</style>
