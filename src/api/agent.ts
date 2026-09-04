import { http } from '@/http/http'
import { AUTH_TOKEN_STORAGE_KEY, useTokenStore } from '@/store/token'
import { getEnvBaseUrl } from '@/utils'
import { toLoginPage } from '@/utils/toLoginPage'
import { createAgentSseParser } from '@/pages/ai-chat/aiSseParser'

export type AgentChatStreamEventType
  = | 'start'
    | 'status'
    | 'attachment'
    | 'delta'
    | 'reasoning_delta'
    | 'tool_call'
    | 'tool_result'
    | 'ask'
    | 'done'
    | 'error'

export interface AgentChatRequest {
  message: string
  stream: true
  sessionId?: string
  websearch?: boolean
  fileIds?: number[]
  thinking?: boolean
  thinkingLevel?: 'high' | 'max'
}

export interface AgentChatStreamEvent {
  type: AgentChatStreamEventType | string
  sessionId?: string
  runId?: string | number
  delta?: string
  reply?: string
  reasoningDelta?: string
  reasoningContent?: string
  toolCallId?: string
  toolName?: string
  askTicketId?: string
  data: Record<string, unknown>
  createdAt?: string
}

export type AgentChatAttachmentStatus = 'PARSING' | 'SUCCESS' | 'FAILED'

export interface AgentChatAttachment {
  fileId?: number
  fileName?: string
  contentType?: string
  fileType?: string
  fileSize?: number
  status?: AgentChatAttachmentStatus
  errorCode?: string
  [key: string]: unknown
}

export interface AgentChatSession {
  sessionId: string
  title: string
  channel?: string
  lastMessageId?: number
  lastMessageTime?: string
  createTime?: string
  updateTime?: string
  firstAssistantMessage?: string
}

export interface AgentChatSessionPage {
  items: AgentChatSession[]
  hasMore: boolean
  nextBeforeLastMessageId?: number
  snapshotLastMessageId?: number
}

export interface AgentChatMessageRecord {
  messageId: number
  sessionId: string
  runId?: number
  type: string
  role: string
  content?: string
  reasoningContent?: string
  toolName?: string
  toolCallId?: string
  askTicketId?: string
  data: Record<string, unknown>
  attachments: AgentChatAttachment[]
  createdAt: string
}

export interface AgentChatMessagePage {
  items: AgentChatMessageRecord[]
  hasMore: boolean
  nextBeforeMessageId?: number
}

export interface AgentChatAskRecord {
  askId: number
  sessionId: string
  runId: number
  toolCallId?: string
  toolName?: string
  askTicketId: string
  status: string
  resolvable: boolean
  data: {
    toolCode?: string
    askPolicyCode?: string
    askTemplateCode?: string
    argsSnapshotHash?: string
    [key: string]: unknown
  }
  createdAt?: string
  expiresAt?: string
  resolvedAt?: string
}

export interface AgentChatAskList {
  items: AgentChatAskRecord[]
}

export interface AgentChatSessionDeleteResult {
  deleted: boolean
}

export interface AgentChatSessionBatchDeleteResult {
  requestedCount: number
  deletedCount: number
  deletedSessionIds: string[]
  unchangedSessionIds: string[]
}

export type AgentToolAskAction = 'CONFIRM' | 'CANCEL'

export interface AgentToolContext {
  traceId?: string
  conversationId?: string
  messageId?: string
  channel?: string
  username?: string
  ssoUserId?: string
  adAccount?: string
  wecomUserId?: string
  employeeCode?: string
  displayName?: string
  tenantCode?: string
  permissions?: string[]
  locale?: string
}

export interface AgentToolAskResolveOptions {
  argsSnapshotHash?: string
  context?: AgentToolContext
  operatorReason?: string
}

export interface AgentToolAskResolveResult {
  status: 'CONFIRMED' | 'CANCELED' | 'NOT_FOUND' | 'ALREADY_RESOLVED' | 'USER_MISMATCH' | 'CHANNEL_MISMATCH' | 'ARGUMENT_HASH_MISMATCH' | 'EXPIRED' | 'EXECUTION_IN_PROGRESS' | 'PAYLOAD_UNAVAILABLE' | string
  message?: string
  ticketId?: string
  toolCode?: string
  askTemplateCode?: string
  toolResult?: {
    status?: string
    data?: unknown
    message?: string
    toolCode?: string
  }
}

export interface AgentChatStreamFailure {
  code: 'LOGIN_REQUIRED' | 'UNAUTHORIZED' | 'NETWORK_ERROR' | 'HTTP_ERROR' | 'STREAM_PARSE_ERROR' | 'STREAM_TOO_LARGE' | 'STREAM_INTERRUPTED'
  message: string
}

export interface AgentChatStreamListeners {
  onEvent: (event: AgentChatStreamEvent) => void
  onError: (error: AgentChatStreamFailure) => void
  onComplete?: () => void
}

interface ChunkedRequestTask {
  abort: () => void
  onChunkReceived?: (callback: (result: { data: ArrayBuffer }) => void) => void
}

export function listAgentChatSessions(query: {
  limit?: number
  beforeLastMessageId?: number
  snapshotLastMessageId?: number
  keyword?: string
} = {}) {
  return http.get<AgentChatSessionPage>('/portal/agent/sessions', query)
}

export function getAgentChatSession(sessionId: string) {
  return http.get<{ session: AgentChatSession }>(`/portal/agent/sessions/${encodeURIComponent(sessionId)}`)
}

export function listAgentChatMessages(sessionId: string, query: { limit?: number, beforeMessageId?: number } = {}) {
  return http.get<AgentChatMessagePage>(
    `/portal/agent/sessions/${encodeURIComponent(sessionId)}/messages`,
    query,
  )
}

