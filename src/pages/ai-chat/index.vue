<script setup lang="ts">
import type {
  AgentChatAskRecord,
  AgentChatMessageRecord,
  AgentChatStreamEvent,
  AgentToolAskAction,
} from '@/api/agent'
import type { MiniappRecommendMessage } from '@/api/recommend-message'
import type {
  AiChatConversation,
  AiChatMessage,
  AiChatMessageRole,
  AiChatMessageStatus,
  AiMessageActivityState,
  AiMessageExtension,
  AiMessageExtensionType,
} from './aiHistory'
import { onHide, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  getAgentChatSession,
  listAgentChatAsks,
  listAgentChatMessages,
  resolveAgentToolAsk,
  streamAgentChat,
} from '@/api/agent'
import { getMiniappRecommendMessages } from '@/api/recommend-message'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { navigateToLoginPage, toLoginPage } from '@/utils/toLoginPage'
import { safeAreaInsets, systemInfo } from '@/utils/systemInfo'
import { createMiniProgramShare, createMiniProgramTimelineShare } from '@/utils/miniProgramShare'
import {
  clearNewConversationRequest,
  consumeActiveHistoryConversation,
  consumeDeletedConversationIds,
  consumeNewConversationRequest,
  consumePendingAiQuestion,
  savePendingAiQuestion,
} from './aiHistory'
import { aiHeaderMetrics } from './aiLayout'
import AiBrandHeader from './components/AiBrandHeader.vue'
import AiComposer from './components/AiComposer.vue'
import AiFormCard from './components/AiFormCard.vue'
import AiMessageActivityGroup from './components/AiMessageActivityGroup.vue'
import AiRichText from './components/AiRichText.vue'
import { useSpeechRecognition } from './useSpeechRecognition'
import { isPageBackSwipe } from './aiSwipe'

defineOptions({
  name: 'AiChat',
})

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '生生智家',
    backgroundColor: '#EDF6FF',
    disableScroll: true,
    disableSwipeBack: true,
    enableShareAppMessage: true,
    enableShareTimeline: true,
  },
})

onShareAppMessage(() => createMiniProgramShare('生生智家 - AI 招聘助手', '/pages/ai-chat/index'))
onShareTimeline(() => createMiniProgramTimelineShare('生生智家 - AI 招聘助手'))

interface ScrollEvent {
  detail: {
    scrollHeight: number
    scrollTop: number
  }
}

interface KeyboardHeightEvent {
  height: number
}

interface PageTouchPoint {
  clientX?: number
  clientY?: number
  pageX?: number
  pageY?: number
}

interface PageTouchEvent {
  touches?: PageTouchPoint[]
  changedTouches?: PageTouchPoint[]
}

interface ActiveStream {
  cancel: () => void
}

const AI_PAGE_PATH = '/pages/ai-chat/index'
const PROCESSING_STATUS_TEXT = '正在处理你的问题…'
const tokenStore = useTokenStore()
const userStore = useUserStore()
const recommendMessages = ref<MiniappRecommendMessage[]>([])
const recommendMessagesLoading = ref(false)
const recommendMessagesFailed = ref(false)
const isAiAuthenticated = computed(() => tokenStore.hasLogin && Boolean(tokenStore.validToken))

const hasStarted = ref(false)
const inputValue = ref('')
const voiceMode = ref(false)
const voicePermissionPending = ref(false)
const currentConversation = ref<AiChatConversation | null>(null)
const isReplying = ref(false)
const isRestoringHistory = ref(false)
const isOpeningHistory = ref(false)
const loginPromptPending = ref(false)
const isFollowingLatest = ref(true)
const scrollIntoView = ref('')
const scrollWithAnimation = ref(false)
const keyboardHeight = ref(0)
const streamStatusText = ref('')
const expandedReasoningIds = ref<string[]>([])
const safeBottom = safeAreaInsets?.bottom || 0
const scrollViewportHeight = Number(systemInfo?.windowHeight || 844)
const contentViewportHeight = ref(scrollViewportHeight)
const scrollViewportWidth = Number(systemInfo?.windowWidth || 390)
const rpxScale = scrollViewportWidth / 750
const splashCopyHeight = (22 + 34 * 1.42 * 3) * rpxScale
const splashFeatureHeight = (82 + 26 * 1.35 - 18) * rpxScale
const splashActionTailHeight = (108 + 10 + 22 * 1.35 + 72) * rpxScale + safeBottom + 12
const splashHeroHeight = Math.max(
  220,
  Math.round(
    scrollViewportHeight
    - aiHeaderMetrics.height
    - splashCopyHeight
    - splashFeatureHeight
    - splashActionTailHeight
    - 10 * rpxScale,
  ),
)
const splashHeroWidth = Math.min(
  scrollViewportWidth - 24,
  Math.round(splashHeroHeight * (590 / 714)),
)
let messageSequence = 0
let extensionSequence = 0
let restoreSequence = 0
let activeStream: ActiveStream | null = null
let conversationOwnerId: string | null = null
let autoScrollTimer: ReturnType<typeof setTimeout> | null = null
let swipeStartPoint: { x: number, y: number } | null = null
let swipeNavigating = false

const speech = useSpeechRecognition({
  onResult(text) {
    inputValue.value = text
    voiceMode.value = false
  },
  onError(message) {
    uni.showToast({ title: message, icon: 'none' })
  },
  onPermissionRequired() {
    voiceMode.value = false
  },
})

const speechState = speech.state
const speechStateText = speech.stateText

const splashScrollStyle = computed(() => ({
  paddingTop: `${aiHeaderMetrics.height}px`,
}))

const splashHeroStyle = {
  width: `${splashHeroWidth}px`,
  height: `${splashHeroHeight}px`,
}

const splashBottomSpacerStyle = computed(() => ({
  height: `${safeBottom + 124}px`,
}))

const splashActionsStyle = computed(() => ({
  paddingBottom: `${safeBottom + 12}px`,
}))

const contentScrollStyle = computed(() => ({
  paddingTop: `${aiHeaderMetrics.height}px`,
  paddingBottom: `${keyboardHeight.value + (keyboardHeight.value > 0 ? 76 : safeBottom + 76)}px`,
}))

const composerStyle = computed(() => ({
  bottom: `${keyboardHeight.value}px`,
  paddingBottom: `${keyboardHeight.value > 0 ? 12 : safeBottom + 12}px`,
}))

const scrollLatestStyle = computed(() => ({
  bottom: `${keyboardHeight.value + (keyboardHeight.value > 0 ? 82 : safeBottom + 82)}px`,
}))

const visibleMessages = computed(() => (currentConversation.value?.messages || [])
  .map((message) => {
    const visibleExtensions = message.extensions.filter(isVisibleExtension)
    const formExtension = message.extensions.find(extension => extension.type === 'form')
    return { message, visibleExtensions, formExtension }
  })
  .filter(({ message, visibleExtensions, formExtension }) => Boolean(
    message.content
    || visibleExtensions.length
    || formExtension
    || message.reasoningContent
    || message.status === 'streaming',
  )))

function isVisibleExtension(extension: AiMessageExtension) {
  return extension.type === 'attachment' || extension.type === 'ask'
}

function shouldShowStreamingActivity(message: AiChatMessage) {
  const hasWaitingUserAsk = message.extensions.some(
    extension => extension.type === 'ask' && extension.state === 'waiting_user',
  )
  return message.role === 'assistant'
    && message.status === 'streaming'
    && !hasWaitingUserAsk
    && (!message.content || Boolean(streamStatusText.value))
}

function createMessage(
  role: AiChatMessageRole,
  content: string,
  status: AiChatMessageStatus = 'complete',
): AiChatMessage {
  messageSequence += 1
  return {
    id: `message-${Date.now()}-${messageSequence}`,
    role,
    content,
    createdAt: Date.now(),
    status,
    extensions: [],
  }
}

function formatMessageTime(timestamp: number) {
  const date = new Date(timestamp)
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
}

function createConversationTitle(question: string) {
  const title = question.replace(/\s+/g, ' ').trim()
  return title.length > 18 ? `${title.slice(0, 18)}…` : title
}

function startExperience() {
  hasStarted.value = true
  void measureContentViewport()
  if (currentConversation.value)
    void scrollToBottom(true, false)
}

function openHistory() {
  if (!reconcileAuthenticatedAiSession()) {
    uni.showToast({ title: '登录后可查看历史对话', icon: 'none' })
    return
  }
  if (isReplying.value) {
    uni.showToast({ title: '请先停止当前回复，再查看历史对话', icon: 'none' })
    return
  }
  if (isOpeningHistory.value || isRestoringHistory.value)
    return
  isOpeningHistory.value = true
  uni.navigateTo({
    url: '/pages/ai-chat/history',
    complete: () => (isOpeningHistory.value = false),
  })
}

