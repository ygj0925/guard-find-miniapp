<script setup lang="ts">
import type { AiChatConversation } from './aiHistory'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import { safeAreaInsets } from '@/utils/systemInfo'
import {
  clearNewConversationRequest,
  deleteHistoryConversations,
  listHistoryConversations,
  markNewConversationRequest,
  setActiveHistoryConversation,
} from './aiHistory'
import { aiHeaderMetrics } from './aiLayout'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '历史对话',
    disableScroll: true,
  },
})

const PAGE_SIZE = 20
const conversations = ref<AiChatConversation[]>([])
const keyword = ref('')
const isEditing = ref(false)
const selectedIds = ref<string[]>([])
const visibleCount = ref(PAGE_SIZE)
const isInitialLoading = ref(false)
const isRefreshing = ref(false)
const isDeleting = ref(false)
const isNavigatingBack = ref(false)

const headerStyle = {
  paddingTop: `${aiHeaderMetrics.statusBarHeight}px`,
}

const brandStyle = {
  height: `${aiHeaderMetrics.height - aiHeaderMetrics.statusBarHeight}px`,
  paddingRight: `${aiHeaderMetrics.rightPadding}px`,
}

const safeBottom = safeAreaInsets?.bottom || 0
const listContentStyle = { paddingBottom: '24px' }
const historyContentStyle = computed(() => ({
  paddingBottom: `${isEditing.value ? 20 : safeBottom + 20}px`,
}))

const filteredConversations = computed(() => {
  const searchText = keyword.value.trim().toLowerCase()
  if (!searchText) {
    return conversations.value
  }
  return conversations.value.filter((conversation) => {
    const content = conversation.messages.map(item => item.content).join(' ')
    return `${conversation.title} ${content}`.toLowerCase().includes(searchText)
  })
})

const visibleConversations = computed(() => filteredConversations.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < filteredConversations.value.length)
const groupedConversations = computed(() => {
  const groups: Array<{ label: string, items: AiChatConversation[] }> = []
  visibleConversations.value.forEach((conversation) => {
    const label = formatDateLabel(conversation.updatedAt)
    const group = groups.find(item => item.label === label)
    group ? group.items.push(conversation) : groups.push({ label, items: [conversation] })
  })
  return groups
})
const isAllSelected = computed(() => filteredConversations.value.length > 0
  && filteredConversations.value.every(item => selectedIds.value.includes(item.id)))

async function loadConversations(mode: 'initial' | 'refresh' = 'initial') {
  mode === 'initial' ? (isInitialLoading.value = true) : (isRefreshing.value = true)
  try {
    await Promise.resolve()
    conversations.value = listHistoryConversations()
    visibleCount.value = PAGE_SIZE
    selectedIds.value = selectedIds.value.filter(id => conversations.value.some(item => item.id === id))
  }
  finally {
    isInitialLoading.value = false
    isRefreshing.value = false
  }
}

function refreshConversations() {
  void loadConversations('refresh')
}

function loadMore() {
  if (isInitialLoading.value || isRefreshing.value || isDeleting.value || !hasMore.value) {
    return
  }
  visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, filteredConversations.value.length)
}

function goBack() {
  if (isNavigatingBack.value || isDeleting.value) {
    return
  }
  isNavigatingBack.value = true
  uni.navigateBack({ complete: () => (isNavigatingBack.value = false) })
}

function startNewConversationFromHistory() {
  if (isEditing.value || isDeleting.value || isNavigatingBack.value) {
    return
  }
  isNavigatingBack.value = true
  markNewConversationRequest()
  uni.navigateBack({
    fail: clearNewConversationRequest,
    complete: () => (isNavigatingBack.value = false),
  })
}

function toggleEditing() {
  if (isDeleting.value) {
    return
  }
  isEditing.value = !isEditing.value
  selectedIds.value = []
}

function submitSearch() {
  uni.hideKeyboard()
}

