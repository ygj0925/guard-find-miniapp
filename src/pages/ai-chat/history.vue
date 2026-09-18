<script setup lang="ts">
import type { AgentChatCursor, AgentChatSession } from '@/api/agent'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { batchDeleteAgentChatSessions, listAgentChatSessions } from '@/api/agent'
import { safeAreaInsets } from '@/utils/systemInfo'
import {
  markDeletedConversationIds,
  setActiveHistoryConversation,
} from './aiHistory'
import { aiHeaderMetrics } from './aiLayout'

definePage({
  excludeLoginPath: true,
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '对话记录',
    disableScroll: true,
  },
})

interface HistoryConversation {
  id: string
  title: string
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
const nextBeforeLastMessageId = ref<AgentChatCursor>()
const snapshotLastMessageId = ref<AgentChatCursor>()
const isInitialLoading = ref(false)
const isRefreshing = ref(false)
const isLoadingMore = ref(false)
const loadError = ref(false)
const isDeleting = ref(false)
const isNavigatingBack = ref(false)
const safeBottom = safeAreaInsets?.bottom || 0
let requestSequence = 0

const brandHeaderStyle = {
  height: `${aiHeaderMetrics.height}px`,
  paddingTop: `${aiHeaderMetrics.statusBarHeight}px`,
  paddingRight: `${aiHeaderMetrics.rightPadding}px`,
}
const historyContentStyle = computed(() => ({
  paddingBottom: `${isEditing.value ? 12 : safeBottom + 12}px`,
}))
const conversationCountLabel = computed(() => (
  `${hasMore.value ? '已加载' : '共'} ${conversations.value.length} 条`
))
const groupedConversations = computed(() => {
  const groups = new Map<string, HistoryConversation[]>()
  conversations.value
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .forEach((conversation) => {
      const label = formatDateLabel(conversation.updatedAt)
      const items = groups.get(label) || []
      items.push(conversation)
      groups.set(label, items)
    })
  return ['7天内', '更早']
    .filter(label => groups.has(label))
    .map(label => ({ label, items: groups.get(label) || [] }))
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
      uni.showToast({ title: '对话记录加载失败，请稍后重试', icon: 'none' })
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
    updatedAt: parseDate(session.lastMessageTime || session.updateTime || session.createTime),
  }
}

function parseDate(value?: string) {
  const timestamp = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : 0
}

function formatDateLabel(timestamp: number) {
  if (timestamp <= 0)
    return '更早'
  const date = new Date(timestamp)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dateStart = new Date(date)
  dateStart.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - dateStart.getTime()) / 86_400_000)
  return diffDays <= 7 ? '7天内' : '更早'
}