function resetConversationState(started: boolean) {
  restoreSequence += 1
  if (isReplying.value || activeStream)
    cancelReply()
  clearNewConversationRequest()
  hasStarted.value = started
  currentConversation.value = null
  inputValue.value = ''
  isReplying.value = false
  isRestoringHistory.value = false
  isOpeningHistory.value = false
  isFollowingLatest.value = true
  streamStatusText.value = ''
  expandedReasoningIds.value = []
  scrollIntoView.value = ''
  scrollWithAnimation.value = false
  if (autoScrollTimer) {
    clearTimeout(autoScrollTimer)
    autoScrollTimer = null
  }
}

function currentUserId() {
  const userId = String(userStore.userInfo.userId ?? '').trim()
  return userId && userId !== '-1' ? userId : null
}

function clearAuthenticatedAiSession(preserveDraft = true) {
  const draft = preserveDraft ? inputValue.value : ''
  const keepComposerOpen = Boolean(draft.trim())
  speech.cancel()
  consumeActiveHistoryConversation()
  consumeDeletedConversationIds()
  resetConversationState(keepComposerOpen)
  inputValue.value = draft
  conversationOwnerId = null
}

function isAuthenticationError(error: unknown) {
  const details = readRecord(error)
  const code = readString(details.code)
  return details.type === 'auth' || code === 'LOGIN_REQUIRED' || code === 'UNAUTHORIZED'
}

function reconcileAuthenticatedAiSession() {
  const currentTokenStore = tokenStore.updateNowTime()
  if (!currentTokenStore.hasLogin || !currentTokenStore.validToken)
    return false

  const authenticatedUserId = currentUserId()
  if (
    conversationOwnerId !== null
    && authenticatedUserId !== null
    && conversationOwnerId !== authenticatedUserId
  ) {
    clearAuthenticatedAiSession(false)
  }
  conversationOwnerId = authenticatedUserId
  return true
}

function handleAsyncAuthLoss(error: unknown) {
  if (!isAuthenticationError(error))
    return false

  const currentTokenStore = tokenStore.updateNowTime()
  if (currentTokenStore.hasLogin && currentTokenStore.validToken) {
    // 迟到的旧请求不得退出新账号，但旧账号会话也不能继续显示或写入。
    clearAuthenticatedAiSession()
    conversationOwnerId = currentUserId()
    return true
  }

  clearAuthenticatedAiSession()
  toLoginPage({
    queryString: `?redirect=${encodeURIComponent(AI_PAGE_PATH)}`,
  })
  return true
}

function confirmQuestionLogin() {
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '登录提示',
      content: '使用该功能需要登录，请前往登录。',
      confirmText: '去登录',
      cancelText: '稍后再说',
      confirmColor: '#2d6fe6',
      success: result => resolve(result.confirm),
      fail: () => resolve(false),
    })
  })
}

async function requestLoginForQuestion(question: string) {
  if (loginPromptPending.value)
    return

  inputValue.value = question
  loginPromptPending.value = true
  try {
    if (!await confirmQuestionLogin())
      return

    if (reconcileAuthenticatedAiSession()) {
      sendMessage(question)
      return
    }

    savePendingAiQuestion(question)
    speech.cancel()
    const navigation = await navigateToLoginPage({
      queryString: `?redirect=${encodeURIComponent(AI_PAGE_PATH)}`,
    })
    if (navigation.status === 'failed') {
      uni.showToast({
        title: navigation.message || '暂时无法打开登录页，请稍后重试',
        icon: 'none',
      })
    }
  }
  finally {
    loginPromptPending.value = false
  }
}

function restorePendingQuestion() {
  const pendingQuestion = consumePendingAiQuestion()
  if (!pendingQuestion)
    return

  hasStarted.value = true
  inputValue.value = pendingQuestion
  uni.showToast({ title: '已登录，请确认问题后发送', icon: 'none' })
}

function normalizeRecommendMessages(messages: MiniappRecommendMessage[]) {
  const normalized: MiniappRecommendMessage[] = []
  if (!Array.isArray(messages))
    return normalized

  for (const item of messages) {
    if (!item || (typeof item.id !== 'string' && typeof item.id !== 'number'))
      continue

    const topic = typeof item.topic === 'string' ? item.topic.trim() : ''
    const displayMessage = typeof item.displayMessage === 'string' ? item.displayMessage.trim() : ''
    const actualMessage = typeof item.actualMessage === 'string' ? item.actualMessage.trim() : ''
    if (!displayMessage || !actualMessage)
      continue

    normalized.push({
      id: item.id,
      topic,
      displayMessage,
      actualMessage,
    })
  }
  return normalized
}

async function loadRecommendMessages() {
  if (recommendMessagesLoading.value)
    return

  recommendMessagesLoading.value = true
  recommendMessagesFailed.value = false
  try {
    recommendMessages.value = normalizeRecommendMessages(await getMiniappRecommendMessages())
  }
  catch {
    recommendMessages.value = []
    recommendMessagesFailed.value = true
  }
  finally {
    recommendMessagesLoading.value = false
  }
}

function startNewConversation() {
  resetConversationState(true)
  void measureContentViewport()
}

function sendMessage(content = inputValue.value) {
  const question = content.trim()
  if (!question || isReplying.value || isRestoringHistory.value)
    return
  if (!reconcileAuthenticatedAiSession()) {
    void requestLoginForQuestion(question)
    return
  }

  if (!currentConversation.value) {
    const createdAt = Date.now()
    currentConversation.value = {
      id: '',
      title: createConversationTitle(question),
      createdAt,
      updatedAt: createdAt,
      messages: [],
    }
  }

  inputValue.value = ''
  currentConversation.value.messages.push(createMessage('user', question))
  currentConversation.value.messages.push(createMessage('assistant', '', 'streaming'))
  // Keep the proxy returned by the reactive array; mutating the raw object would not update the view.
  const assistantMessage = currentConversation.value.messages[currentConversation.value.messages.length - 1]
  currentConversation.value.updatedAt = Date.now()
  isReplying.value = true
  isFollowingLatest.value = true
  streamStatusText.value = '正在连接 AI 助手…'
  void scrollToBottom(true, true)

  activeStream = streamAgentChat(
    {
      message: question,
      stream: true,
      sessionId: currentConversation.value.id || undefined,
    },
    {
      onEvent: event => handleStreamEvent(event, assistantMessage),
      onError: (error) => {
        if (handleAsyncAuthLoss(error))
          return
        if (assistantMessage.status !== 'streaming')
          return
        if (!assistantMessage.content)
          assistantMessage.content = error.message
        assistantMessage.status = 'error'
        finishReply()
      },
      onComplete: () => {
        if (assistantMessage.status === 'streaming') {
          if (!assistantMessage.content)
            assistantMessage.content = 'AI 回复意外中断，请重试'
          assistantMessage.status = 'error'
          finishReply()
        }
      },
    },
  )
}

function handleStreamEvent(event: AgentChatStreamEvent, assistantMessage: AiChatMessage) {
  const conversation = currentConversation.value
  if (!conversation || assistantMessage.status !== 'streaming')
    return

  if (event.sessionId)
    conversation.id = event.sessionId
  if (event.runId !== undefined)
    assistantMessage.runId = event.runId

  switch (event.type) {
    case 'start':
      streamStatusText.value = '正在思考…'
      break
    case 'status':
      streamStatusText.value = PROCESSING_STATUS_TEXT
      break
    case 'attachment':
      addOrUpdateExtension(assistantMessage, event, 'attachment')
      streamStatusText.value = attachmentStatusText(event)
      scheduleAutoScroll()
      break
    case 'delta':
      if (event.delta)
        assistantMessage.content += event.delta
      streamStatusText.value = ''
      break
    case 'reasoning_delta':
      if (event.reasoningDelta)
        assistantMessage.reasoningContent = `${assistantMessage.reasoningContent || ''}${event.reasoningDelta}`
      if (expandedReasoningIds.value.includes(assistantMessage.id))
        scheduleAutoScroll()
      break
    case 'tool_call':
      addOrUpdateExtension(assistantMessage, event, 'tool_call')
      streamStatusText.value = PROCESSING_STATUS_TEXT
      scheduleAutoScroll()
      break
    case 'tool_result':
      addOrUpdateExtension(assistantMessage, event, 'tool_result')
      streamStatusText.value = PROCESSING_STATUS_TEXT
      scheduleAutoScroll()
      break
    case 'ask':
      addOrUpdateExtension(assistantMessage, event, 'ask')
      streamStatusText.value = '需要你的进一步确认'
      scheduleAutoScroll()
      break
    case 'form':
      addOrUpdateExtension(assistantMessage, event, 'form')
      // 表单暂停代表服务端已等待用户输入，不应继续占用前端回复锁。
      // 不取消 activeStream：后端需要保留暂停的 Agent run，提交时才能续接。
      assistantMessage.status = 'complete'
      streamStatusText.value = '需要你填写表单'
      finishReply()
      scheduleAutoScroll()
      break
    case 'done':
      // 空的最终 reply 不能覆盖前面已经累计的 delta 正文。
      if (event.reply?.trim())
        assistantMessage.content = event.reply
      if (event.reasoningContent !== undefined)
        assistantMessage.reasoningContent = event.reasoningContent
      if (!assistantMessage.content.trim())
        assistantMessage.content = emptyReplyFallback(assistantMessage.extensions)
      assistantMessage.status = 'complete'
      finishReply()
      break
    case 'error':
      if (!assistantMessage.content)
        assistantMessage.content = userFacingStreamError(readEventMessage(event))
      assistantMessage.status = 'error'
      finishReply()
      break
  }

  conversation.updatedAt = Date.now()
}