function openConversation(conversationId: string) {
  if (isEditing.value) {
    selectedIds.value = selectedIds.value.includes(conversationId)
      ? selectedIds.value.filter(id => id !== conversationId)
      : [...selectedIds.value, conversationId]
    return
  }
  if (isNavigatingBack.value || isDeleting.value) {
    return
  }
  isNavigatingBack.value = true
  setActiveHistoryConversation(conversationId)
  uni.navigateBack({ complete: () => (isNavigatingBack.value = false) })
}

function toggleAll() {
  if (isDeleting.value) {
    return
  }
  selectedIds.value = isAllSelected.value ? [] : filteredConversations.value.map(item => item.id)
}

function performDelete(conversationIds: string[]) {
  isDeleting.value = true
  try {
    deleteHistoryConversations(conversationIds)
    const deletedIds = new Set(conversationIds)
    conversations.value = conversations.value.filter(item => !deletedIds.has(item.id))
    selectedIds.value = []
    visibleCount.value = Math.min(Math.max(PAGE_SIZE, visibleCount.value), conversations.value.length || PAGE_SIZE)
    if (!conversations.value.length) {
      isEditing.value = false
    }
  }
  finally {
    isDeleting.value = false
  }
}

function removeSelected() {
  if (isDeleting.value) {
    return
  }
  if (!selectedIds.value.length) {
    uni.showToast({ title: '请选择要删除的对话', icon: 'none' })
    return
  }
  const conversationIds = [...selectedIds.value]
  uni.showModal({
    title: '删除对话',
    content: `确认删除选中的 ${conversationIds.length} 条对话吗？`,
    success: ({ confirm }) => confirm && performDelete(conversationIds),
  })
}

