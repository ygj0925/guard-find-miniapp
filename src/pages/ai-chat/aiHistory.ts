export type AiChatMessageRole = 'assistant' | 'user'
export type AiChatMessageStatus = 'complete' | 'streaming' | 'stopped' | 'error'
export type AiMessageExtensionType = 'attachment' | 'tool_call' | 'tool_result' | 'ask' | 'form' | 'custom'
export type AiMessageActivityState
  = | 'running'
    | 'waiting_user'
    | 'success'
    | 'failed'
    | 'cancelled'
    | 'interrupted'

export interface AiMessageExtension {
  id: string
  type: AiMessageExtensionType
  groupId: string
  order: number
  state: AiMessageActivityState
  toolName?: string
  toolCallId?: string
  askTicketId?: string
  resolutionState?: 'pending' | 'resolving' | 'confirmed' | 'cancelled' | 'failed'
  resolutionMessage?: string
  data: Record<string, unknown>
}

export interface AiChatMessage {
  id: string
  role: AiChatMessageRole
  content: string
  reasoningContent?: string
  createdAt: number
  status: AiChatMessageStatus
  runId?: string | number
  extensions: AiMessageExtension[]
}

export interface AiChatConversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: AiChatMessage[]
}

const ACTIVE_CONVERSATION_KEY = 'recruitment-ai-active-conversation'
const NEW_CONVERSATION_REQUEST_KEY = 'recruitment-ai-new-conversation-request'
const DELETED_CONVERSATION_IDS_KEY = 'recruitment-ai-deleted-conversations'
const AI_PENDING_QUESTION_KEY = 'sss-recruitment:ai-chat:pending-question'
const AI_PENDING_QUESTION_TTL = 15 * 60 * 1000

interface PendingAiQuestion {
  question: string
  createdAt: number
}

export function setActiveHistoryConversation(conversationId: string) {
  clearNewConversationRequest()
  uni.setStorageSync(ACTIVE_CONVERSATION_KEY, conversationId)
}

export function consumeActiveHistoryConversation() {
  const conversationId = uni.getStorageSync(ACTIVE_CONVERSATION_KEY)
  uni.removeStorageSync(ACTIVE_CONVERSATION_KEY)
  return typeof conversationId === 'string' ? conversationId : ''
}

export function markNewConversationRequest() {
  uni.removeStorageSync(ACTIVE_CONVERSATION_KEY)
  uni.setStorageSync(NEW_CONVERSATION_REQUEST_KEY, Date.now())
}

export function consumeNewConversationRequest() {
  const requested = Boolean(uni.getStorageSync(NEW_CONVERSATION_REQUEST_KEY))
  clearNewConversationRequest()
  return requested
}

export function clearNewConversationRequest() {
  uni.removeStorageSync(NEW_CONVERSATION_REQUEST_KEY)
}

export function markDeletedConversationIds(conversationIds: string[]) {
  const ids = conversationIds.filter(Boolean)
  if (!ids.length)
    return
  const stored = readStringArray(uni.getStorageSync(DELETED_CONVERSATION_IDS_KEY))
  uni.setStorageSync(DELETED_CONVERSATION_IDS_KEY, Array.from(new Set([...stored, ...ids])))
}

export function consumeDeletedConversationIds() {
  const ids = readStringArray(uni.getStorageSync(DELETED_CONVERSATION_IDS_KEY))
  uni.removeStorageSync(DELETED_CONVERSATION_IDS_KEY)
  return ids
}

export function savePendingAiQuestion(question: string) {
  const normalizedQuestion = question.trim()
  if (!normalizedQuestion)
    return false

  try {
    const pendingQuestion: PendingAiQuestion = {
      question: normalizedQuestion,
      createdAt: Date.now(),
    }
    uni.setStorageSync(AI_PENDING_QUESTION_KEY, pendingQuestion)
    return true
  }
  catch {
    return false
  }
}

export function consumePendingAiQuestion() {
  let storedValue: unknown
  try {
    storedValue = uni.getStorageSync(AI_PENDING_QUESTION_KEY)
    uni.removeStorageSync(AI_PENDING_QUESTION_KEY)
  }
  catch {
    return ''
  }

  if (typeof storedValue !== 'object' || storedValue === null)
    return ''

  const pendingQuestion = storedValue as Partial<PendingAiQuestion>
  if (
    typeof pendingQuestion.question !== 'string'
    || typeof pendingQuestion.createdAt !== 'number'
    || Date.now() - pendingQuestion.createdAt > AI_PENDING_QUESTION_TTL
  ) {
    return ''
  }

  return pendingQuestion.question.trim()
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
