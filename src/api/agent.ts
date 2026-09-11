import { http } from '@/http/http'
import { AUTH_TOKEN_STORAGE_KEY, useTokenStore } from '@/store/token'
import { getApiUrl } from '@/utils'
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
    | 'form'
    | 'done'
    | 'error'

/** 统一 SSE 接口的输入语义；缺省按 message 兼容旧调用。 */
export type AgentChatMode = 'message' | 'form_submission'

/** 表单提交模式下的用户答案，formId 对应最近一次 form 事件下发的卡片。 */
export interface AgentFormSubmissionReq {
  formId: string
  values: Record<string, unknown>
}

export interface AgentChatRequest {
  message: string
  stream: true
  sessionId?: string
  websearch?: boolean
  fileIds?: number[]
  thinking?: boolean
  thinkingLevel?: 'high' | 'max'
  /** 本轮输入语义；message（默认）或 form_submission。 */
  mode?: AgentChatMode
  /** mode=form_submission 时携带的表单答案，不与 message 混传。 */
  formSubmission?: AgentFormSubmissionReq
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

export type AgentChatCursor = string | number
export type AgentChatAttachmentStatus = 'PARSING' | 'SUCCESS' | 'FAILED'

// ─────────────────────────────────────────────
// 可填写表单卡片（form 事件），见设计方案 17
// ─────────────────────────────────────────────

/**
 * 第一期固定的字段类型，服务端拒绝下发任何组件名/HTML/脚本/正则/JSON Schema。
 * resume_upload 是设计方案 17 通用字段类型之外、独立落地的专用字段，
 * 前端不走通用编辑器渲染，而是复用小程序已有的简历上传/选择能力。
 */
export type AgentFormFieldType = 'input' | 'textarea' | 'number' | 'radio' | 'select' | 'date' | 'resume_upload'

export interface AgentFormField {
  key: string
  type: AgentFormFieldType
  label: string
  required: boolean
  minLength?: number
  maxLength?: number
  options?: string[]
  min?: number
  max?: number
  dateFormat?: string
  /** resume_upload 专用：允许的文件扩展名。 */
  accept?: string[]
  /** resume_upload 专用：单份简历大小上限（MB）。 */
  maxSizeMb?: number
}

/** 表单卡片状态机：ready → submitting → submitted；失败/过期分别落到 failed/unknown。 */
export type AgentFormStatus = 'ready' | 'submitting' | 'submitted' | 'failed' | 'unknown'

/** form 事件 data 字段的形状，对应后端 AgentFormCard.toData()。 */
export interface AgentFormCardData {
  formId: string
  version?: number
  type: string
  title: string
  description?: string
  fields: AgentFormField[]
  status: AgentFormStatus
}

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
  lastMessageId?: AgentChatCursor
  lastMessageTime?: string
  createTime?: string
  updateTime?: string
  firstAssistantMessage?: string
}