function formatTime(timestamp: number) {
  if (timestamp <= 0)
    return '--:--'
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

onShow(() => {
  void loadConversations(conversations.value.length ? 'refresh' : 'initial')
})
</script>

<template>
  <view class="history-page">
    <view class="history-top-shell">
      <view class="brand-header" :style="brandHeaderStyle">
        <view class="brand-identity">
          <image
            class="brand-logo"
            src="https://static1.3sbio.com/assets/lingcai/%E5%9B%BE%E6%A0%87.png"
            mode="aspectFill"
            aria-hidden="true"
          />
          <text class="brand-name">生生智家</text>
        </view>
      </view>

      <view class="history-nav">
        <button class="nav-button back-button" aria-label="返回 AI 对话" @tap="goBack">
          <view class="nav-button-pill">
            <view class="i-carbon-arrow-left nav-icon" aria-hidden="true" />
            <text>返回</text>
          </view>
        </button>
        <button class="nav-button edit-button" :aria-label="isEditing ? '完成编辑' : '编辑对话'" @tap="toggleEditing">
          <view class="nav-button-pill">
            <text>{{ isEditing ? '完成' : '编辑' }}</text>
          </view>
        </button>
      </view>

      <view class="search-row">
        <view class="search-field">
          <view class="i-carbon-search search-icon" aria-hidden="true" />
          <input
            v-model="keyword"
            confirm-type="search"
            placeholder="搜索历史对话"
            placeholder-class="search-placeholder"
            aria-label="搜索历史对话"
            @confirm="submitSearch"
          >
          <button v-if="keyword" class="clear-button" aria-label="清空搜索" @tap="clearSearch">
            <view class="i-carbon-close-filled" aria-hidden="true" />
          </button>
        </view>
        <button class="search-button" aria-label="搜索对话" @tap="submitSearch">
          <view class="i-carbon-search" aria-hidden="true" />
          <text>搜索</text>
        </button>
      </view>
    </view>

    <view class="history-content" :style="historyContentStyle">
      <view class="history-panel">
        <view class="panel-heading">
          <text class="panel-title">对话记录</text>
          <text class="panel-count">{{ conversationCountLabel }}</text>
        </view>

        <scroll-view
          class="history-scroll"
          scroll-y
          :show-scrollbar="false"
          refresher-enabled
          :refresher-triggered="isRefreshing"
          :lower-threshold="80"
          @refresherrefresh="refreshConversations"
          @scrolltolower="loadMore"
        >
          <view class="history-list-content">
            <view v-if="isInitialLoading" class="empty-state">
              <view class="history-loading-dot" />
              <text class="empty-title">正在加载对话记录</text>
            </view>

            <view v-else-if="loadError && !groupedConversations.length" class="empty-state">
              <view class="empty-icon error">
                <view class="i-carbon-warning-alt" aria-hidden="true" />
              </view>
              <text class="empty-title">对话记录加载失败</text>
              <text class="empty-copy">请检查网络后重新加载</text>
              <button class="empty-retry-button" @tap="loadConversations('initial')">
                重新加载
              </button>
            </view>

            <view v-else-if="!groupedConversations.length" class="empty-state">
              <view class="empty-icon">
                <view class="i-carbon-chat" aria-hidden="true" />
              </view>
              <text class="empty-title">{{ appliedKeyword ? '没有找到匹配的对话' : '还没有对话记录' }}</text>
              <text class="empty-copy">{{ appliedKeyword ? '换个关键词再试试' : '新建对话，开始你的求职咨询' }}</text>
            </view>

            <view v-for="(group, groupIndex) in groupedConversations" :key="group.label" class="history-group">
              <view v-if="groupIndex" class="group-divider" />
              <text class="group-title">{{ group.label }}</text>
              <view
                v-for="conversation in group.items"
                :key="conversation.id"
                class="conversation-row"
                :class="{ selected: selectedIds.includes(conversation.id) }"
                :role="isEditing ? 'checkbox' : 'button'"
                :aria-checked="isEditing ? selectedIds.includes(conversation.id) : undefined"
                :aria-label="`${conversation.title}，${formatTime(conversation.updatedAt)}`"
                @tap="openConversation(conversation.id)"
              >
                <view
                  v-if="isEditing"
                  class="selection-circle"
                  :class="{ selected: selectedIds.includes(conversation.id) }"
                >
                  <view
                    v-if="selectedIds.includes(conversation.id)"
                    class="i-carbon-checkmark"
                    aria-hidden="true"
                  />
                </view>
                <text class="conversation-title">{{ conversation.title }}</text>
                <text class="conversation-time">{{ formatTime(conversation.updatedAt) }}</text>
              </view>
            </view>

            <view v-if="groupedConversations.length" class="load-state">
              <view v-if="isLoadingMore" class="mini-loading" />
              <text>{{ isLoadingMore ? '正在加载更多' : hasMore ? '继续上滑加载更多' : '已经到底了' }}</text>
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

:global(page) {
  background: #edf6ff url('https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/背景.jpg') center / cover
    no-repeat;
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

.history-top-shell {
  position: relative;
  z-index: 2;
  flex: none;
}

.brand-header {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding-left: 28rpx;
}

.brand-identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.brand-logo {
  width: 60rpx;
  height: 60rpx;
  flex: 0 0 60rpx;
  overflow: hidden;
  border-radius: 50%;
  box-shadow: 0 4rpx 14rpx rgba(45, 111, 230, 0.16);
}

.brand-name {
  overflow: hidden;
  color: #162136;
  font-size: 34rpx;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-nav {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14rpx;
  padding: 8rpx 24rpx 0;
}

.nav-button {
  box-sizing: border-box;
  min-width: 44px;
  height: 88rpx;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #2d374a;
  font-size: 27rpx;
  transition: opacity 0.15s ease;
}

.nav-button-pill {
  box-sizing: border-box;
  height: 56rpx;
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border: 1rpx solid rgba(113, 145, 211, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.nav-button:active {
  opacity: 0.78;
}

.nav-button:active .nav-button-pill {
  background: #eef4ff;
}

.nav-icon {
  flex: none;
  font-size: 28rpx;
}

.back-button {
  justify-self: start;
}

.edit-button {
  grid-column: 3;
  justify-self: end;
}

.back-button .nav-button-pill {
  padding: 0 16rpx;
}

.edit-button .nav-button-pill {
  padding: 0 20rpx;
}

.search-row {
  box-sizing: border-box;
  height: 88rpx;
  display: flex;
  margin: 24rpx 24rpx 0;
  overflow: hidden;
  border: 1rpx solid rgba(112, 143, 205, 0.18);
  border-radius: 44rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8rpx 22rpx rgba(65, 98, 166, 0.12);
}

.search-field {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 24rpx;
}

.search-icon {
  flex: none;
  margin-right: 14rpx;
  color: #7f91b1;
  font-size: 30rpx;
}

.search-field input {
  min-width: 0;
  height: 88rpx;
  flex: 1;
  color: #29354c;
  font-size: 28rpx;
}

:deep(.search-placeholder) {
  color: #a5afc0;
}

.clear-button {
  width: 72rpx;
  height: 88rpx;
  flex: 0 0 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca8ba;
  font-size: 27rpx;
}

.search-button {
  width: 132rpx;
  height: 88rpx;
  flex: 0 0 132rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  background: linear-gradient(105deg, #668fff, #4d80f3);
  color: #fff;
  font-size: 27rpx;
  font-weight: 600;
}

.search-button:active {
  opacity: 0.78;
}

.history-content {
  box-sizing: border-box;
  min-height: 0;
  flex: 1;
  display: flex;
  padding: 24rpx 22rpx 0;
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
  border: 1rpx solid rgba(255, 255, 255, 0.92);
  border-radius: 36rpx;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 12rpx 32rpx rgba(68, 99, 168, 0.1);
}

.panel-heading {
  position: relative;
  min-height: 92rpx;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 28rpx;
}

.panel-title {
  color: #30394a;
  font-size: 31rpx;
  font-weight: 600;
  text-align: center;
}

.panel-count {
  position: absolute;
  right: 28rpx;
  color: #8b96a9;
  font-size: 22rpx;
  font-variant-numeric: tabular-nums;
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
  padding: 4rpx 26rpx 28rpx;
}

.history-group {
  margin-bottom: 24rpx;
}

.group-divider {
  height: 1rpx;
  margin: 10rpx 0 28rpx;
  background: rgba(145, 157, 179, 0.22);
}

.group-title {
  display: block;
  margin: 0 8rpx 10rpx;
  color: #30394a;
  font-size: 29rpx;
  font-weight: 600;
}

.conversation-row {
  box-sizing: border-box;
  min-height: 88rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 12rpx;
  padding: 6rpx 8rpx;
  border-radius: 16rpx;
  transition:
    background-color 0.15s ease,
    opacity 0.15s ease;
}

.conversation-row:active {
  background: #edf4ff;
  opacity: 0.82;
}

.conversation-row.selected {
  background: #edf4ff;
}

.selection-circle {
  width: 36rpx;
  height: 36rpx;
  flex: 0 0 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #9aa8bd;
  border-radius: 50%;
  color: #fff;
  font-size: 23rpx;
}

.selection-circle.selected {
  border-color: #4d7ee8;
  background: #4d7ee8;
}

.conversation-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #657085;
  font-size: 27rpx;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-time {
  flex: none;
  color: #7f899b;
  font-size: 26rpx;
  font-variant-numeric: tabular-nums;
}

.empty-state {
  min-height: 500rpx;
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
  color: #7f8ba0;
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

.load-state {
  min-height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: #8c97a9;
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

.toolbar-button,
.delete-button {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.toolbar-button {
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: 36rpx;
  background: #eef3fb;
  color: #405071;
  font-size: 26rpx;
}

.selection-count {
  color: #667388;
  font-size: 24rpx;
}

.delete-button {
  height: 72rpx;
  padding: 0 30rpx;
  border-radius: 36rpx;
  background: #fff0ee;
  color: #c94034;
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

@media (max-width: 360px) {
  .brand-name {
    font-size: 31rpx;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-button,
  .conversation-row {
    transition: none;
  }

  .history-loading-dot,
  .mini-loading {
    animation: none;
  }
}
</style>
