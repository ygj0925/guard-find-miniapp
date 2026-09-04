<script setup lang="ts">
import type { AgentChatSession } from '@/api/agent'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { batchDeleteAgentChatSessions, listAgentChatSessions } from '@/api/agent'
import { safeAreaInsets } from '@/utils/systemInfo'
import {
  clearNewConversationRequest,
  markDeletedConversationIds,
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

interface HistoryConversation {
  id: string
  title: string
  summary: string
  updatedAt: number
}

const PAGE_SIZE = 20
const conversations = ref<HistoryConversation[]>([])
const keyword = ref('')
const appliedKeyword = ref('')
const loadedKeyword = ref('')
const isEditing = ref(false)
const selectedIds = ref<string[]>([])
const hasMore = ref(false)
const nextBeforeLastMessageId = ref<number>()
const snapshotLastMessageId = ref<number>()
const isInitialLoading = ref(false)
const isRefreshing = ref(false)
const isLoadingMore = ref(false)
const loadError = ref(false)
const isDeleting = ref(false)
const isNavigatingBack = ref(false)
const safeBottom = safeAreaInsets?.bottom || 0
let requestSequence = 0

const headerStyle = {
  paddingTop: `${aiHeaderMetrics.statusBarHeight}px`,
  paddingRight: `${aiHeaderMetrics.rightPadding}px`,
}
const historyContentStyle = computed(() => ({
  paddingBottom: `${isEditing.value ? 12 : safeBottom + 12}px`,
}))
const groupedConversations = computed(() => {
  const groups: Array<{ label: string, items: HistoryConversation[] }> = []
  conversations.value.forEach((conversation) => {
    const label = formatDateLabel(conversation.updatedAt)
    const group = groups.find(item => item.label === label)
    group ? group.items.push(conversation) : groups.push({ label, items: [conversation] })
  })
  return groups
})
const isAllSelected = computed(() => conversations.value.length > 0
  && conversations.value.every(item => selectedIds.value.includes(item.id)))

async function loadConversations(mode: 'initial' | 'refresh' | 'more' = 'initial') {
  if (isDeleting.value)
    return false
  if (mode === 'more' && (
    !hasMore.value
    || isLoadingMore.value
    || isInitialLoading.value
    || isRefreshing.value
  )) {
    return false
  }
  if (mode === 'refresh' && isRefreshing.value)
    return false

  const sequence = ++requestSequence
  const requestKeyword = appliedKeyword.value
  const requestBeforeLastMessageId = mode === 'more' ? nextBeforeLastMessageId.value : undefined
  const requestSnapshotLastMessageId = mode === 'more' ? snapshotLastMessageId.value : undefined

  if (mode !== 'more')
    isLoadingMore.value = false
  loadError.value = false

  if (mode === 'initial') {
    isInitialLoading.value = true
    isRefreshing.value = false
  }
  else if (mode === 'refresh') {
    isRefreshing.value = true
    isInitialLoading.value = false
  }
  else {
    isLoadingMore.value = true
  }

  try {
    const response = await listAgentChatSessions({
      limit: PAGE_SIZE,
      beforeLastMessageId: requestBeforeLastMessageId,
      snapshotLastMessageId: requestSnapshotLastMessageId,
      keyword: requestKeyword || undefined,
    })
    if (sequence !== requestSequence || requestKeyword !== appliedKeyword.value)
      return false

    const items = response.items.map(toHistoryConversation)
    if (mode === 'more') {
      const existingIds = new Set(conversations.value.map(item => item.id))
      conversations.value.push(...items.filter(item => !existingIds.has(item.id)))
    }
    else {
      conversations.value = items
      loadedKeyword.value = requestKeyword
    }
    hasMore.value = response.hasMore
    nextBeforeLastMessageId.value = response.nextBeforeLastMessageId
    snapshotLastMessageId.value = response.snapshotLastMessageId ?? requestSnapshotLastMessageId
    selectedIds.value = selectedIds.value.filter(id => conversations.value.some(item => item.id === id))
    return true
  }
  catch {
    if (sequence === requestSequence && requestKeyword === appliedKeyword.value) {
      loadError.value = true
      if (mode !== 'more')
        appliedKeyword.value = loadedKeyword.value
      uni.showToast({ title: '历史对话加载失败，请稍后重试', icon: 'none' })
    }
    return false
  }
  finally {
    if (sequence === requestSequence) {
      isInitialLoading.value = false
      isRefreshing.value = false
      isLoadingMore.value = false
    }
  }
}

function refreshConversations() {
  void loadConversations('refresh')
}

function loadMore() {
  void loadConversations('more')
}

function submitSearch() {
  uni.hideKeyboard()
  appliedKeyword.value = keyword.value.trim()
  void loadConversations('initial')
}

function clearSearch() {
  keyword.value = ''
  if (appliedKeyword.value) {
    appliedKeyword.value = ''
    void loadConversations('initial')
  }
}

function goBack() {
  if (isNavigatingBack.value || isDeleting.value)
    return
  isNavigatingBack.value = true
  uni.navigateBack({ complete: () => (isNavigatingBack.value = false) })
}

function startNewConversationFromHistory() {
  if (isEditing.value || isDeleting.value || isNavigatingBack.value)
    return
  isNavigatingBack.value = true
  markNewConversationRequest()
  uni.navigateBack({
    fail: clearNewConversationRequest,
    complete: () => (isNavigatingBack.value = false),
  })
}

function toggleEditing() {
  if (isDeleting.value)
    return
  isEditing.value = !isEditing.value
  selectedIds.value = []
}

function openConversation(conversationId: string) {
  if (isEditing.value) {
    selectedIds.value = selectedIds.value.includes(conversationId)
      ? selectedIds.value.filter(id => id !== conversationId)
      : [...selectedIds.value, conversationId]
    return
  }
  if (isNavigatingBack.value || isDeleting.value)
    return
  isNavigatingBack.value = true
  setActiveHistoryConversation(conversationId)
  uni.navigateBack({ complete: () => (isNavigatingBack.value = false) })
}

function toggleAll() {
  if (isDeleting.value)
    return
  selectedIds.value = isAllSelected.value ? [] : conversations.value.map(item => item.id)
}

async function performDelete(conversationIds: string[]) {
  isDeleting.value = true
  const requestedIds = Array.from(new Set(conversationIds.map(id => id.trim()).filter(Boolean)))
  const deletedSet = new Set<string>()
  const unchangedSet = new Set<string>()
  try {
    for (let offset = 0; offset < requestedIds.length; offset += 100) {
      const batch = requestedIds.slice(offset, offset + 100)
      try {
        const result = await batchDeleteAgentChatSessions(batch)
        const batchSet = new Set(batch)
        result.deletedSessionIds
          .filter(id => batchSet.has(id))
          .forEach(id => deletedSet.add(id))
        result.unchangedSessionIds
          .filter(id => batchSet.has(id))
          .forEach(id => unchangedSet.add(id))
        batch.forEach((id) => {
          if (!deletedSet.has(id) && !unchangedSet.has(id))
            unchangedSet.add(id)
        })
      }
      catch {
        batch.forEach(id => unchangedSet.add(id))
      }
    }
  }
  finally {
    isDeleting.value = false
  }

  const deletedIds = requestedIds.filter(id => deletedSet.has(id))
  const unchangedIds = requestedIds.filter(id => !deletedSet.has(id) && unchangedSet.has(id))
  if (deletedIds.length) {
    conversations.value = conversations.value.filter(item => !deletedSet.has(item.id))
    markDeletedConversationIds(deletedIds)
  }
  selectedIds.value = unchangedIds
  isEditing.value = unchangedIds.length > 0

  if (deletedIds.length) {
    const refreshed = await loadConversations('refresh')
    if (!refreshed && !conversations.value.length && hasMore.value)
      await loadConversations('more')
  }

  if (unchangedIds.length) {
    uni.showToast({
      title: deletedIds.length
        ? `已删除 ${deletedIds.length} 条，${unchangedIds.length} 条未删除`
        : '删除失败，请稍后重试',
      icon: 'none',
    })
  }
  else {
    uni.showToast({ title: '删除成功', icon: 'success' })
  }
}

function removeSelected() {
  if (isDeleting.value)
    return
  if (!selectedIds.value.length) {
    uni.showToast({ title: '请选择要删除的对话', icon: 'none' })
    return
  }
  const conversationIds = [...selectedIds.value]
  uni.showModal({
    title: '删除对话',
    content: `确认删除选中的 ${conversationIds.length} 条对话吗？删除后不可恢复。`,
    confirmColor: '#d84b3e',
    success: ({ confirm }) => confirm && void performDelete(conversationIds),
  })
}

function toHistoryConversation(session: AgentChatSession): HistoryConversation {
  return {
    id: session.sessionId,
    title: session.title || '未命名对话',
    summary: session.firstAssistantMessage || '暂无回复摘要',
    updatedAt: parseDate(session.lastMessageTime || session.updateTime || session.createTime),
  }
}

function parseDate(value?: string) {
  const timestamp = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : Date.now()
}

function formatDateLabel(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dateStart = new Date(date)
  dateStart.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - dateStart.getTime()) / 86_400_000)
  if (diffDays === 0)
    return '今天'
  if (diffDays === 1)
    return '昨天'
  if (diffDays <= 7)
    return '7 天内'
  return '更早'
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  if (date.toDateString() === today.toDateString())
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

