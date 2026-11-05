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
const CONNECT_TIMEOUT_MS = 10000
const PONG_TIMEOUT_MS = 10000
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000
const DISCONNECT_GRACE_MS = 2000

let task: UniApp.SocketTask | null = null
let status: 'idle' | 'open' = 'idle'
let currentToken = ''
let attemptId = 0
let reconnectAttempt = 0
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let disconnectTimer: ReturnType<typeof setTimeout> | undefined
let connectTimer: ReturnType<typeof setTimeout> | undefined
let pongTimer: ReturnType<typeof setTimeout> | undefined
let heartbeatTimer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<ImSocketListener>()
const connectionListeners = new Map<ImSocketListener, () => void>()

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
  clearTimeout(reconnectTimer)
  clearTimeout(disconnectTimer)
  clearTimeout(connectTimer)
  clearTimeout(pongTimer)
  clearInterval(heartbeatTimer)
  reconnectTimer = undefined
  disconnectTimer = undefined
  connectTimer = undefined
  pongTimer = undefined
  heartbeatTimer = undefined
}

function closeTask(current: UniApp.SocketTask | null) {
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

function handleDrop(id: number, socket: UniApp.SocketTask | null) {
  if (id !== attemptId || task !== socket)
    return
  attemptId += 1
  status = 'idle'
  task = null
  clearTimers()
  closeTask(socket)
  if (listeners.size === 0)
    disconnectImSocket()
  else
    scheduleReconnect()
}

function openSocket(token: string) {
  if (typeof uni === 'undefined' || typeof uni.connectSocket !== 'function')
    return
  const url = buildImSocketUrl(getEnvWsUrl(), token)
  if (!url)
    return

  attemptId += 1
  const id = attemptId
  const previous = task
  task = null
  status = 'idle'
  clearTimers()
  closeTask(previous)
  currentToken = token

  let socket: UniApp.SocketTask | null = null
  try {
    socket = uni.connectSocket({
      url,
      fail: () => handleDrop(id, socket),
    })
    if (id !== attemptId) {
      closeTask(socket)
      return
    }
    task = socket
    const current = socket
    const isCurrent = () => id === attemptId && task === current
    const drop = () => handleDrop(id, current)
    connectTimer = setTimeout(drop, CONNECT_TIMEOUT_MS)
    current.onOpen(() => {
      if (!isCurrent() || status === 'open')
        return
      clearTimeout(connectTimer)
      connectTimer = undefined
      status = 'open'
      reconnectAttempt = 0
      heartbeatTimer = setInterval(() => {
        if (!isCurrent() || status !== 'open')
          return
        pongTimer = setTimeout(drop, PONG_TIMEOUT_MS)
        try {
          current.send({ data: '{"action":"ping"}', fail: drop })
        }
        catch {
          drop()
        }
      }, HEARTBEAT_MS)
      connectionListeners.forEach(listener => listener())
    })
    current.onMessage((message) => {
      if (!isCurrent() || status !== 'open')
        return
      try {
        if (typeof message.data === 'string' && JSON.parse(message.data)?.action === 'pong') {
          clearTimeout(pongTimer)
          pongTimer = undefined
          return
        }
      }
      catch {
        return
      }
      const event = parseImSocketEvent(message.data)
      if (event)
        listeners.forEach(listener => listener(event))
    })
    current.onClose(drop)
    current.onError(drop)
  }
  catch {
    handleDrop(id, socket)
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
export function subscribeImSocket(listener: ImSocketListener, token: string, onConnected?: () => void) {
  listeners.add(listener)
  if (onConnected)
    connectionListeners.set(listener, onConnected)
  if (disconnectTimer) {
    clearTimeout(disconnectTimer)
    disconnectTimer = undefined
  }
  connectImSocket(token)

  return () => {
    listeners.delete(listener)
    connectionListeners.delete(listener)
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
  status = 'idle'
  currentToken = ''
  reconnectAttempt = 0
  const current = task
  task = null
  closeTask(current)
}

export function isImSocketConnected() {
  return status === 'open'
}