function addOrUpdateExtension(
  message: AiChatMessage,
  event: AgentChatStreamEvent,
  type: AiMessageExtensionType,
) {
  const identifiedGroupId = extensionGroupIdentifier(event, type)
  const stepId = identifiedGroupId ? `${identifiedGroupId}:${type}` : ''
  const existingIndex = stepId
    ? message.extensions.findIndex(item => item.id === stepId)
    : -1
  const existing = existingIndex >= 0 ? message.extensions[existingIndex] : undefined
  const order = existing?.order ?? nextExtensionOrder()
  const groupId = existing?.groupId || identifiedGroupId || `activity-${message.id}-${order}`
  const nextState = extensionState(type, event.data)
  const extension: AiMessageExtension = {
    id: existing?.id || stepId || `${groupId}:${type}`,
    type,
    groupId,
    order,
    state: preserveTerminalState(existing?.state, nextState),
    toolName: event.toolName || existing?.toolName,
    toolCallId: event.toolCallId || existing?.toolCallId,
    askTicketId: event.askTicketId || existing?.askTicketId,
    resolutionState: type === 'ask' ? existing?.resolutionState || 'pending' : undefined,
    resolutionMessage: type === 'ask' ? existing?.resolutionMessage : undefined,
    data: { ...(existing?.data || {}), ...event.data },
  }
  if (existingIndex >= 0)
    message.extensions.splice(existingIndex, 1, extension)
  else
    message.extensions.push(extension)

  if (type === 'tool_result' || type === 'ask') {
    message.extensions
      .filter(item => item.groupId === groupId && item.type === 'tool_call')
      .forEach((item) => {
        item.state = extension.state
      })
  }
}

function extensionGroupIdentifier(event: AgentChatStreamEvent, type: AiMessageExtensionType) {
  if (event.toolCallId)
    return `tool-${event.toolCallId}`
  if (event.askTicketId)
    return `ask-${event.askTicketId}`
  if (type === 'form') {
    const formId = readString(event.data.formId)
    return formId ? `form-${formId}` : ''
  }
  if (type !== 'attachment')
    return ''
  const attachment = readRecord(event.data.attachment)
  const fileId = typeof attachment.fileId === 'number' ? String(attachment.fileId) : ''
  const fileName = readString(attachment.fileName)
  return fileId || fileName ? `attachment-${fileId || fileName}` : ''
}

function nextExtensionOrder() {
  extensionSequence += 1
  return extensionSequence
}

function extensionState(type: AiMessageExtensionType, data: Record<string, unknown>): AiMessageActivityState {
  if (type === 'tool_call' || type === 'custom')
    return 'running'
  if (type === 'ask')
    return statusState(data.status, 'waiting_user')
  if (type === 'form')
    return formStatusState(data.status)
  if (type === 'attachment')
    return statusState(readRecord(data.attachment).status, 'running')
  return statusState(data.status, 'success')
}

/** 表单卡片自己的状态机（ready/submitting/submitted/failed/unknown）映射为通用活动态，仅用于兜底展示。 */
function formStatusState(value: unknown): AiMessageActivityState {
  const status = readString(value)
  if (status === 'submitted')
    return 'success'
  if (status === 'failed')
    return 'failed'
  if (status === 'unknown')
    return 'interrupted'
  if (status === 'submitting')
    return 'running'
  return 'waiting_user'
}

function statusState(value: unknown, fallback: AiMessageActivityState): AiMessageActivityState {
  const status = readString(value).toUpperCase()
  if (['ERROR', 'FAILED', 'DENIED', 'UNAVAILABLE'].includes(status))
    return 'failed'
  if (['CANCELED', 'CANCELLED'].includes(status))
    return 'cancelled'
  if (['INTERRUPTED', 'EXPIRED'].includes(status))
    return 'interrupted'
  if (['ASK_REQUIRED', 'PENDING'].includes(status))
    return 'waiting_user'
  if (['RUNNING', 'PARSING', 'PROCESSING'].includes(status))
    return 'running'
  if (['SUCCESS', 'SUCCEEDED', 'OK', 'COMPLETED', 'CONFIRMED', 'EXECUTED'].includes(status))
    return 'success'
  return fallback
}

function preserveTerminalState(
  current: AiMessageActivityState | undefined,
  next: AiMessageActivityState,
): AiMessageActivityState {
  if (current && !['running', 'waiting_user'].includes(current) && next === 'running')
    return current
  return next
}

async function handleAskResolution(
  message: AiChatMessage,
  extension: AiMessageExtension,
  action: AgentToolAskAction,
) {
  if (extension.type !== 'ask'
    || extension.resolutionState === 'resolving'
    || extension.resolutionState === 'confirmed'
    || extension.resolutionState === 'cancelled') {
    return
  }

  const ticketId = extension.askTicketId || ''
  const argsSnapshotHash = readString(extension.data.argsSnapshotHash)
  if (!ticketId || !argsSnapshotHash) {
    extension.resolutionState = 'failed'
    extension.state = 'failed'
    extension.resolutionMessage = '确认信息不完整，请重新发起该操作。'
    return
  }

  extension.resolutionState = 'resolving'
  extension.state = 'running'
  extension.resolutionMessage = action === 'CONFIRM' ? '正在确认并继续执行…' : '正在取消本次操作…'
  scheduleAutoScroll()
  try {
    const result = await resolveAgentToolAsk(ticketId, action, {
      argsSnapshotHash,
      operatorReason: action === 'CONFIRM' ? '用户在 AI 对话中确认操作' : '用户在 AI 对话中取消操作',
    })
    const status = readString(result.status).toUpperCase()
    if (status === 'CONFIRMED') {
      extension.resolutionState = 'confirmed'
      extension.state = 'success'
      extension.resolutionMessage = readableServiceMessage(result.message) || '已确认，系统将继续执行该操作。'
    }
    else if (status === 'CANCELED' || status === 'CANCELLED') {
      extension.resolutionState = 'cancelled'
      extension.state = 'cancelled'
      extension.resolutionMessage = readableServiceMessage(result.message) || '已取消，本次操作不会继续执行。'
    }
    else if (status === 'EXECUTION_IN_PROGRESS') {
      extension.resolutionState = 'confirmed'
      extension.state = 'running'
      extension.resolutionMessage = '该操作已在执行，请勿重复提交。'
    }
    else {
      extension.resolutionState = 'failed'
      extension.state = status === 'EXPIRED' ? 'interrupted' : 'failed'
      extension.resolutionMessage = askResolutionFailureMessage(status, result.message)
    }

    if (result.toolResult)
      addAskToolResult(message, extension, result.toolResult, result.toolCode)
  }
  catch (error) {
    if (handleAsyncAuthLoss(error))
      return
    extension.resolutionState = 'failed'
    extension.state = 'failed'
    extension.resolutionMessage = '提交失败，请检查网络后重试。'
  }
  finally {
    if (currentConversation.value)
      scheduleAutoScroll()
  }
}

/**
 * 提交表单卡片：通过同一个 SSE 接口发起 mode=form_submission 请求，不插入用户气泡。
 * 提交中立即禁用卡片控件（extension.data.status='submitting'）；服务端续接的回复追加为新的助手消息。
 */
