<script setup lang="ts">
import type { AgentChatAttachmentStatus, AgentToolAskAction } from '@/api/agent'
import type { AiMessageExtension } from '../aiHistory'
import { computed } from 'vue'

const props = defineProps<{
  extension: AiMessageExtension
}>()

const emit = defineEmits<{
  resolve: [action: AgentToolAskAction]
}>()

const attachment = computed(() => readRecord(props.extension.data.attachment))
const attachmentStatus = computed<AgentChatAttachmentStatus | ''>(() => {
  const value = readString(attachment.value.status).toUpperCase()
  return value === 'PARSING' || value === 'SUCCESS' || value === 'FAILED' ? value : ''
})
const askTemplate = computed(() => readRecord(props.extension.data.template))
const askArgs = computed(() => props.extension.data.args)
const askStatus = computed(() => readString(props.extension.data.status).toUpperCase())
const askIsResume = computed(() => askStatus.value === 'CONFIRMED')
const askCanResolve = computed(() => Boolean(
  props.extension.askTicketId
  && readString(props.extension.data.argsSnapshotHash)
  && props.extension.data.resolvable !== false,
))
const showAskActions = computed(() => props.extension.type === 'ask'
  && askCanResolve.value
  && props.extension.resolutionState !== 'confirmed'
  && props.extension.resolutionState !== 'cancelled')
const askResolving = computed(() => props.extension.resolutionState === 'resolving')
const toolResultStatus = computed(() => readString(props.extension.data.status).toUpperCase())
const toolResultFailed = computed(() => [
  'ERROR',
  'FAILED',
  'DENIED',
  'UNAVAILABLE',
].includes(toolResultStatus.value))
const toolResultInterrupted = computed(() => [
  'INTERRUPTED',
  'CANCELED',
  'CANCELLED',
  'EXPIRED',
].includes(toolResultStatus.value))
const toolResultSucceeded = computed(() => [
  'SUCCESS',
  'SUCCEEDED',
  'OK',
  'COMPLETED',
  'CONFIRMED',
  'EXECUTED',
].includes(toolResultStatus.value))
const extensionFailed = computed(() => attachmentStatus.value === 'FAILED'
  || props.extension.state === 'failed'
  || props.extension.resolutionState === 'failed'
  || toolResultFailed.value)

const iconClass = computed(() => {
  if (props.extension.type === 'ask')
    return props.extension.resolutionState === 'failed' ? 'i-carbon-warning-alt' : 'i-carbon-help'
  if (props.extension.type === 'attachment')
    return attachmentStatus.value === 'FAILED' ? 'i-carbon-warning-alt' : 'i-carbon-attachment'
  if (props.extension.type === 'tool_result') {
    if (toolResultFailed.value)
      return 'i-carbon-warning-alt'
    if (toolResultInterrupted.value)
      return 'i-carbon-stop-outline'
    return toolResultSucceeded.value ? 'i-carbon-checkmark-outline' : 'i-carbon-tools'
  }
  return 'i-carbon-tools'
})

const title = computed(() => {
  if (props.extension.type === 'ask') {
    if (props.extension.resolutionState === 'resolving')
      return '正在提交你的选择'
    if (askIsResume.value && props.extension.resolutionState === 'pending')
      return '继续执行已确认操作'
    if (props.extension.resolutionState === 'confirmed')
      return '已确认并继续执行'
    if (props.extension.resolutionState === 'cancelled')
      return '已取消本次操作'
    if (props.extension.state === 'interrupted')
      return '确认请求已失效'
    if (props.extension.resolutionState === 'failed')
      return '确认处理失败'
    return readFirstString(
      askTemplate.value.title,
      askTemplate.value.name,
      props.extension.data.title,
    ) || '需要你的确认'
  }
  if (props.extension.type === 'attachment') {
    if (attachmentStatus.value === 'PARSING')
      return '正在解析附件'
    if (attachmentStatus.value === 'FAILED')
      return '附件解析失败'
    if (attachmentStatus.value === 'SUCCESS')
      return '附件解析完成'
    return '附件处理状态未知'
  }
  if (props.extension.type === 'tool_result') {
    const toolLabel = props.extension.toolName || '操作'
    if (toolResultFailed.value)
      return `${toolLabel}执行失败`
    if (toolResultInterrupted.value)
      return `${toolLabel}已中断`
    if (toolResultSucceeded.value)
      return `${toolLabel}已完成`
    return `${toolLabel}返回结果`
  }
  if (props.extension.type === 'tool_call') {
    const toolLabel = props.extension.toolName || '工具'
    return props.extension.state === 'running' ? `正在调用 ${toolLabel}` : `调用 ${toolLabel}`
  }
  return props.extension.toolName || '正在处理任务'
})

const description = computed(() => {
  if (props.extension.type === 'attachment')
    return describeAttachment()
  if (props.extension.type === 'ask')
    return describeAsk()
  if (props.extension.type === 'tool_result')
    return describeToolResult()
  const message = readableServiceMessage(props.extension.data.message)
  if (message)
    return message
  return readString(props.extension.data.status) ? '任务正在处理中。' : ''
})

function describeToolResult() {
  const message = readableServiceMessage(props.extension.data.message)
  if (message)
    return message
  if (toolResultFailed.value)
    return '操作未能完成，请根据提示重试。'
  if (toolResultInterrupted.value)
    return '操作已停止，未继续执行。'
  if (toolResultSucceeded.value)
    return '操作已成功完成。'
  return toolResultStatus.value ? '工具已返回处理结果。' : ''
}

