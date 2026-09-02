export type AiChatMessageRole = 'assistant' | 'user'
export type AiChatMessageStatus = 'complete' | 'streaming'

export interface AiChatMessage {
  id: string
  role: AiChatMessageRole
  content: string
  createdAt: number
  status: AiChatMessageStatus
}

export interface AiChatConversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: AiChatMessage[]
}

const HISTORY_KEY = 'recruitment-ai-conversations'
const ACTIVE_CONVERSATION_KEY = 'recruitment-ai-active-conversation'
const NEW_CONVERSATION_REQUEST_KEY = 'recruitment-ai-new-conversation-request'
const DELETED_CONVERSATION_IDS_KEY = 'recruitment-ai-deleted-conversations'

function createSeedConversations(): AiChatConversation[] {
  const now = Date.now()
  return [
    {
      id: 'history-shanghai-research',
      title: '上海研发岗位咨询',
      createdAt: now - 42 * 60 * 1000,
      updatedAt: now - 38 * 60 * 1000,
      messages: [
        createSeedMessage('user', '我想找上海的研发岗位', now - 42 * 60 * 1000, 1),
        createSeedMessage(
          'assistant',
          '可以重点关注生物药研发、工艺开发和分析研究方向。建议在简历中突出实验平台、项目阶段及具体成果。',
          now - 38 * 60 * 1000,
          2,
        ),
      ],
    },
    {
      id: 'history-medical-interview',
      title: '医学联络官面试准备',
      createdAt: now - 26 * 60 * 60 * 1000,
      updatedAt: now - 25 * 60 * 60 * 1000,
      messages: [
        createSeedMessage('user', '如何准备医学联络官面试？', now - 26 * 60 * 60 * 1000, 1),
        createSeedMessage(
          'assistant',
          '建议准备疾病领域知识、文献解读案例和跨部门沟通经历，并用具体情境说明你的表达与协作能力。',
          now - 25 * 60 * 60 * 1000,
          2,
        ),
      ],
    },
  ]
}

function createSeedMessage(
  role: AiChatMessageRole,
  content: string,
  createdAt: number,
  sequence: number,
): AiChatMessage {
  return {
    id: `seed-${sequence}-${createdAt}`,
    role,
    content,
    createdAt,
    status: 'complete',
  }
}

export function listHistoryConversations(): AiChatConversation[] {
  const stored = uni.getStorageSync(HISTORY_KEY)
  if (!Array.isArray(stored)) {
    const seeded = createSeedConversations()
    writeConversations(seeded)
    return cloneConversations(seeded)
  }
  return normalizeConversations(stored)
}

export function findHistoryConversation(conversationId: string) {
  return listHistoryConversations().find(item => item.id === conversationId)
}

export function upsertHistoryConversation(conversation: AiChatConversation) {
  if (!conversation.id || !conversation.messages.length) {
    return
  }
  const conversations = listHistoryConversations()
  const nextConversation = cloneConversation(conversation)
  const existingIndex = conversations.findIndex(item => item.id === conversation.id)
  if (existingIndex >= 0) {
    conversations.splice(existingIndex, 1, nextConversation)
  }
  else {
    conversations.push(nextConversation)
  }
  writeConversations(conversations)
}

export function deleteHistoryConversations(conversationIds: string[]) {
  const ids = new Set(conversationIds.filter(Boolean))
  if (!ids.size) {
    return
  }
  writeConversations(listHistoryConversations().filter(item => !ids.has(item.id)))
  const deletedIds = readStringArray(uni.getStorageSync(DELETED_CONVERSATION_IDS_KEY))
  uni.setStorageSync(DELETED_CONVERSATION_IDS_KEY, Array.from(new Set([...deletedIds, ...ids])))
  const activeConversationId = uni.getStorageSync(ACTIVE_CONVERSATION_KEY)
  if (typeof activeConversationId === 'string' && ids.has(activeConversationId)) {
    uni.removeStorageSync(ACTIVE_CONVERSATION_KEY)
  }
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

export function consumeDeletedConversationIds() {
  const ids = readStringArray(uni.getStorageSync(DELETED_CONVERSATION_IDS_KEY))
  uni.removeStorageSync(DELETED_CONVERSATION_IDS_KEY)
  return ids
}

function writeConversations(conversations: AiChatConversation[]) {
  const sorted = cloneConversations(conversations).sort((left, right) => right.updatedAt - left.updatedAt)
  uni.setStorageSync(HISTORY_KEY, sorted)
}

function normalizeConversations(value: unknown[]): AiChatConversation[] {
  return value.filter(isConversation).map(cloneConversation).sort((left, right) => right.updatedAt - left.updatedAt)
}

function cloneConversations(conversations: AiChatConversation[]) {
  return conversations.map(cloneConversation)
}

function cloneConversation(conversation: AiChatConversation): AiChatConversation {
  return {
    ...conversation,
    messages: conversation.messages.map(message => ({ ...message })),
  }
}

function isConversation(value: unknown): value is AiChatConversation {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.title !== 'string'
    || typeof value.createdAt !== 'number'
    || typeof value.updatedAt !== 'number'
    || !Array.isArray(value.messages)) {
    return false
  }
  return value.messages.every(isMessage)
}

function isMessage(value: unknown): value is AiChatMessage {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.role === 'assistant' || value.role === 'user')
    && typeof value.content === 'string'
    && typeof value.createdAt === 'number'
    && (value.status === 'complete' || value.status === 'streaming')
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