function handleFormSubmit(
  message: AiChatMessage,
  extension: AiMessageExtension,
  values: Record<string, unknown>,
) {
  if (extension.type !== 'form' || isReplying.value || isRestoringHistory.value)
    return
  const formId = readString(extension.data.formId)
  if (!formId || readString(extension.data.status) !== 'ready')
    return
  if (!reconcileAuthenticatedAiSession()) {
    toLoginPage({
      queryString: `?redirect=${encodeURIComponent(AI_PAGE_PATH)}`,
    })
    return
  }
  if (!currentConversation.value)
    return
  const sessionId = currentConversation.value.id.trim()
  if (!sessionId) {
    uni.showToast({ title: '当前会话尚未建立，请重新发起对话', icon: 'none' })
    return
  }

  extension.data = { ...extension.data, status: 'submitting' }

  currentConversation.value.messages.push(createMessage('assistant', '', 'streaming'))
  const assistantMessage = currentConversation.value.messages[currentConversation.value.messages.length - 1]
  currentConversation.value.updatedAt = Date.now()
  isReplying.value = true
  isFollowingLatest.value = true
  streamStatusText.value = '正在提交…'
  void scrollToBottom(true, true)

  activeStream = streamAgentChat(
    {
      message: '',
      stream: true,
      sessionId,
      mode: 'form_submission',
      formSubmission: { formId, values },
    },
    {
      onEvent: (event) => {
        if (event.type === 'start')
          extension.data = { ...extension.data, status: 'submitted' }
        else if (event.type === 'error')
          extension.data = { ...extension.data, status: 'failed', error: readEventMessage(event) }
        handleStreamEvent(event, assistantMessage)
      },
      onError: (error) => {
        if (handleAsyncAuthLoss(error))
          return
        extension.data = { ...extension.data, status: 'failed', error: error.message }
        if (assistantMessage.status !== 'streaming')
          return
        if (!assistantMessage.content)
          assistantMessage.content = error.message
        assistantMessage.status = 'error'
        finishReply()
      },
      onComplete: () => {
        if (assistantMessage.status === 'streaming') {
          if (!assistantMessage.content)
            assistantMessage.content = 'AI 回复意外中断，请重试'
          assistantMessage.status = 'error'
          finishReply()
        }
      },
    },
  )
}

function addAskToolResult(
  message: AiChatMessage,
  askExtension: AiMessageExtension,
  toolResult: { status?: string, data?: unknown, message?: string, toolCode?: string },
  fallbackToolCode?: string,
) {
  const groupId = askExtension.groupId
  const id = `${groupId}:tool_result`
  const existingIndex = message.extensions.findIndex(item => item.id === id)
  const existing = existingIndex >= 0 ? message.extensions[existingIndex] : undefined
  const extension: AiMessageExtension = {
    id,
    type: 'tool_result',
    groupId,
    order: existing?.order ?? nextExtensionOrder(),
    state: statusState(toolResult.status, 'success'),
    toolName: toolResult.toolCode || fallbackToolCode || askExtension.toolName,
    toolCallId: askExtension.toolCallId,
    data: {
      status: toolResult.status,
      message: readableServiceMessage(toolResult.message),
      result: toolResult.data,
    },
  }
  if (existingIndex >= 0)
    message.extensions.splice(existingIndex, 1, extension)
  else
    message.extensions.push(extension)

  message.extensions
    .filter(item => item.groupId === groupId && item.type === 'tool_call')
    .forEach((item) => {
      item.state = extension.state
    })
}

function askResolutionFailureMessage(status: string, serviceMessage?: string) {
  const messages: Record<string, string> = {
    NOT_FOUND: '确认请求不存在或已失效，请重新发起。',
    ALREADY_RESOLVED: '该确认请求已被处理，请刷新对话状态。',
    USER_MISMATCH: '当前账号无法处理该确认请求。',
    CHANNEL_MISMATCH: '请在发起该操作的渠道中完成确认。',
    ARGUMENT_HASH_MISMATCH: '操作参数已发生变化，请重新发起确认。',
    EXPIRED: '确认请求已过期，请重新发起。',
    EXECUTION_IN_PROGRESS: '该操作已在执行，请勿重复提交。',
    PAYLOAD_UNAVAILABLE: '确认上下文已失效，请重新发起该操作。',
  }
  return messages[status] || readableServiceMessage(serviceMessage) || '确认处理失败，请稍后重试。'
}

function userFacingStreamError(value: unknown) {
  const message = readString(value)
  const messages: Record<string, string> = {
    FILE_PARSE_FAILED: '附件解析失败，请重新上传或更换文件。',
    FILE_NOT_FOUND: '未找到上传的附件，请重新上传。',
    FILE_TOO_LARGE: '附件过大，请压缩后重新上传。',
    UNSUPPORTED_FILE_TYPE: '暂不支持该附件类型，请更换文件。',
  }
  if (messages[message])
    return messages[message]
  if (!message || /^[A-Z0-9_]+$/.test(message))
    return 'AI 服务暂时不可用，请稍后重试'
  return message
}

function readableServiceMessage(value: unknown) {
  const message = readString(value)
  return message && !/^[A-Z0-9_]+$/.test(message) ? message : ''
}

function emptyReplyFallback(extensions: AiMessageExtension[]) {
  if (extensions.some(item => item.state === 'failed'))
    return '本次请求处理失败，请稍后重试。'
  if (extensions.some(item => item.state === 'waiting_user'))
    return '需要你的确认后才能继续处理。'
  if (extensions.some(item => ['cancelled', 'interrupted', 'running'].includes(item.state)))
    return '本次请求已中断，请稍后重试。'
  return '本次请求已处理完成。'
}

function attachmentStatusText(event: AgentChatStreamEvent) {
  const status = readString(readRecord(event.data.attachment).status).toUpperCase()
  if (status === 'PARSING')
    return '正在解析附件…'
  if (status === 'FAILED')
    return '附件解析失败，正在继续处理…'
  if (status === 'SUCCESS')
    return '附件解析完成，正在分析…'
  return '正在处理附件…'
}