onShow(() => {
  void loadConversations(conversations.value.length ? 'refresh' : 'initial')
})
</script>

<template>
  <view class="history-page">
    <view class="history-header" :style="headerStyle">
      <button class="header-button back-button" aria-label="返回 AI 对话" @tap="goBack">
        <view class="i-carbon-chevron-left" />
        <text>返回</text>
      </button>
      <text class="header-title">历史对话</text>
      <button class="header-button edit-button" :aria-label="isEditing ? '退出编辑' : '编辑对话'" @tap="toggleEditing">
        {{ isEditing ? '完成' : '编辑' }}
      </button>
    </view>

    <view class="history-actions">
      <view class="search-field">
        <view class="i-carbon-search search-icon" />
        <input
          v-model="keyword"
          confirm-type="search"
          placeholder="搜索对话标题或内容"
          placeholder-class="search-placeholder"
          @confirm="submitSearch"
        >
        <button v-if="keyword" class="clear-button" aria-label="清空搜索" @tap="clearSearch">
          <view class="i-carbon-close-filled" />
        </button>
      </view>
      <button class="search-button" @tap="submitSearch">
        搜索
      </button>
    </view>

    <view class="history-content" :style="historyContentStyle">
      <view class="history-panel">
        <view class="panel-heading">
          <view>
            <text class="panel-title">对话记录</text>
            <text class="panel-count">{{ conversations.length }} 条{{ hasMore ? '，可继续加载' : '' }}</text>
          </view>
          <button v-if="!isEditing" class="new-conversation-button" @tap="startNewConversationFromHistory">
            <view class="i-carbon-add" />
            <text>新建对话</text>
          </button>
        </view>

        <scroll-view
          class="history-scroll"
          scroll-y
          show-scrollbar
          refresher-enabled
          :refresher-triggered="isRefreshing"
          :lower-threshold="80"
          @refresherrefresh="refreshConversations"
          @scrolltolower="loadMore"
        >
          <view class="history-list-content">
            <view v-if="isInitialLoading" class="empty-state">
              <view class="history-loading-dot" />
              <text class="empty-title">正在加载历史对话</text>
            </view>

            <view v-else-if="loadError && !groupedConversations.length" class="empty-state">
              <view class="empty-icon error">
                <view class="i-carbon-warning-alt" />
              </view>
              <text class="empty-title">历史对话加载失败</text>
              <text class="empty-copy">请检查网络后重新加载</text>
              <button class="empty-retry-button" @tap="loadConversations('initial')">
                重新加载
              </button>
            </view>

            <view v-else-if="!groupedConversations.length" class="empty-state">
              <view class="empty-icon">
                <view class="i-carbon-chat" />
              </view>
              <text class="empty-title">{{ appliedKeyword ? '没有找到匹配的对话' : '还没有历史对话' }}</text>
              <text class="empty-copy">{{ appliedKeyword ? '换个关键词再试试' : '新建对话，开始你的求职咨询' }}</text>
            </view>

            <view v-for="group in groupedConversations" :key="group.label" class="history-group">
              <text class="group-title">{{ group.label }}</text>
              <view
                v-for="conversation in group.items"
                :key="conversation.id"
                class="conversation-row"
                :class="{ selected: selectedIds.includes(conversation.id) }"
                role="button"
                :aria-label="`${conversation.title}，${formatTime(conversation.updatedAt)}`"
                @tap="openConversation(conversation.id)"
              >
                <view v-if="isEditing" class="selection-circle" :class="{ selected: selectedIds.includes(conversation.id) }">
                  <view v-if="selectedIds.includes(conversation.id)" class="i-carbon-checkmark" />
                </view>
                <view class="conversation-copy">
                  <text class="conversation-title">{{ conversation.title }}</text>
                  <text class="conversation-summary">{{ conversation.summary }}</text>
                </view>
                <text class="conversation-time">{{ formatTime(conversation.updatedAt) }}</text>
                <view v-if="!isEditing" class="i-carbon-chevron-right conversation-arrow" />
              </view>
            </view>

            <view v-if="groupedConversations.length" class="load-state">
              <view v-if="isLoadingMore" class="mini-loading" />
              <text>{{ isLoadingMore ? '正在加载' : hasMore ? '上滑加载更多' : '已经到底了' }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view v-if="isEditing" class="edit-toolbar" :style="{ paddingBottom: `${safeBottom}px` }">
      <view class="toolbar-actions">
        <button class="toolbar-button" @tap="toggleAll">
          {{ isAllSelected ? '取消全选' : '全选' }}
        </button>
        <text class="selection-count">已选 {{ selectedIds.length }} 条</text>
      </view>
      <button class="delete-button" :disabled="isDeleting || !selectedIds.length" @tap="removeSelected">
        {{ isDeleting ? '删除中…' : '删除' }}
      </button>
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
  color: #202a3d;
}