export function listAgentChatAsks(sessionId: string, query: { limit?: number } = {}) {
  return http.get<AgentChatAskList>(
    `/portal/agent/sessions/${encodeURIComponent(sessionId)}/asks`,
    query,
  )
}

export function deleteAgentChatSession(sessionId: string) {
  return http.delete<AgentChatSessionDeleteResult>(`/portal/agent/sessions/${encodeURIComponent(sessionId)}`)
}

export function batchDeleteAgentChatSessions(sessionIds: string[]) {
  return http.post<AgentChatSessionBatchDeleteResult>(
    '/portal/agent/sessions/batch-delete',
    { sessionIds },
  )
}

export function resolveAgentToolAsk(
  ticketId: string,
  action: AgentToolAskAction,
  options: AgentToolAskResolveOptions = {},
) {
  return http.post<AgentToolAskResolveResult>(
    `/portal/agent/tools/ask/${encodeURIComponent(ticketId)}/resolve`,
    {
      action,
      argsSnapshotHash: options.argsSnapshotHash,
      context: options.context,
      operatorReason: options.operatorReason,
    },
    undefined,
    undefined,
    { hideErrorToast: true },
  )
}

export function streamAgentChat(payload: AgentChatRequest, listeners: AgentChatStreamListeners) {
  const token = String(uni.getStorageSync<string>(AUTH_TOKEN_STORAGE_KEY) || '').replace(/^Bearer\s+/i, '').trim()
  let task: ChunkedRequestTask | undefined
  let completed = false
  let cancelled = false
  let terminal = false
  let receivedChunk = false

  function finish() {
    if (completed)
      return
    completed = true
    listeners.onComplete?.()
  }

  function fail(error: AgentChatStreamFailure) {
    if (terminal || cancelled)
      return
    terminal = true
    listeners.onError(error)
  }

  if (!token) {
    const timer = setTimeout(() => {
      fail({ code: 'LOGIN_REQUIRED', message: '请先登录后使用 AI 助手' })
      finish()
    }, 0)
    return {
      cancel() {
        cancelled = true
        clearTimeout(timer)
        finish()
      },
    }
  }

  const parser = createAgentSseParser(
    ({ event, value }) => {
      if (terminal || cancelled)
        return
      const normalized = normalizeStreamEvent(event, value)
      listeners.onEvent(normalized)
      if (normalized.type === 'done' || normalized.type === 'error')
        terminal = true
    },
    (code) => {
      fail({
        code,
        message: code === 'STREAM_TOO_LARGE' ? 'AI 返回内容过长，请缩短问题后重试' : 'AI 返回数据解析失败，请重试',
      })
      task?.abort()
    },
  )

  const baseUrl = String(getEnvBaseUrl() || '').replace(/\/$/, '')
  task = uni.request({
    url: `${baseUrl}/portal/agent/chat`,
    method: 'POST',
    timeout: 600000,
    data: payload,
    header: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json',
    },
    enableChunked: true,
    responseType: 'arraybuffer',
    success: (response) => {
      if (cancelled)
        return
      if (response.statusCode === 401) {
        // 只允许该请求使用的旧 token 清理自身；迟到的 401 不能撤销刚续期或重新登录的新凭据。
        if (useTokenStore().clearLoginState(token))
          toLoginPage()
        fail({ code: 'UNAUTHORIZED', message: '登录已过期，请重新登录' })
        return
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        fail({ code: 'HTTP_ERROR', message: readResponseMessage(response.data) || 'AI 服务暂时不可用' })
        return
      }
      if (!receivedChunk)
        pushResponseBody(parser, response.data)
    },
    fail: () => {
      if (!cancelled)
        fail({ code: 'NETWORK_ERROR', message: '网络连接失败，请检查网络后重试' })
    },
    complete: () => {
      if (!cancelled) {
        parser.finish()
        if (!terminal)
          fail({ code: 'STREAM_INTERRUPTED', message: 'AI 回复意外中断，请重试' })
      }
      finish()
    },
  }) as unknown as ChunkedRequestTask

  task.onChunkReceived?.(({ data }) => {
    if (terminal || cancelled)
      return
    receivedChunk = true
    parser.push(data)
  })

  return {
    cancel() {
      if (completed || cancelled)
        return
      cancelled = true
      task?.abort()
      finish()
    },
  }
}

function normalizeStreamEvent(eventName: string, value: Record<string, unknown>): AgentChatStreamEvent {
  return {
    type: readString(value.type) || eventName,
    sessionId: readOptionalString(value.sessionId),
    runId: readOptionalString(value.runId).trim() || readOptionalNumber(value.runId),
    delta: readOptionalString(value.delta),
    reply: readOptionalString(value.reply),
    reasoningDelta: readOptionalString(value.reasoningDelta),
    reasoningContent: readOptionalString(value.reasoningContent),
    toolCallId: readOptionalString(value.toolCallId),
    toolName: readOptionalString(value.toolName),
    askTicketId: readOptionalString(value.askTicketId),
    data: isRecord(value.data) ? value.data : {},
    createdAt: readOptionalString(value.createdAt),
  }
}

function pushResponseBody(parser: ReturnType<typeof createAgentSseParser>, value: unknown) {
  if (value instanceof ArrayBuffer) {
    parser.push(value)
  }
  else if (value instanceof Uint8Array) {
    parser.push(value)
  }
  else if (typeof value === 'string') {
    parser.pushText(value)
  }
}

function readResponseMessage(value: unknown) {
  if (typeof value === 'string') {
    try {
      return readResponseMessage(JSON.parse(value))
    }
    catch {
      return value.slice(0, 80)
    }
  }
  if (!isRecord(value))
    return ''
  return readString(value.message) || readString(value.msg)
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function readOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