function readEventMessage(event: AgentChatStreamEvent) {
  return readString(event.data.message)
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function finishReply() {
  isReplying.value = false
  activeStream = null
  streamStatusText.value = ''
  if (currentConversation.value)
    currentConversation.value.updatedAt = Date.now()
  void scrollToBottom(false, true)
}

function cancelReply() {
  const stream = activeStream
  activeStream = null
  const messages = currentConversation.value?.messages || []
  const pendingMessage = [...messages].reverse().find(message => message.status === 'streaming')
  if (pendingMessage) {
    if (!pendingMessage.content)
      pendingMessage.content = '已停止生成'
    pendingMessage.status = 'stopped'
  }
  isReplying.value = false
  streamStatusText.value = ''
  stream?.cancel()
}

async function restoreHistorySelection() {
  isOpeningHistory.value = false
  const deletedIds = consumeDeletedConversationIds()
  if (currentConversation.value?.id && deletedIds.includes(currentConversation.value.id))
    startNewConversation()

  if (consumeNewConversationRequest()) {
    startNewConversation()
    return
  }

  const activeConversationId = consumeActiveHistoryConversation()
  if (activeConversationId)
    await restoreConversation(activeConversationId)
}

async function restoreConversation(sessionId: string) {
  const sequence = ++restoreSequence
  hasStarted.value = true
  isRestoringHistory.value = true
  isFollowingLatest.value = true
  expandedReasoningIds.value = []
  currentConversation.value = null
  try {
    const askHistoryPromise = listAgentChatAsks(sessionId, { limit: 30 })
      .then(result => result.items)
      .catch((error) => {
        if (isAuthenticationError(error))
          throw error
        console.warn('历史工具确认记录加载失败，继续展示对话正文:', error)
        return [] as AgentChatAskRecord[]
      })
    const [detail, historyResult, askHistory] = await Promise.all([
      getAgentChatSession(sessionId),
      loadHistoryMessages(sessionId),
      askHistoryPromise,
    ])
    if (sequence !== restoreSequence)
      return
    const session = detail.session
    currentConversation.value = {
      id: session.sessionId,
      title: session.title || '历史对话',
      createdAt: parseDate(session.createTime),
      updatedAt: parseDate(session.lastMessageTime || session.updateTime || session.createTime),
      messages: mapHistoryMessages(historyResult.records, askHistory),
    }
    if (historyResult.truncated) {
      uni.showToast({
        title: `对话较长，仅展示最近 ${historyResult.records.length} 条消息`,
        icon: 'none',
        duration: 3000,
      })
    }
  }
  catch (error) {
    if (handleAsyncAuthLoss(error))
      return
    if (sequence === restoreSequence) {
      currentConversation.value = null
      uni.showToast({ title: '历史对话加载失败，请稍后重试', icon: 'none' })
    }
  }
  finally {
    if (sequence === restoreSequence) {
      isRestoringHistory.value = false
      if (currentConversation.value)
        await scrollToBottom(true, false)
    }
  }
}

async function loadHistoryMessages(sessionId: string) {
  const maxRecords = 2_000
  const maxRequests = 69
  const pageSize = 30
  const recordsById = new Map<number, AgentChatMessageRecord>()
  const seenCursors = new Set<number>()
  let beforeMessageId: number | undefined
  let hasMore = true
  let loadedRecordCount = 0
  let requestCount = 0
  let truncated = false

  while (hasMore && loadedRecordCount < maxRecords && requestCount < maxRequests) {
    const limit = Math.min(pageSize, maxRecords - loadedRecordCount)
    const response = await listAgentChatMessages(sessionId, { limit, beforeMessageId })
    requestCount += 1
    const acceptedRecords = response.items.slice(0, limit)
    acceptedRecords.forEach(record => recordsById.set(record.messageId, record))
    loadedRecordCount += acceptedRecords.length
    truncated ||= response.items.length > acceptedRecords.length
    hasMore = response.hasMore
    if (!hasMore)
      break

    const nextCursor = response.nextBeforeMessageId
    if (nextCursor === undefined || seenCursors.has(nextCursor))
      throw new Error('历史消息分页游标异常')
    seenCursors.add(nextCursor)
    beforeMessageId = nextCursor
  }

  return {
    records: Array.from(recordsById.values()).sort((left, right) => left.messageId - right.messageId),
    truncated: truncated || hasMore,
  }
}

function mapHistoryMessages(records: AgentChatMessageRecord[], asks: AgentChatAskRecord[]) {
  const messages: AiChatMessage[] = []
  const assistantByRunId = new Map<number, AiChatMessage>()

  records.forEach((record) => {
    const role = readString(record.role).toLowerCase()
    const type = readString(record.type).toLowerCase() || 'text'
    const toolRecord = role === 'tool' || type === 'tool_call' || type === 'tool_result'

    if (role === 'user') {
      if (type !== 'text')
        return
      messages.push({
        id: `history-message-${record.messageId}`,
        role: 'user',
        content: record.content || '',
        createdAt: parseDate(record.createdAt),
        status: 'complete',
        runId: record.runId,
        extensions: createAttachmentExtensions(record),
      })
      return
    }

    if (role !== 'assistant' && !toolRecord)
      return
    if (role === 'assistant' && type !== 'text' && !toolRecord)
      return

    let message = record.runId === undefined ? undefined : assistantByRunId.get(record.runId)
    if (!message) {
      message = {
        id: `history-message-${record.messageId}`,
        role: 'assistant',
        content: '',
        reasoningContent: '',
        createdAt: parseDate(record.createdAt),
        status: 'complete',
        runId: record.runId,
        extensions: [],
      }
      messages.push(message)
      if (record.runId !== undefined)
        assistantByRunId.set(record.runId, message)
    }

    const formId = readString(record.data?.formId)
    if (formId && Array.isArray(record.data?.fields)) {
      const groupId = `form-${formId}`
      const extension: AiMessageExtension = {
        id: `${groupId}:form`,
        type: 'form',
        groupId,
        order: nextExtensionOrder(),
        state: formStatusState(record.data?.status),
        data: record.data || {},
      }
      const existingIndex = message.extensions.findIndex(item => item.id === extension.id)
      if (existingIndex >= 0)
        message.extensions.splice(existingIndex, 1, extension)
      else
        message.extensions.push(extension)
      return
    }

    if (toolRecord) {
      const groupId = record.toolCallId ? `tool-${record.toolCallId}` : `history-tool-${record.messageId}`
      const extensionType: 'tool_call' | 'tool_result' = type === 'tool_call' ? 'tool_call' : 'tool_result'
      message.extensions.push({
        id: `${groupId}:${extensionType}`,
        type: extensionType,
        groupId,
        order: nextExtensionOrder(),
        state: statusState(record.data?.status, extensionType === 'tool_call' ? 'running' : 'success'),
        toolName: record.toolName,
        toolCallId: record.toolCallId,
        data: record.data || {},
      })
      return
    }

    if (record.content)
      message.content += record.content
    if (record.reasoningContent)
      message.reasoningContent = record.reasoningContent
    message.extensions.push(...createAttachmentExtensions(record))
  })

  asks
    .slice()
    .sort((left, right) => parseDate(left.createdAt) - parseDate(right.createdAt) || left.askId - right.askId)
    .forEach((ask) => {
      let message = assistantByRunId.get(ask.runId)
      if (!message) {
        message = {
          id: `history-ask-message-${ask.askId}`,
          role: 'assistant',
          content: '',
          createdAt: parseDate(ask.createdAt),
          status: 'complete',
          runId: ask.runId,
          extensions: [],
        }
        let insertAfter = -1
        messages.forEach((item, index) => {
          if (item.runId === ask.runId)
            insertAfter = index
        })
        if (insertAfter >= 0)
          messages.splice(insertAfter + 1, 0, message)
        else
          messages.push(message)
        assistantByRunId.set(ask.runId, message)
      }

      const extension = createHistoryAskExtension(ask)
      const existingIndex = message.extensions.findIndex(item => item.id === extension.id)
      if (existingIndex >= 0)
        message.extensions.splice(existingIndex, 1, extension)
      else
        message.extensions.push(extension)
    })

  return messages.filter(message => message.content || message.extensions.length || message.reasoningContent)
}

function createAttachmentExtensions(record: AgentChatMessageRecord): AiMessageExtension[] {
  return record.attachments.map((attachment, index) => {
    const groupId = `history-attachment-${record.messageId}-${index}`
    return {
      id: `${groupId}:attachment`,
      type: 'attachment',
      groupId,
      order: nextExtensionOrder(),
      state: statusState(attachment.status, 'running'),
      data: { attachment },
    }
  })
}

function createHistoryAskExtension(ask: AgentChatAskRecord): AiMessageExtension {
  const status = readString(ask.status).toUpperCase()
  const pending = status === 'PENDING' && ask.resolvable
  const recoverableConfirmed = status === 'CONFIRMED' && ask.resolvable
  const confirmed = status === 'EXECUTED' || (status === 'CONFIRMED' && !ask.resolvable)
  const executing = status === 'EXECUTING'
  const cancelled = status === 'CANCELED' || status === 'CANCELLED'
  const groupId = ask.toolCallId ? `tool-${ask.toolCallId}` : `ask-${ask.askTicketId}`
  let state: AiMessageActivityState = 'failed'
  let resolutionState: AiMessageExtension['resolutionState'] = 'failed'
  let resolutionMessage = '确认请求状态异常，请重新发起该操作。'

  if (pending || recoverableConfirmed) {
    state = 'waiting_user'
    resolutionState = 'pending'
    resolutionMessage = recoverableConfirmed ? '该操作已确认，但执行尚未完成，可继续执行。' : ''
  }
  else if (executing) {
    state = 'running'
    resolutionState = 'confirmed'
    resolutionMessage = '该操作已进入执行流程，请勿重复提交；如长时间无结果请联系管理员核对。'
  }
  else if (confirmed) {
    state = 'success'
    resolutionState = 'confirmed'
    resolutionMessage = status === 'EXECUTED' ? '该操作已执行完成。' : '该操作已确认。'
  }
  else if (cancelled) {
    state = 'cancelled'
    resolutionState = 'cancelled'
    resolutionMessage = '该操作已取消。'
  }
  else if (status === 'EXPIRED') {
    state = 'interrupted'
    resolutionMessage = '确认请求已过期，请重新发起该操作。'
  }
  else if (status === 'PENDING' && !ask.resolvable) {
    state = 'interrupted'
    resolutionMessage = '确认上下文已失效，请重新发起该操作。'
  }

  return {
    id: `${groupId}:ask`,
    type: 'ask',
    groupId,
    order: nextExtensionOrder(),
    state,
    toolName: ask.toolName || readString(ask.data.toolCode),
    toolCallId: ask.toolCallId,
    askTicketId: ask.askTicketId,
    resolutionState,
    resolutionMessage,
    data: {
      ...ask.data,
      status,
      resolvable: ask.resolvable,
    },
  }
}

function parseDate(value?: string) {
  const timestamp = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : Date.now()
}

async function scrollToBottom(forceFollow = true, animated = true) {
  if (!forceFollow && !isFollowingLatest.value)
    return
  isFollowingLatest.value = true
  scrollWithAnimation.value = animated
  scrollIntoView.value = ''
  await nextTick()
  scrollIntoView.value = 'message-bottom'
}

async function measureContentViewport() {
  await nextTick()
  uni.createSelectorQuery()
    .select('.content-scroll')
    .boundingClientRect((rect) => {
      const nodeInfo = Array.isArray(rect) ? rect[0] : rect
      const height = Number(nodeInfo?.height || 0)
      if (height > 0)
        contentViewportHeight.value = height
    })
    .exec()
}

function scheduleAutoScroll() {
  if (!isFollowingLatest.value || autoScrollTimer)
    return
  autoScrollTimer = setTimeout(() => {
    autoScrollTimer = null
    void scrollToBottom(false, false)
  }, 100)
}

function handleRichTextRendered() {
  scheduleAutoScroll()
}

function handleContentScroll(event: ScrollEvent) {
  if (!currentConversation.value)
    return
  const viewportHeight = contentViewportHeight.value || scrollViewportHeight
  const distanceToBottom = event.detail.scrollHeight - event.detail.scrollTop - viewportHeight
  isFollowingLatest.value = distanceToBottom <= 48
}

function resumeAutoScroll() {
  isFollowingLatest.value = true
}

function returnToLatest() {
  void scrollToBottom(true, true)
}

function handleKeyboardHeightChange(event: KeyboardHeightEvent) {
  keyboardHeight.value = Math.max(0, Number(event.height || 0))
  void measureContentViewport()
  if (keyboardHeight.value > 0)
    void scrollToBottom(false, false)
}

function toggleReasoning(messageId: string) {
  expandedReasoningIds.value = expandedReasoningIds.value.includes(messageId)
    ? expandedReasoningIds.value.filter(id => id !== messageId)
    : [...expandedReasoningIds.value, messageId]
}

function confirmMicrophoneSettings() {
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '开启麦克风权限',
      content: '语音输入需要使用麦克风。请在设置中开启“录音”权限，开启后即可按住说话。',
      confirmText: '去设置',
      cancelText: '暂不使用',
      success: result => resolve(result.confirm),
      fail: () => resolve(false),
    })
  })
}

