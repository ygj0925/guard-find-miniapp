/**
 * 站内消息 WebSocket 单例(端点 /miniapp/ws/im)。
 * WS 只负责实时推送;发送与落库仍走 REST,断线或未连接时由页面轮询兜底。
 */
import { getEnvWsUrl } from '@/utils'

export interface ImSocketNewMessage {
  action: 'new_message'
  conversationId: string
  senderId: string
  content: string
  messageId: string
}

export interface ImSocketAdminMessage {
  action: 'admin_message'
  messageId: string
  content: string
  adminName: string
}

export type ImSocketEvent = ImSocketNewMessage | ImSocketAdminMessage
export type ImSocketListener = (event: ImSocketEvent) => void

const HEARTBEAT_MS = 25000
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000
const DISCONNECT_GRACE_MS = 2000

/** uni 的类型声明把 connectSocket 标成 Promise,运行时返回的仍是 SocketTask */
interface ImSocketTask {
  onOpen: (callback: () => void) => void
  onMessage: (callback: (message: { data: unknown }) => void) => void
  onClose: (callback: () => void) => void
  onError: (callback: () => void) => void
  send: (options: { data: string }) => void
  close: (options?: Record<string, never>) => void
}

function isSocketTask(value: unknown): value is ImSocketTask {
  const candidate = value as ImSocketTask | undefined
  return !!candidate && typeof candidate.onOpen === 'function' && typeof candidate.send === 'function'
}

let task: ImSocketTask | null = null
let unsupported = false
let status: 'idle' | 'open' = 'idle'
let currentToken = ''
let attemptId = 0
let reconnectAttempt = 0
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let disconnectTimer: ReturnType<typeof setTimeout> | undefined
let heartbeatTimer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<ImSocketListener>()

function normalizeToken(token: string) {
  return typeof token === 'string' ? token.trim().replace(/^Bearer\s+/i, '').trim() : ''
}

/** 拼接握手地址;token 由后端拦截器校验,空 token 直接放弃连接 */
export function buildImSocketUrl(baseUrl: string, token: string) {
  const normalizedToken = normalizeToken(token)
  if (!baseUrl || !normalizedToken)
    return ''
  return `${baseUrl.replace(/\/+$/, '')}/miniapp/ws/im?token=${encodeURIComponent(normalizedToken)}`
}

function readString(node: Record<string, unknown>, key: string) {
  const value = node[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

/** 解析服务端 JSON 文本帧;未知动作或缺少关键字段时返回 null */
export function parseImSocketEvent(raw: unknown): ImSocketEvent | null {
  if (typeof raw !== 'string' || !raw)
    return null

  let data: unknown
  try {
    data = JSON.parse(raw)
  }
  catch {
    return null
  }
  if (!data || typeof data !== 'object')
    return null

  const node = data as Record<string, unknown>
  if (node.action === 'new_message') {
    const conversationId = readString(node, 'conversationId')
    const messageId = readString(node, 'messageId')
    if (!conversationId || !messageId)
      return null
    return {
      action: 'new_message',
      conversationId,
      senderId: readString(node, 'senderId'),
      content: typeof node.content === 'string' ? node.content : '',
      messageId,
    }
  }
  if (node.action === 'admin_message') {
    const messageId = readString(node, 'messageId')
    if (!messageId)
      return null
    return {
      action: 'admin_message',
      messageId,
      content: typeof node.content === 'string' ? node.content : '',
      adminName: typeof node.adminName === 'string' ? node.adminName : '官方客服',
    }
  }
  return null
}

function clearTimers() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = undefined
  }
}

function closeTask() {
  const current = task
  task = null
  if (!current)
    return
  try {
    current.close({})
  }
  catch {
    // 已断开的任务重复关闭时忽略
  }
}

function scheduleReconnect() {
  if (reconnectTimer || listeners.size === 0 || !currentToken)
    return
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS)
  reconnectAttempt += 1
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined
    if (listeners.size === 0 || !currentToken)
      return
    openSocket(currentToken)
  }, delay)
}

function handleDrop() {
  if (task === null)
    return
  status = 'idle'
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = undefined
  }
  closeTask()
  scheduleReconnect()
}

function openSocket(token: string) {
  if (unsupported || typeof uni === 'undefined' || typeof uni.connectSocket !== 'function')
    return
  const url = buildImSocketUrl(getEnvWsUrl(), token)
  if (!url)
    return

  attemptId += 1
  const id = attemptId
  closeTask()
  clearTimers()
  currentToken = token
  status = 'idle'

  try {
    const socket = uni.connectSocket({ url })
    if (!isSocketTask(socket)) {
      // 平台不返回 SocketTask 时无法接收推送,保持页面轮询兜底
      unsupported = true
      status = 'idle'
      return
    }
    task = socket
    socket.onOpen(() => {
      if (id !== attemptId)
        return
      status = 'open'
      reconnectAttempt = 0
      heartbeatTimer = setInterval(() => {
        if (id !== attemptId || status !== 'open' || !task)
          return
        try {
          task.send({ data: '{"action":"ping"}' })
        }
        catch {
          handleDrop()
        }
      }, HEARTBEAT_MS)
    })
    socket.onMessage((message) => {
      if (id !== attemptId)
        return
      const event = parseImSocketEvent(message.data)
      if (event)
        listeners.forEach(listener => listener(event))
    })
    socket.onClose(() => {
      if (id !== attemptId)
        return
      handleDrop()
    })
    socket.onError(() => {
      if (id !== attemptId)
        return
      handleDrop()
    })
  }
  catch {
    status = 'idle'
    task = null
    scheduleReconnect()
  }
}

/** 建立(或复用)连接;token 为空或地址无法推导时不报错,页面继续走轮询 */
export function connectImSocket(token: string) {
  const normalizedToken = normalizeToken(token)
  if (!normalizedToken)
    return
  if (task && currentToken === normalizedToken)
    return
  openSocket(normalizedToken)
}

/**
 * 订阅实时推送:首个订阅者触发连接,最后一个取消后延迟断开,
 * 避免聊天页与列表页互相跳转时反复重连。
 */
export function subscribeImSocket(listener: ImSocketListener, token: string) {
  listeners.add(listener)
  if (disconnectTimer) {
    clearTimeout(disconnectTimer)
    disconnectTimer = undefined
  }
  connectImSocket(token)

  return () => {
    listeners.delete(listener)
    if (listeners.size > 0)
      return
    if (disconnectTimer)
      clearTimeout(disconnectTimer)
    disconnectTimer = setTimeout(() => {
      disconnectTimer = undefined
      if (listeners.size === 0)
        disconnectImSocket()
    }, DISCONNECT_GRACE_MS)
  }
}

export function disconnectImSocket() {
  attemptId += 1
  clearTimers()
  if (disconnectTimer) {
    clearTimeout(disconnectTimer)
    disconnectTimer = undefined
  }
  status = 'idle'
  currentToken = ''
  reconnectAttempt = 0
  closeTask()
}

export function isImSocketConnected() {
  return status === 'open'
}