export interface AgentChatSessionPage {
  items: AgentChatSession[]
  hasMore: boolean
  nextBeforeLastMessageId?: AgentChatCursor
  snapshotLastMessageId?: AgentChatCursor
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

export interface AgentChatStreamController {
  cancel: () => void
}

interface ChunkedRequestTask {
  abort: () => void
  onChunkReceived?: (callback: (result: { data: ArrayBuffer | Uint8Array }) => void) => void
}

export function listAgentChatSessions(query: {
  limit?: number
  beforeLastMessageId?: AgentChatCursor
  snapshotLastMessageId?: AgentChatCursor
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

export function streamAgentChat(
  payload: AgentChatRequest,
  listeners: AgentChatStreamListeners,
): AgentChatStreamController {
  const token = String(uni.getStorageSync<string>(AUTH_TOKEN_STORAGE_KEY) || '').replace(/^Bearer\s+/i, '').trim()
  if (!token)
    return createMissingTokenController(listeners)

  // #ifdef H5
  const fetchImpl = globalThis.fetch
  const AbortControllerImpl = globalThis.AbortController
  if (typeof fetchImpl !== 'function' || typeof AbortControllerImpl !== 'function')
    return createUnsupportedBrowserStreamController(listeners)
  return streamAgentChatWithFetch(token, payload, listeners, fetchImpl, AbortControllerImpl)
  // #endif

  // #ifndef H5
  return streamAgentChatWithUniRequest(token, payload, listeners)
  // #endif
}

function createMissingTokenController(listeners: AgentChatStreamListeners): AgentChatStreamController {
  let completed = false
  let cancelled = false

  function finish() {
    if (completed)
      return
    completed = true
    listeners.onComplete?.()
  }

  const timer = setTimeout(() => {
    if (!cancelled)
      listeners.onError({ code: 'LOGIN_REQUIRED', message: '请先登录后使用 AI 助手' })
    finish()
  }, 0)

  return {
    cancel() {
      if (completed || cancelled)
        return
      cancelled = true
      clearTimeout(timer)
      finish()
    },
  }
}

// #ifdef H5
function createUnsupportedBrowserStreamController(
  listeners: AgentChatStreamListeners,
): AgentChatStreamController {
  let completed = false
  let cancelled = false

  function finish() {
    if (completed)
      return
    completed = true
    listeners.onComplete?.()
  }

  const timer = setTimeout(() => {
    if (cancelled) {
      finish()
      return
    }

    try {
      listeners.onError({
        code: 'STREAM_INTERRUPTED',
        message: '当前浏览器不支持 AI 流式回复，请升级浏览器后重试',
      })
    }
    finally {
      finish()
    }
  }, 0)

  return {
    cancel() {
      if (completed || cancelled)
        return
      cancelled = true
      clearTimeout(timer)
      finish()
    },
  }
}

function streamAgentChatWithFetch(
  token: string,
  payload: AgentChatRequest,
  listeners: AgentChatStreamListeners,
  fetchImpl: typeof globalThis.fetch,
  AbortControllerImpl: typeof globalThis.AbortController,
): AgentChatStreamController {
  let controller: AbortController
  try {
    controller = new AbortControllerImpl()
  }
  catch {
    return createUnsupportedBrowserStreamController(listeners)
  }
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let completed = false
  let cancelled = false
  let terminal = false
  let timedOut = false
  let timeout: ReturnType<typeof setTimeout> | undefined

  function finish() {
    if (completed)
      return
    completed = true
    clearTimeout(timeout)
    listeners.onComplete?.()
  }

  function fail(error: AgentChatStreamFailure) {
    if (terminal || cancelled)
      return
    terminal = true
    listeners.onError(error)
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
      controller.abort()
    },
  )

  timeout = setTimeout(() => {
    if (completed || cancelled || terminal)
      return
    timedOut = true
    controller.abort()
  }, 600000)

  void (async () => {
    try {
      const response = await fetchImpl(getApiUrl('/portal/agent/chat'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      })

      if (cancelled)
        return
      if (response.status === 401) {
        fail({ code: 'UNAUTHORIZED', message: '登录已过期，请重新登录' })
        if (await useTokenStore().clearLoginState(token))
          toLoginPage()
        return
      }
      if (!response.ok) {
        fail({
          code: 'HTTP_ERROR',
          message: await readFetchResponseMessage(response) || 'AI 服务暂时不可用',
        })
        return
      }

      const contentType = response.headers.get('content-type') || ''
      if (contentType && !contentType.toLowerCase().includes('text/event-stream')) {
        fail({
          code: 'HTTP_ERROR',
          message: await readFetchResponseMessage(response) || 'AI 服务未返回流式响应',
        })
        return
      }
      if (!response.body) {
        fail({ code: 'STREAM_INTERRUPTED', message: '当前浏览器不支持流式响应，请升级后重试' })
        return
      }

      reader = response.body.getReader()
      while (true) {
        if (cancelled || terminal)
          break
        const { value, done } = await reader.read()
        if (done)
          break
        if (value?.byteLength)
          parser.push(value)
      }

      if (terminal && reader) {
        try {
          await reader.cancel()
        }
        catch {
          // 连接可能已经被服务端关闭，无需再次处理。
        }
      }
      if (!cancelled && !terminal) {
        parser.finish()
        if (!terminal)
          fail({ code: 'STREAM_INTERRUPTED', message: 'AI 回复意外中断，请重试' })
      }
    }
    catch (error) {
      if (cancelled || terminal)
        return
      if (isAbortError(error) && timedOut) {
        fail({ code: 'NETWORK_ERROR', message: 'AI 响应超时，请稍后重试' })
        return
      }
      fail({ code: 'NETWORK_ERROR', message: '网络连接失败，请检查网络后重试' })
    }
    finally {
      finish()
    }
  })()

  return {
    cancel() {
      if (completed || cancelled)
        return
      cancelled = true
      controller.abort()
      void reader?.cancel().catch(() => undefined)
      finish()
    },
  }
}
// #endif

// #ifndef H5
function streamAgentChatWithUniRequest(
  token: string,
  payload: AgentChatRequest,
  listeners: AgentChatStreamListeners,
): AgentChatStreamController {
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

  task = uni.request({
    url: getApiUrl('/portal/agent/chat'),
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
    success: async (response) => {
      if (cancelled)
        return
      if (response.statusCode === 401) {
        fail({ code: 'UNAUTHORIZED', message: '登录已过期，请重新登录' })
        if (await useTokenStore().clearLoginState(token))
          toLoginPage()
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
// #endif

async function readFetchResponseMessage(response: Response) {
  try {
    return readResponseMessage(await response.text())
  }
  catch {
    return ''
  }
}

function isAbortError(error: unknown) {
  return isRecord(error) && readString(error.name) === 'AbortError'
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
