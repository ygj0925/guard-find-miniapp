<script setup lang="ts">
import type { AgentToolAskAction } from '@/api/agent'
import type { AiMessageActivityState, AiMessageExtension } from '../aiHistory'
import { computed, ref } from 'vue'
import AiMessageExtensionCard from './AiMessageExtensionCard.vue'

interface ActivityGroup {
  id: string
  order: number
  state: AiMessageActivityState
  title: string
  items: AiMessageExtension[]
}

interface ResolvePayload {
  extension: AiMessageExtension
  action: AgentToolAskAction
}

const props = defineProps<{
  extensions: AiMessageExtension[]
}>()

const emit = defineEmits<{
  resolve: [payload: ResolvePayload]
}>()

const expandedGroupIds = ref<string[]>([])
const typeOrder: Record<AiMessageExtension['type'], number> = {
  attachment: 0,
  tool_call: 1,
  tool_result: 2,
  ask: 3,
  custom: 4,
}

const groups = computed<ActivityGroup[]>(() => {
  const grouped = new Map<string, AiMessageExtension[]>()
  props.extensions.forEach((extension) => {
    const groupId = extension.groupId || extension.id
    const items = grouped.get(groupId)
    if (items)
      items.push(extension)
    else
      grouped.set(groupId, [extension])
  })

  return Array.from(grouped.entries())
    .map(([id, items]) => {
      const sortedItems = [...items].sort((left, right) =>
        typeOrder[left.type] - typeOrder[right.type] || left.order - right.order)
      return {
        id,
        order: Math.min(...items.map(item => item.order)),
        state: resolveGroupState(items),
        title: resolveGroupTitle(items),
        items: sortedItems,
      }
    })
    .sort((left, right) => left.order - right.order)
})

function resolveGroupState(items: AiMessageExtension[]): AiMessageActivityState {
  if (items.some(item => item.state === 'failed'))
    return 'failed'

  const ask = latestOfType(items, 'ask')
  if (ask?.state === 'waiting_user' || ask?.resolutionState === 'pending')
    return 'waiting_user'
  if (ask?.state === 'running' || ask?.resolutionState === 'resolving')
    return 'running'

  const result = latestOfType(items, 'tool_result')
  if (result && result.state !== 'running' && result.state !== 'waiting_user')
    return result.state
  if (ask)
    return ask.state

  const latest = [...items].sort((left, right) => right.order - left.order)[0]
  return latest?.state || 'running'
}

function latestOfType(items: AiMessageExtension[], type: AiMessageExtension['type']) {
  return items
    .filter(item => item.type === type)
    .sort((left, right) => right.order - left.order)[0]
}

function resolveGroupTitle(items: AiMessageExtension[]) {
  const toolName = [...items]
    .sort((left, right) => left.order - right.order)
    .map(item => item.toolName?.trim())
    .find(Boolean)
  if (toolName)
    return toolName

  const attachmentItem = items.find(item => item.type === 'attachment')
  const attachment = readRecord(attachmentItem?.data.attachment)
  return readString(attachment.fileName) || (attachmentItem ? '附件处理' : '工具任务')
}

function isForcedOpen(group: ActivityGroup) {
  return group.state === 'waiting_user' || group.state === 'failed'
}

function isExpanded(group: ActivityGroup) {
  return isForcedOpen(group) || expandedGroupIds.value.includes(group.id)
}

function toggleGroup(group: ActivityGroup) {
  if (isForcedOpen(group))
    return
  expandedGroupIds.value = expandedGroupIds.value.includes(group.id)
    ? expandedGroupIds.value.filter(id => id !== group.id)
    : [...expandedGroupIds.value, group.id]
}

function stateLabel(state: AiMessageActivityState) {
  const labels: Record<AiMessageActivityState, string> = {
    running: '执行中',
    waiting_user: '等待确认',
    success: '已完成',
    failed: '执行失败',
    cancelled: '已取消',
    interrupted: '已中断',
  }
  return labels[state]
}

function stateIcon(state: AiMessageActivityState) {
  const icons: Record<AiMessageActivityState, string> = {
    running: 'i-carbon-tools',
    waiting_user: 'i-carbon-help',
    success: 'i-carbon-checkmark-outline',
    failed: 'i-carbon-warning-alt',
    cancelled: 'i-carbon-close-outline',
    interrupted: 'i-carbon-stop-outline',
  }
  return icons[state]
}