async function handleVoiceModeRequest(enabled: boolean) {
  if (!enabled) {
    voiceMode.value = false
    return
  }
  if (voicePermissionPending.value || isReplying.value || isRestoringHistory.value)
    return

  voiceMode.value = false
  voicePermissionPending.value = true
  try {
    let permissionResult = await speech.requestPermission()
    if (permissionResult === 'granted') {
      voiceMode.value = true
      return
    }

    if (permissionResult === 'denied') {
      const shouldOpenSettings = await confirmMicrophoneSettings()
      if (!shouldOpenSettings)
        return

      permissionResult = await speech.openPermissionSettings()
      if (permissionResult === 'granted') {
        voiceMode.value = true
        return
      }
      if (permissionResult === 'denied') {
        uni.showToast({ title: '未开启麦克风权限，已保留文字输入', icon: 'none' })
        return
      }
    }

    uni.showToast({
      title: permissionResult === 'unsupported'
        ? '当前环境暂不支持语音输入'
        : '暂时无法检查麦克风权限，请稍后重试',
      icon: 'none',
    })
  }
  finally {
    voicePermissionPending.value = false
  }
}

async function handleRecordStart() {
  const startResult = await speech.start()
  if (startResult !== 'permission-required')
    return

  voiceMode.value = false
  uni.showToast({ title: '麦克风权限已关闭，请重新点击语音图标', icon: 'none' })
}

function handleRecordStop() {
  speech.stop()
}

function handleRecordCancel() {
  speech.cancel()
}

function readPageTouchPoint(event: PageTouchEvent, preferChanged = false) {
  const touch = (preferChanged ? event.changedTouches?.[0] : event.touches?.[0])
    || event.changedTouches?.[0]
    || event.touches?.[0]
  if (!touch)
    return null

  const x = touch.clientX ?? touch.pageX
  const y = touch.clientY ?? touch.pageY
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : null
}

function handlePageTouchStart(event: PageTouchEvent) {
  swipeStartPoint = readPageTouchPoint(event)
}

function handlePageTouchMove(event: PageTouchEvent) {
  if (!swipeStartPoint)
    return

  const point = readPageTouchPoint(event)
  if (!point)
    return

  // Once the gesture is predominantly vertical, leave it to scroll-view.
  if (Math.abs(point.y - swipeStartPoint.y) > 80)
    swipeStartPoint = null
}

function navigateBackFromSwipe() {
  if (swipeNavigating)
    return

  swipeNavigating = true
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack({
      delta: 1,
      fail: () => uni.switchTab({ url: '/pages/index/index' }),
      complete: () => {
        swipeNavigating = false
      },
    })
    return
  }

  uni.switchTab({
    url: '/pages/index/index',
    complete: () => {
      swipeNavigating = false
    },
  })
}

function handlePageTouchEnd(event: PageTouchEvent) {
  const endPoint = readPageTouchPoint(event, true)
  const shouldNavigate = Boolean(
    swipeStartPoint
    && endPoint
    && isPageBackSwipe(swipeStartPoint, endPoint),
  )
  swipeStartPoint = null
  speech.stop()
  if (shouldNavigate)
    navigateBackFromSwipe()
}

function handlePageTouchCancel() {
  swipeStartPoint = null
  speech.cancel()
}

watch(
  () => tokenStore.tokenInfo,
  () => {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const currentPath = currentPage?.route ? `/${currentPage.route}` : ''
    // tab 页会被缓存；隐藏的 AI 页面不得覆盖其他页面发起的登录回跳意图。
    if (currentPath !== AI_PAGE_PATH)
      return

    if (!reconcileAuthenticatedAiSession() && (conversationOwnerId !== null || currentConversation.value))
      clearAuthenticatedAiSession()
  },
)

onShow(() => {
  const authenticated = reconcileAuthenticatedAiSession()
  if (!authenticated && (conversationOwnerId !== null || currentConversation.value))
    clearAuthenticatedAiSession()

  // 游客直接加载后端匿名快捷问题配置。
  void loadRecommendMessages()
  if (authenticated) {
    restorePendingQuestion()
    void restoreHistorySelection()
  }
  if (hasStarted.value)
    void measureContentViewport()
})
onHide(() => speech.cancel())
onMounted(() => uni.onKeyboardHeightChange(handleKeyboardHeightChange))
onUnmounted(() => {
  restoreSequence += 1
  if (activeStream)
    cancelReply()
  speech.dispose()
  if (autoScrollTimer)
    clearTimeout(autoScrollTimer)
  uni.offKeyboardHeightChange(handleKeyboardHeightChange)
})
</script>