function describeAttachment() {
  const fileName = readString(attachment.value.fileName) || '未命名附件'
  const fileType = readString(attachment.value.fileType) || readString(attachment.value.contentType)
  const fileSize = formatFileSize(attachment.value.fileSize)
  const details = [fileName, fileType, fileSize].filter(Boolean).join(' · ')
  if (attachmentStatus.value !== 'FAILED')
    return details
  const errorCode = readString(attachment.value.errorCode)
  return `${details}\n${attachmentErrorMessage(errorCode)}`
}

function describeAsk() {
  if (props.extension.resolutionMessage)
    return props.extension.resolutionMessage
  if (!askCanResolve.value)
    return '确认信息不完整，请重新发起该操作。'
  const templateDescription = readFirstString(
    askTemplate.value.description,
    askTemplate.value.message,
    askTemplate.value.content,
    props.extension.data.message,
  )
  const argsSummary = summarizeArgs(askArgs.value)
  return [templateDescription, argsSummary].filter(Boolean).join('\n') || '请核对操作信息后确认是否继续。'
}

function summarizeArgs(value: unknown) {
  if (typeof value === 'string')
    return value.trim() ? `参数：${truncate(value.trim(), 72)}` : ''
  const record = readRecord(value)
  const entries = Object.entries(record)
    .filter(([key]) => !/password|token|secret|credential|authorization/i.test(key))
    .slice(0, 4)
    .map(([key, item]) => `${key}：${formatArgumentValue(item)}`)
  return entries.length ? `参数：${entries.join('；')}` : ''
}

function formatArgumentValue(value: unknown) {
  if (typeof value === 'string')
    return truncate(value, 28)
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (Array.isArray(value))
    return `${value.length} 项`
  return value === null || value === undefined ? '未填写' : '已提供'
}

function requestResolution(action: AgentToolAskAction) {
  if (!askCanResolve.value || askResolving.value)
    return
  emit('resolve', action)
}

function attachmentErrorMessage(errorCode: string) {
  const messages: Record<string, string> = {
    FILE_PARSE_FAILED: '文件解析失败，请重新上传或更换文件。',
    FILE_NOT_FOUND: '未找到该文件，请重新上传。',
    FILE_TOO_LARGE: '文件过大，请压缩后重新上传。',
    UNSUPPORTED_FILE_TYPE: '暂不支持该文件类型，请更换文件。',
  }
  return messages[errorCode] || '附件处理失败，请稍后重试。'
}

function formatFileSize(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    return ''
  if (value < 1024)
    return `${value} B`
  if (value < 1024 * 1024)
    return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
}

function readFirstString(...values: unknown[]) {
  for (const value of values) {
    const result = readString(value)
    if (result)
      return result
  }
  return ''
}

function readableServiceMessage(value: unknown) {
  const message = readString(value)
  return message && !/^[A-Z0-9_]+$/.test(message) ? message : ''
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
  <view
    class="extension-card"
    :class="[`extension-${extension.type}`, { 'extension-failed': extensionFailed }]"
  >
    <view class="extension-main">
      <view class="extension-icon">
        <view :class="iconClass" />
      </view>
      <view class="extension-copy">
        <text class="extension-title">{{ title }}</text>
        <text v-if="description" class="extension-description">{{ description }}</text>
      </view>
    </view>

    <view v-if="showAskActions" class="ask-actions">
      <button
        v-if="!askIsResume"
        class="ask-button ask-cancel"
        :disabled="askResolving || !askCanResolve"
        @tap="requestResolution('CANCEL')"
      >
        取消操作
      </button>
      <button
        class="ask-button ask-confirm"
        :disabled="askResolving || !askCanResolve"
        @tap="requestResolution('CONFIRM')"
      >
        {{ askResolving ? '提交中…' : askIsResume ? '继续执行' : '确认并继续' }}
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.extension-card {
  box-sizing: border-box;
  width: 100%;
  margin-top: 16rpx;
  padding: 20rpx 22rpx;
  border: 1rpx solid rgba(93, 132, 216, 0.22);
  border-radius: 20rpx;
  background: #f5f8ff;
}

.extension-main {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.extension-icon {
  width: 44rpx;
  height: 44rpx;
  flex: 0 0 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: #e7efff;
  color: #3f72d8;
  font-size: 26rpx;
}

.extension-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.extension-title {
  color: #253554;
  font-size: 25rpx;
  font-weight: 600;
  line-height: 1.45;
}

.extension-description {
  margin-top: 5rpx;
  color: #71809c;
  font-size: 23rpx;
  line-height: 1.55;
  white-space: pre-line;
  word-break: break-word;
}

.extension-ask {
  border-color: rgba(219, 158, 61, 0.3);
  background: #fff9ee;
}

.extension-ask .extension-icon {
  background: #fff0cf;
  color: #b97713;
}

.extension-failed {
  border-color: rgba(207, 80, 67, 0.28);
  background: #fff7f6;
}

.extension-failed .extension-icon {
  background: #fee8e5;
  color: #c54f42;
}

.ask-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
  padding-left: 62rpx;
}

.ask-button {
  box-sizing: border-box;
  min-height: 88rpx;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 44rpx;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.2;
}

.ask-button::after {
  border: 0;
}

.ask-cancel {
  border: 1rpx solid rgba(171, 121, 42, 0.3);
  background: rgba(255, 255, 255, 0.82);
  color: #93651f;
}

.ask-confirm {
  background: linear-gradient(105deg, #d9962f, #c47b15);
  color: #fff;
}

.ask-button[disabled] {
  opacity: 0.52;
}
</style>