function handleResolve(extension: AiMessageExtension, action: AgentToolAskAction) {
  emit('resolve', { extension, action })
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
</script>

<template>
  <view class="activity-groups" aria-label="工具执行链">
    <view
      v-for="(group, groupIndex) in groups"
      :key="group.id"
      class="activity-group"
      :class="`state-${group.state}`"
    >
      <button
        class="activity-summary"
        :aria-label="`${group.title}，${stateLabel(group.state)}，${isExpanded(group) ? '收起详情' : '展开详情'}`"
        :aria-expanded="isExpanded(group)"
        @tap="toggleGroup(group)"
      >
        <text class="activity-index">{{ groupIndex + 1 }}</text>
        <view class="activity-state-icon">
          <view :class="stateIcon(group.state)" />
        </view>
        <text class="activity-title">{{ group.title }}</text>
        <text v-if="group.items.length > 1" class="activity-step-count">{{ group.items.length }} 步</text>
        <text class="activity-state-label">{{ stateLabel(group.state) }}</text>
        <view
          class="i-carbon-chevron-down activity-chevron"
          :class="{ expanded: isExpanded(group), locked: isForcedOpen(group) }"
        />
      </button>

      <view v-if="isExpanded(group)" class="activity-details">
        <AiMessageExtensionCard
          v-for="extension in group.items"
          :key="extension.id"
          :extension="extension"
          @resolve="handleResolve(extension, $event)"
        />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.activity-groups {
  width: 100%;
  margin-bottom: 18rpx;
}

.activity-group {
  overflow: hidden;
  border: 1rpx solid rgba(99, 133, 204, 0.2);
  border-radius: 20rpx;
  background: #f7f9fd;
}

.activity-group + .activity-group {
  margin-top: 12rpx;
}

.activity-summary {
  box-sizing: border-box;
  width: 100%;
  min-height: 88rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 0;
  padding: 0 18rpx;
  border: 0;
  background: transparent;
  color: #34435f;
  font-size: 23rpx;
  line-height: 1.3;
  text-align: left;
}

.activity-summary::after {
  border: 0;
}

.activity-index {
  width: 34rpx;
  height: 34rpx;
  flex: 0 0 34rpx;
  border-radius: 50%;
  background: #e8eef9;
  color: #6b7b97;
  font-size: 20rpx;
  line-height: 34rpx;
  text-align: center;
}

.activity-state-icon {
  width: 40rpx;
  height: 40rpx;
  flex: 0 0 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: #e8efff;
  color: #4674d3;
  font-size: 24rpx;
}

.activity-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #2d3c58;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-step-count {
  flex: none;
  color: #8995a9;
  font-size: 20rpx;
}

.activity-state-label {
  flex: none;
  color: #60708d;
  font-size: 21rpx;
}

.activity-chevron {
  flex: none;
  color: #8794aa;
  font-size: 22rpx;
  transform: rotate(0deg);
}

.activity-chevron.expanded {
  transform: rotate(180deg);
}

.activity-chevron.locked {
  opacity: 0.45;
}

.activity-details {
  padding: 0 14rpx 16rpx;
  border-top: 1rpx solid rgba(210, 219, 235, 0.72);
}

.activity-details :deep(.extension-card) {
  margin-top: 14rpx;
}

.state-waiting_user {
  border-color: rgba(211, 153, 57, 0.32);
  background: #fffaf1;
}

.state-waiting_user .activity-state-icon {
  background: #fff0cf;
  color: #b97713;
}

.state-failed {
  border-color: rgba(207, 80, 67, 0.28);
  background: #fff8f7;
}

.state-failed .activity-state-icon,
.state-failed .activity-state-label {
  color: #c54f42;
}

.state-failed .activity-state-icon {
  background: #fee8e5;
}

.state-success .activity-state-icon {
  background: #e8f6ee;
  color: #39865b;
}

.state-cancelled .activity-state-icon,
.state-interrupted .activity-state-icon {
  background: #edf0f5;
  color: #6f7b8d;
}
</style>