function formatDateLabel(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dateStart = new Date(date)
  dateStart.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) {
    return '今天'
  }
  if (diffDays === 1) {
    return '昨天'
  }
  if (diffDays <= 7) {
    return '7天内'
  }
  return '更早'
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}：${String(date.getMinutes()).padStart(2, '0')}`
}

onShow(() => {
  void loadConversations(conversations.value.length ? 'refresh' : 'initial')
})

watch(keyword, () => {
  visibleCount.value = PAGE_SIZE
})
</script>

<template>
  <view class="history-page">
    <view class="history-top-shell">
      <view class="history-header" :style="headerStyle">
        <view class="brand" :style="brandStyle">
          <view class="brand-mark">
            <view class="brand-dot brand-dot-left" />
            <view class="brand-dot brand-dot-right" />
            <view class="brand-body" />
          </view>
          <text class="brand-name">麟才寻你</text>
        </view>
        <view class="header-actions">
          <view class="back-button" @tap="goBack">
            ← 返回
          </view>
          <view v-if="!isEditing" class="new-conversation-button" @tap="startNewConversationFromHistory">
            ＋ 新建对话
          </view>
          <view class="edit-button" @tap="toggleEditing">
            {{ isEditing ? '退出编辑' : '编辑' }}
          </view>
        </view>
      </view>

      <view class="search-row">
        <view class="search-field">
          <input
            v-model="keyword"
            confirm-type="search"
            placeholder="搜索历史对话"
            placeholder-class="search-placeholder"
            @confirm="submitSearch"
          >
        </view>
        <view class="search-button" @tap="submitSearch">
          <text>⌕</text>
          <text>搜索</text>
        </view>
      </view>
    </view>

    <view class="history-content" :style="historyContentStyle">
      <view class="history-panel">
        <view class="panel-heading">
          <text class="panel-title">对话记录</text>
          <text v-if="keyword.trim()" class="panel-count">已匹配 {{ filteredConversations.length }} 条</text>
          <text v-else-if="conversations.length" class="panel-count">共 {{ conversations.length }} 条</text>
        </view>

        <scroll-view
          class="history-scroll"
          scroll-y
          refresher-enabled
          :refresher-triggered="isRefreshing"
          :lower-threshold="80"
          @refresherrefresh="refreshConversations"
          @scrolltolower="loadMore"
        >
          <view class="history-list-content" :style="listContentStyle">
            <view v-if="isInitialLoading" class="empty-state">
              <view class="history-loading-dot" />
              <text class="empty-title">正在加载历史对话</text>
            </view>

            <view v-else-if="!groupedConversations.length" class="empty-state">
              <image src="https://static1.3sbio.com/assets/%E6%8C%A5%E6%89%8B.gif" mode="aspectFit" />
              <text class="empty-title">{{ keyword.trim() ? '没有找到匹配的对话' : '还没有历史对话' }}</text>
              <text class="empty-copy">{{ keyword.trim() ? '可换个关键词再试' : '回到 AI 助手发起一个求职问题吧' }}</text>
            </view>

            <view v-for="(group, groupIndex) in groupedConversations" :key="group.label" class="history-group">
              <view v-if="groupIndex" class="group-divider" />
              <text class="group-title">{{ group.label }}</text>
              <view
                v-for="conversation in group.items"
                :key="conversation.id"
                class="conversation-row"
                @tap="openConversation(conversation.id)"
              >
                <view v-if="isEditing" class="selection-circle" :class="{ selected: selectedIds.includes(conversation.id) }">
                  <text v-if="selectedIds.includes(conversation.id)">✓</text>
                </view>
                <text class="conversation-title">{{ conversation.title }}</text>
                <text class="conversation-time">{{ formatTime(conversation.updatedAt) }}</text>
              </view>
            </view>

            <view v-if="groupedConversations.length" class="load-state">
              <text>{{ hasMore ? '继续上滑加载更多' : '已经到底了' }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view v-if="isEditing" class="edit-toolbar" :style="{ paddingBottom: `${safeBottom}px` }">
      <view class="toolbar-left">
        <text @tap="toggleAll">{{ isAllSelected ? '取消全选' : '全选' }}</text>
        <text @tap="toggleEditing">取消选择</text>
      </view>
      <view class="delete-button" :class="{ disabled: isDeleting }" @tap="removeSelected">
        {{ isDeleting ? '删除中...' : '删除' }}
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.history-page {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #edf6ff url('https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/背景.jpg') center / cover fixed;
  color: #2a2e39;
}

:global(page) {
  background: #edf6ff url('https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/背景.jpg') center / cover
    no-repeat;
}

.history-top-shell {
  position: relative;
  z-index: 2;
  flex: none;
}

.history-header {
  box-sizing: border-box;
  padding-left: 24rpx;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.brand-mark {
  position: relative;
  width: 54rpx;
  height: 54rpx;
}

.brand-dot {
  position: absolute;
  top: 2rpx;
  width: 17rpx;
  height: 17rpx;
  border-radius: 50%;
}

.brand-dot-left {
  left: 4rpx;
  background: var(--app-brand-sky);
}

.brand-dot-right {
  right: 4rpx;
  background: var(--app-brand-mint);
}

.brand-body {
  position: absolute;
  right: 4rpx;
  bottom: 1rpx;
  left: 4rpx;
  height: 36rpx;
  border-radius: 25rpx 25rpx 18rpx 18rpx;
  background: linear-gradient(135deg, #0879ff 12%, #13b8ed 55%, #4de3ba 100%);
  transform: rotate(3deg);
}

.brand-body::after {
  position: absolute;
  top: 7rpx;
  left: 16rpx;
  width: 15rpx;
  height: 21rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  content: '';
}

.brand-name {
  color: #111b2f;
  font-size: 36rpx;
  font-weight: 600;
}

.header-actions {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  margin-top: 10rpx;
  padding-right: 24rpx;
}

.back-button,
.edit-button {
  padding: 8rpx 18rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.86);
  color: #30343e;
  font-size: 28rpx;
}

.back-button {
  justify-self: start;
}

.edit-button {
  grid-column: 3;
  justify-self: end;
}

.new-conversation-button {
  grid-column: 2;
  min-height: 58rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  padding: 10rpx 28rpx;
  border: 1rpx solid rgba(96, 137, 232, 0.5);
  border-radius: 32rpx;
  background: linear-gradient(105deg, #6f97ff 0%, #4f81f9 100%);
  box-shadow: 0 9rpx 22rpx rgba(67, 103, 185, 0.22);
  color: #fff;
  font-size: 26rpx;
  font-weight: 500;
  white-space: nowrap;
}

.search-row {
  height: 72rpx;
  display: flex;
  margin: 32rpx 22rpx 0;
  overflow: hidden;
  border-radius: 38rpx;
  box-shadow: 0 9rpx 22rpx rgba(67, 103, 185, 0.16);
}

.search-field {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 28rpx;
  background: rgba(255, 255, 255, 0.96);
}

.search-field input {
  width: 100%;
  color: #29354c;
  font-size: 28rpx;
}

:deep(.search-placeholder) {
  color: #b9bdc8;
}

.search-button {
  width: 138rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  background: linear-gradient(100deg, #6b93ff, #4f81f9);
  color: #fff;
  font-size: 28rpx;
}

.history-content {
  box-sizing: border-box;
  min-height: 0;
  flex: 1;
  display: flex;
  align-items: stretch;
  padding: 26rpx 22rpx 0;
}

.history-panel {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 38rpx;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 12rpx 28rpx rgba(68, 99, 168, 0.09);
}

.panel-heading {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30rpx 26rpx 24rpx;
}

.panel-title {
  color: #373a43;
  font-size: 30rpx;
  text-align: center;
}

.panel-count {
  position: absolute;
  right: 28rpx;
  color: #9aa1af;
  font-size: 22rpx;
}

.history-scroll {
  width: 100%;
  height: 0;
  min-height: 0;
  flex: 1;
}

.history-list-content {
  box-sizing: border-box;
  min-height: calc(100% + 24px);
  padding: 12rpx 26rpx 0;
}

.history-group {
  margin-bottom: 30rpx;
}

.group-title {
  display: block;
  margin: 0 10rpx 18rpx;
  color: #30333c;
  font-size: 30rpx;
  font-weight: 500;
}

.group-divider {
  height: 1rpx;
  margin: 10rpx 0 34rpx;
  background: rgba(152, 158, 173, 0.25);
}

.conversation-row {
  min-height: 50rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 4rpx 10rpx;
}

.conversation-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #858991;
  font-size: 27rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-time {
  color: #858991;
  font-size: 27rpx;
  font-variant-numeric: tabular-nums;
}

.selection-circle {
  width: 26rpx;
  height: 26rpx;
  flex: 0 0 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #34373e;
  border-radius: 50%;
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
}

.selection-circle.selected {
  background: #34373e;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 110rpx;
}

.empty-state image {
  width: 220rpx;
  height: 220rpx;
  opacity: 0.9;
}

.empty-title {
  margin-top: 24rpx;
  color: #405071;
  font-size: 30rpx;
  font-weight: 600;
}

.empty-copy {
  margin-top: 12rpx;
  color: #96a0b3;
  font-size: 24rpx;
}

.load-state {
  padding: 20rpx 0 6rpx;
  color: #a2a8b4;
  font-size: 22rpx;
  text-align: center;
}

.history-loading-dot {
  width: 42rpx;
  height: 42rpx;
  border: 5rpx solid rgba(82, 126, 219, 0.18);
  border-top-color: #527edb;
  border-radius: 50%;
  animation: history-loading 0.8s linear infinite;
}

@keyframes history-loading {
  to {
    transform: rotate(360deg);
  }
}

.edit-toolbar {
  z-index: 30;
  min-height: 90rpx;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 26rpx;
  background: rgba(235, 239, 247, 0.98);
  box-shadow: 0 -4rpx 16rpx rgba(54, 66, 96, 0.08);
}

.toolbar-left {
  display: flex;
  gap: 44rpx;
  color: #40434c;
  font-size: 28rpx;
}

.delete-button {
  padding: 10rpx 28rpx;
  border: 1rpx solid rgba(113, 144, 235, 0.55);
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.86);
  color: #30333d;
  font-size: 28rpx;
}

.delete-button.disabled {
  opacity: 0.55;
}
</style>