<template>
  <view
    class="ai-page"
    @touchstart="handlePageTouchStart"
    @touchmove="handlePageTouchMove"
    @touchend.capture="handlePageTouchEnd"
    @touchcancel.capture="handlePageTouchCancel"
  >
    <view class="ai-header-fixed">
      <AiBrandHeader
        :show-history="isAiAuthenticated"
        @history="openHistory"
        @new-chat="startNewConversation"
      />
    </view>

    <scroll-view
      v-if="!hasStarted"
      class="page-scroll splash-scroll"
      scroll-y
      :show-scrollbar="false"
      :style="splashScrollStyle"
    >
      <view class="splash-page">
        <view class="splash-copy">
          <text class="splash-line">你好!</text>
          <text class="splash-line">我是生生智家助手-生生</text>
          <text class="splash-line">伴你身边每一天!</text>
        </view>

        <image
          class="splash-hero"
          src="https://static1.3sbio.com/assets/lingcai/%E7%94%9F%E7%94%9F%2B2%E4%BD%8D%E7%99%BD%E5%A4%A7%E8%A4%82.gif"
          mode="aspectFit"
          :style="splashHeroStyle"
        />

        <view class="feature-row">
          <view class="feature-item">
            <image src="https://static1.3sbio.com/assets/icon-1-job-search.svg" mode="aspectFit" />
            <text class="mt-6rpx tracking-2rpx">岗位匹配</text>
          </view>
          <view class="feature-divider" />
          <view class="feature-item">
            <image src="https://static1.3sbio.com/assets/icon-2-resume-edit.svg" mode="aspectFit" />
            <text class="mt-6rpx tracking-2rpx">简历投递</text>
          </view>
          <view class="feature-divider" />
          <view class="feature-item">
            <image src="https://static1.3sbio.com/assets/icon-3-talent-chat.svg" mode="aspectFit" />
            <text class="mt-6rpx tracking-2rpx">信息咨询</text>
          </view>
        </view>

        <view class="splash-bottom-spacer" :style="splashBottomSpacerStyle" />
      </view>
    </scroll-view>

    <view v-if="!hasStarted" class="splash-actions" :style="splashActionsStyle">
      <view class="start-button relative" role="button" aria-label="开启求职对话" @tap="startExperience">
        <text class="pointer-events-none absolute inset-0 center text-center tracking-2rpx">开启求职对话</text>
        <view class="start-arrow">
          <view class="start-arrow-icon" />
        </view>
      </view>
      <text class="ai-disclaimer" role="note">内容由人工智能生成，仅供参考</text>
    </view>

    <template v-else>
      <scroll-view
        class="page-scroll content-scroll"
        scroll-y
        :show-scrollbar="false"
        :style="contentScrollStyle"
        :scroll-into-view="scrollIntoView"
        :scroll-with-animation="scrollWithAnimation"
        :lower-threshold="24"
        @scroll="handleContentScroll"
        @scrolltolower="resumeAutoScroll"
      >
        <view v-if="isRestoringHistory" class="conversation-loading">
          <view class="conversation-loading-spinner" />
          <text>正在恢复历史对话…</text>
        </view>

        <template v-else>
          <view class="welcome-card">
            <view class="welcome-copy">
              <text>hello~我是生生</text>
              <text>欢迎来到生生智家，</text>
              <text>我是您的数智伙伴，</text>
              <text>有任何问题欢迎与我交流！</text>
            </view>
            <image class="welcome-character" src="https://static1.3sbio.com/assets/lingcai/%E7%94%9F%E7%94%9F%E7%99%BD%E5%A4%A7%E8%A4%82-%E5%8D%8A%E8%BA%AB.gif" mode="aspectFit" />
          </view>

          <view class="quick-list" aria-live="polite">
            <view v-if="recommendMessagesLoading && recommendMessages.length === 0" class="quick-status">
              <view class="quick-status-spinner" />
              <text>快捷问题加载中…</text>
            </view>

            <button
              v-else-if="recommendMessagesFailed"
              class="quick-status quick-status-action"
              hover-class="quick-status-action-active"
              aria-label="重新加载快捷问题"
              @tap="loadRecommendMessages"
            >
              <text>快捷问题加载失败，点击重试</text>
            </button>

            <view v-else-if="recommendMessages.length === 0" class="quick-status">
              <text>暂无快捷问题，可以直接输入你的需求</text>
            </view>

            <template v-else>
              <view
                v-for="item in recommendMessages"
                :key="String(item.id)"
                class="quick-item"
                :class="{ 'without-tag': !item.topic }"
                @tap="sendMessage(item.actualMessage)"
              >
                <view v-if="item.topic" class="quick-tag">
                  <text>{{ item.topic }}</text>
                </view>
                <view class="quick-question">
                  <text>{{ item.displayMessage }}</text>
                </view>
                <view class="quick-arrow" />
              </view>
            </template>
          </view>
        </template>

        <template v-if="currentConversation">
          <view
            v-for="({ message, visibleExtensions, formExtension }, messageIndex) in visibleMessages"
            :id="message.id"
            :key="message.id"
            class="message-row"
            :class="[message.role, { 'first-message-row': messageIndex === 0 }]"
          >
            <text v-if="message.role === 'user'" class="message-time">{{ formatMessageTime(message.createdAt) }}</text>
            <view
              class="message-bubble"
              :class="{
                'typing-bubble': shouldShowStreamingActivity(message) && !message.content,
                'error-bubble': message.status === 'error',
              }"
            >
              <AiMessageActivityGroup
                v-if="visibleExtensions.length"
                :extensions="visibleExtensions"
                @resolve="handleAskResolution(message, $event.extension, $event.action)"
              />

              <AiFormCard
                v-if="formExtension"
                :extension="formExtension"
                @submit="handleFormSubmit(message, formExtension, $event)"
              />

              <view v-if="message.role === 'assistant' && message.reasoningContent" class="reasoning-section">
                <button class="reasoning-toggle" @tap="toggleReasoning(message.id)">
                  <view class="i-carbon-idea" />
                  <text>{{ expandedReasoningIds.includes(message.id) ? '收起思考过程' : '查看思考过程' }}</text>
                  <view class="i-carbon-chevron-down reasoning-arrow" :class="{ expanded: expandedReasoningIds.includes(message.id) }" />
                </button>
                <view v-if="expandedReasoningIds.includes(message.id)" class="reasoning-panel">
                  <AiRichText
                    :content="message.reasoningContent"
                    :streaming="message.status === 'streaming'"
                    @rendered="handleRichTextRendered"
                  />
                </view>
              </view>

              <text v-if="message.role === 'user' && message.content" class="user-message-content">{{ message.content }}</text>
              <AiRichText
                v-else-if="message.role === 'assistant' && message.content"
                :content="message.content"
                :streaming="message.status === 'streaming'"
                @rendered="handleRichTextRendered"
              />

              <view
                v-if="shouldShowStreamingActivity(message)"
                class="typing-content"
                :class="{ 'has-content': Boolean(message.content) }"
              >
                <view class="typing-dots">
                  <view class="typing-dot" />
                  <view class="typing-dot" />
                  <view class="typing-dot" />
                </view>
                <text class="typing-label">{{ streamStatusText || '正在思考…' }}</text>
              </view>

              <text v-if="message.status === 'stopped'" class="message-state">回复已停止</text>
              <text v-else-if="message.status === 'error'" class="message-state error">回复失败，可重新发送问题</text>
              <text v-if="message.role === 'assistant' && message.status === 'complete'" class="ai-generated-note" role="note">内容由人工智能生成，仅供参考</text>
            </view>
          </view>
        </template>
        <view id="message-bottom" class="message-bottom" />
      </scroll-view>

      <view
        v-if="currentConversation && !isFollowingLatest"
        class="scroll-to-latest"
        :style="scrollLatestStyle"
        role="button"
        aria-label="回到最新消息"
        @tap="returnToLatest"
      >
        <view class="scroll-to-latest-arrow" />
      </view>

      <view class="composer-fixed" :style="composerStyle">
        <AiComposer
          v-model="inputValue"
          :disabled="isReplying || isRestoringHistory"
          :replying="isReplying"
          :chat-mode="Boolean(currentConversation)"
          :placeholder="isAiAuthenticated ? '请输入内容' : '输入问题，发送时需登录'"
          :speech-state="speechState"
          :speech-state-text="speechStateText"
          :voice-mode="voiceMode"
          :voice-permission-pending="voicePermissionPending"
          @send="sendMessage()"
          @stop="cancelReply"
          @voice-mode-request="handleVoiceModeRequest"
          @record-start="handleRecordStart"
          @record-stop="handleRecordStop"
          @record-cancel="handleRecordCancel"
        />
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.ai-page {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  width: 100%;
  overflow: hidden;
  background: #edf6ff url('https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/背景.jpg') center / cover fixed;
  color: var(--app-ink);
}

:global(page) {
  background: #edf6ff url('https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/背景.jpg') center / cover
    no-repeat;
}

.ai-header-fixed {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 30;
  background: rgba(237, 246, 255, 0.96);
}

.page-scroll {
  box-sizing: border-box;
  height: 100%;
}

.splash-page {
  box-sizing: border-box;
  min-height: 100%;
}

.splash-bottom-spacer {
  width: 100%;
  flex: none;
}

.splash-actions {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  box-sizing: border-box;
  padding-top: 32rpx;
  background-image:
    linear-gradient(180deg, rgba(237, 246, 255, 0) 0%, rgba(237, 246, 255, 0.68) 38%, rgba(237, 246, 255, 0.16) 100%),
    url('https://3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com/images/背景.jpg');
  background-repeat: no-repeat;
  background-position:
    center,
    center bottom;
  background-size:
    100% 100%,
    100vw 100vh;
}

.splash-copy {
  display: flex;
  flex-direction: column;
  padding: 22rpx 40rpx 0;
  color: var(--app-ink-soft);
  font-size: 34rpx;
  font-weight: 600;
  line-height: 1.42;
}

.splash-hero {
  display: block;
  margin: 10rpx auto 0;
}

.feature-row {
  display: grid;
  grid-template-columns: 1fr 1rpx 1fr 1rpx 1fr;
  align-items: center;
  margin: -18rpx 40rpx 0;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  color: var(--app-ink-soft);
  font-size: 26rpx;
  font-weight: 500;
  line-height: 1.35;
}

.feature-item image {
  width: 104rpx;
  height: 82rpx;
}

.feature-divider {
  width: 1rpx;
  height: 76rpx;
  background: rgba(83, 132, 243, 0.45);
}