button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 1;
}

button::after {
  border: 0;
}

.history-header {
  box-sizing: border-box;
  min-height: 92rpx;
  flex: none;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding-left: 24rpx;
}

.header-title {
  color: #172033;
  font-size: 34rpx;
  font-weight: 650;
}

.header-button {
  min-width: 88rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.9);
  color: #34415a;
  font-size: 26rpx;
}

.back-button {
  justify-self: start;
  padding: 0 18rpx 0 12rpx;
}

.edit-button {
  justify-self: end;
  padding: 0 22rpx;
}

.history-actions {
  height: 76rpx;
  flex: none;
  display: flex;
  gap: 12rpx;
  margin: 20rpx 24rpx 0;
}

.search-field {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 18rpx 0 24rpx;
  border: 1rpx solid rgba(116, 148, 212, 0.24);
  border-radius: 38rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8rpx 22rpx rgba(65, 98, 166, 0.1);
}

.search-icon {
  flex: none;
  margin-right: 14rpx;
  color: #7e91b4;
  font-size: 30rpx;
}

.search-field input {
  min-width: 0;
  flex: 1;
  color: #29354c;
  font-size: 27rpx;
}

:deep(.search-placeholder) {
  color: #a8b1c2;
}

.clear-button {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a6b0c1;
  font-size: 28rpx;
}

.search-button {
  width: 112rpx;
  height: 76rpx;
  flex: none;
  border-radius: 38rpx;
  background: linear-gradient(105deg, #5e8eff, #4779ef);
  box-shadow: 0 8rpx 20rpx rgba(65, 106, 205, 0.2);
  color: #fff;
  font-size: 27rpx;
  font-weight: 600;
}

.history-content {
  box-sizing: border-box;
  min-height: 0;
  flex: 1;
  display: flex;
  padding: 24rpx 22rpx 0;
}

.history-panel {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 12rpx 32rpx rgba(68, 99, 168, 0.1);
}

.panel-heading {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 28rpx 20rpx;
}

.panel-heading > view:first-child {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.panel-title {
  color: #26324a;
  font-size: 31rpx;
  font-weight: 650;
}

.panel-count {
  margin-top: 6rpx;
  color: #939eb2;
  font-size: 22rpx;
}

.new-conversation-button {
  height: 64rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 0 22rpx;
  border-radius: 32rpx;
  background: #edf3ff;
  color: #3f72db;
  font-size: 25rpx;
  font-weight: 600;
}

.history-scroll {
  width: 100%;
  height: 0;
  min-height: 0;
  flex: 1;
}

.history-list-content {
  box-sizing: border-box;
  min-height: 100%;
  padding: 8rpx 20rpx 28rpx;
}

.history-group + .history-group {
  margin-top: 22rpx;
}

.group-title {
  display: block;
  padding: 0 10rpx 12rpx;
  color: #7e899d;
  font-size: 24rpx;
  font-weight: 600;
}

.conversation-row {
  min-height: 120rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
  padding: 18rpx 18rpx 18rpx 20rpx;
  border: 1rpx solid rgba(220, 228, 242, 0.86);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.92);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease;
}

.conversation-row:active {
  transform: scale(0.992);
}

.conversation-row.selected {
  border-color: rgba(68, 119, 224, 0.48);
  background: #f5f8ff;
}

.selection-circle {
  width: 38rpx;
  height: 38rpx;
  flex: 0 0 38rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #b2bccd;
  border-radius: 50%;
  color: #fff;
  font-size: 24rpx;
}

.selection-circle.selected {
  border-color: #4779ef;
  background: #4779ef;
}

.conversation-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.conversation-title,
.conversation-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-title {
  color: #2b354b;
  font-size: 28rpx;
  font-weight: 600;
}

.conversation-summary {
  margin-top: 10rpx;
  color: #8b96a9;
  font-size: 23rpx;
}

.conversation-time {
  flex: none;
  color: #9ca6b6;
  font-size: 22rpx;
  font-variant-numeric: tabular-nums;
}

.conversation-arrow {
  flex: none;
  color: #a6b2c7;
  font-size: 26rpx;
}

.empty-state {
  min-height: 520rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  width: 104rpx;
  height: 104rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 32rpx;
  background: #edf3ff;
  color: #6088df;
  font-size: 52rpx;
}

.empty-icon.error {
  background: #fff0ee;
  color: #c65b50;
}

.empty-title {
  margin-top: 24rpx;
  color: #405071;
  font-size: 29rpx;
  font-weight: 600;
}

.empty-copy {
  margin-top: 10rpx;
  color: #96a0b3;
  font-size: 24rpx;
}

.empty-retry-button {
  min-width: 192rpx;
  min-height: 88rpx;
  margin-top: 28rpx;
  padding: 0 32rpx;
  border-radius: 44rpx;
  background: linear-gradient(105deg, #5e8eff, #4779ef);
  color: #fff;
  font-size: 25rpx;
  font-weight: 600;
  line-height: 88rpx;
}

.empty-retry-button::after {
  border: 0;
}

.load-state {
  min-height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: #9ca5b5;
  font-size: 22rpx;
}

.history-loading-dot,
.mini-loading {
  box-sizing: border-box;
  border: 4rpx solid rgba(82, 126, 219, 0.18);
  border-top-color: #527edb;
  border-radius: 50%;
  animation: history-loading 0.8s linear infinite;
}

.history-loading-dot {
  width: 42rpx;
  height: 42rpx;
}

.mini-loading {
  width: 26rpx;
  height: 26rpx;
  border-width: 3rpx;
}

.edit-toolbar {
  z-index: 30;
  min-height: 96rpx;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 26rpx;
  padding-left: 26rpx;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 -6rpx 22rpx rgba(54, 66, 96, 0.1);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 22rpx;
}

.toolbar-button {
  height: 64rpx;
  padding: 0 22rpx;
  border-radius: 32rpx;
  background: #eef3fb;
  color: #405071;
  font-size: 26rpx;
}

.selection-count {
  color: #8a95a8;
  font-size: 24rpx;
}

.delete-button {
  height: 64rpx;
  padding: 0 28rpx;
  border-radius: 32rpx;
  background: #fff0ee;
  color: #d34c3f;
  font-size: 26rpx;
  font-weight: 600;
}

.delete-button[disabled] {
  opacity: 0.45;
}

@keyframes history-loading {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .history-loading-dot,
  .mini-loading {
    animation: none;
  }
}
</style>