.start-button {
  box-sizing: border-box;
  width: 480rpx;
  height: 108rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 40rpx;
  margin: 0 auto;
  padding: 10rpx 12rpx 10rpx 46rpx;
  border-radius: 58rpx;
  background: linear-gradient(100deg, #0d68ed 0%, #3d70ff 72%, #567aff 100%);
  box-shadow: 0 12rpx 30rpx rgba(36, 97, 229, 0.28);
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.start-button:active {
  transform: scale(0.98);
  box-shadow: 0 6rpx 18rpx rgba(36, 97, 229, 0.24);
}

.start-arrow {
  width: 80rpx;
  height: 80rpx;
  flex: 0 0 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
}

.start-arrow-icon {
  width: 17rpx;
  height: 17rpx;
  margin-left: -6rpx;
  border-top: 3rpx solid #1763da;
  border-right: 3rpx solid #1763da;
  transform: rotate(45deg);
}

.ai-disclaimer {
  display: block;
  margin-top: 10rpx;
  color: var(--app-muted);
  font-size: 22rpx;
  line-height: 1.35;
  text-align: center;
}

.content-scroll {
  padding-right: 24rpx;
  padding-left: 24rpx;
}

.welcome-card {
  position: relative;
  box-sizing: border-box;
  min-height: 246rpx;
  display: flex;
  align-items: center;
  margin-top: 112rpx;
  padding: 36rpx 286rpx 36rpx 52rpx;
  overflow: visible;
  border: 1rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 14rpx 34rpx rgba(70, 104, 184, 0.14);
}

.welcome-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  color: var(--app-ink-soft);
  font-size: 30rpx;
  line-height: 1.55;
}

.welcome-character {
  position: absolute;
  right: -34rpx;
  bottom: -40rpx;
  z-index: 3;
  width: 360rpx;
  height: 360rpx;
  clip-path: inset(0 0 40rpx 0);
  filter: drop-shadow(0 18rpx 22rpx rgba(50, 103, 198, 0.18));
  pointer-events: none;
}

.quick-list {
  display: flex;
  flex-direction: column;
  gap: 46rpx;
  margin-top: 42rpx;
}

.quick-status {
  box-sizing: border-box;
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 18rpx 30rpx;
  border: 2rpx solid rgba(151, 170, 255, 0.62);
  border-radius: 44rpx;
  background: rgba(255, 255, 255, 0.94);
  color: #74839d;
  font-size: 25rpx;
  line-height: 1.5;
  text-align: center;
}

.quick-status-spinner {
  box-sizing: border-box;
  width: 32rpx;
  height: 32rpx;
  flex: 0 0 32rpx;
  border: 4rpx solid rgba(82, 126, 219, 0.18);
  border-top-color: #527edb;
  border-radius: 50%;
  animation: conversation-loading 0.8s linear infinite;
}

.quick-status-action {
  width: 100%;
  margin: 0;
  color: #527edb;
}

.quick-status-action::after {
  border: 0;
}

.quick-status-action-active {
  background: rgba(231, 239, 255, 0.96);
}

.quick-item {
  position: relative;
  box-sizing: border-box;
  height: 80rpx;
  display: flex;
  align-items: center;
  overflow: hidden;
  border: 2rpx solid rgba(151, 170, 255, 0.82);
  border-radius: 42rpx;
  background: rgba(255, 255, 255, 0.98);
}

.quick-tag {
  position: absolute;
  top: -2rpx;
  bottom: -2rpx;
  left: -2rpx;
  z-index: 2;
  box-sizing: border-box;
  width: 210rpx;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  border-radius: 42rpx 0 0 42rpx;
  background: linear-gradient(104deg, #96aaff 0%, #6f96ff 48%, #4d7df2 100%);
  clip-path: polygon(
    0 0,
    100% 0,
    99% 2%,
    97.9% 4.3%,
    96.9% 6.9%,
    95.8% 9.9%,
    94.9% 13.4%,
    94% 17.5%,
    93.2% 22.1%,
    92.6% 27.3%,
    92.2% 33.3%,
    91.9% 40%,
    91.8% 45.8%,
    91.9% 51.3%,
    91.8% 56.6%,
    91.7% 61.8%,
    91.2% 67.2%,
    90.4% 72.8%,
    89.1% 78.7%,
    87.2% 85.1%,
    84.5% 92.2%,
    81% 100%,
    0 100%
  );
  color: #fff;
  font-size: 27rpx;
  font-weight: 600;
}

.quick-tag text {
  position: relative;
  z-index: 1;
  width: 174rpx;
  height: 80rpx;
  display: block;
  line-height: 80rpx;
  text-align: center;
}

.quick-question {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  margin-left: 174rpx;
  padding: 0 12rpx 0 40rpx;
}

.quick-item.without-tag .quick-question {
  margin-left: 0;
  padding-left: 34rpx;
}

.quick-question text {
  width: 100%;
  height: 80rpx;
  display: block;
  overflow: hidden;
  color: var(--app-ink);
  font-size: 27rpx;
  line-height: 80rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-arrow {
  box-sizing: border-box;
  width: 20rpx;
  height: 20rpx;
  flex: 0 0 20rpx;
  margin-right: 30rpx;
  border-top: 4rpx solid #78a0ff;
  border-right: 4rpx solid #78a0ff;
  transform: rotate(45deg);
}

.conversation-loading {
  min-height: 520rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22rpx;
  color: #74839d;
  font-size: 26rpx;
}

.conversation-loading-spinner {
  box-sizing: border-box;
  width: 46rpx;
  height: 46rpx;
  border: 5rpx solid rgba(82, 126, 219, 0.18);
  border-top-color: #527edb;
  border-radius: 50%;
  animation: conversation-loading 0.8s linear infinite;
}

.message-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 28rpx;
}

.message-row.first-message-row {
  margin-top: 32rpx;
}

.message-row.user {
  align-items: flex-end;
}

.message-row.assistant {
  align-items: flex-start;
}

.message-time {
  margin-bottom: 12rpx;
  color: var(--app-muted);
  font-size: 23rpx;
}

.ai-generated-note {
  display: block;
  margin-top: 18rpx;
  color: var(--app-muted);
  font-size: 20rpx;
  line-height: 1.4;
  text-align: center;
}

.message-bubble {
  box-sizing: border-box;
  max-width: 90%;
  padding: 26rpx 28rpx;
  overflow: hidden;
  border-radius: 28rpx;
  font-size: 29rpx;
  line-height: 1.75;
}

.user .message-bubble {
  max-width: 84%;
  border-bottom-right-radius: 8rpx;
  background: linear-gradient(135deg, #4d89ff, #5b7ff3);
  box-shadow: 0 10rpx 24rpx rgba(66, 111, 224, 0.2);
  color: #fff;
}

.user-message-content {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
}

.assistant .message-bubble {
  width: auto;
  min-width: 112rpx;
  border: 1rpx solid rgba(219, 228, 243, 0.7);
  border-bottom-left-radius: 8rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12rpx 28rpx rgba(77, 101, 155, 0.12);
  color: var(--app-ink);
}

.assistant .message-bubble.error-bubble {
  border-color: rgba(216, 75, 62, 0.22);
  background: rgba(255, 250, 249, 0.98);
}

.assistant .message-bubble :deep(.ai-rich-text p:last-child) {
  margin-bottom: 0 !important;
}

.typing-bubble {
  min-width: 250rpx;
  padding: 24rpx 28rpx;
}

.typing-content {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.typing-content.has-content {
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #e8edf5;
}

.typing-dots {
  height: 22rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.typing-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #687894;
  font-size: 24rpx;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.typing-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #6592f2;
  animation: typing 1.1s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

.reasoning-section {
  margin-bottom: 16rpx;
  padding-bottom: 14rpx;
  border-bottom: 1rpx solid #e8edf5;
}

.reasoning-toggle {
  width: 100%;
  min-height: 54rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #71819c;
  font-size: 23rpx;
  line-height: 1;
  text-align: left;
}

.reasoning-toggle::after {
  border: 0;
}

.reasoning-arrow {
  margin-left: auto;
  transition: transform 0.18s ease;
}

.reasoning-arrow.expanded {
  transform: rotate(180deg);
}

.reasoning-panel {
  margin-top: 6rpx;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background: #f5f7fb;
  color: #68758a;
  font-size: 25rpx;
}

.message-state {
  display: block;
  margin-top: 14rpx;
  color: #8b96a8;
  font-size: 21rpx;
  line-height: 1.4;
}

.message-state.error {
  color: #c45a4f;
}

.message-bottom {
  height: 24rpx;
}

.scroll-to-latest {
  position: fixed;
  left: 50%;
  z-index: 42;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(125, 158, 228, 0.36);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10rpx 28rpx rgba(55, 94, 174, 0.2);
  transform: translateX(-50%);
  transition: bottom 0.18s ease;
}

.scroll-to-latest-arrow {
  width: 18rpx;
  height: 18rpx;
  margin-top: -8rpx;
  border-right: 5rpx solid var(--app-ink-soft);
  border-bottom: 5rpx solid var(--app-ink-soft);
  transform: rotate(45deg);
}

.composer-fixed {
  position: fixed;
  right: 0;
  left: 0;
  z-index: 40;
  box-sizing: border-box;
  padding: 12rpx 22rpx 0;
  background: transparent;
  transition:
    bottom 0.18s ease,
    padding-bottom 0.18s ease;
  pointer-events: none;
}

.composer-fixed :deep(.composer-shell) {
  pointer-events: auto;
}

@keyframes conversation-loading {
  to {
    transform: rotate(360deg);
  }
}

@keyframes typing {
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  30% {
    opacity: 1;
    transform: translateY(-7rpx);
  }
}
</style>
