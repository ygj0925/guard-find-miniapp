import type { MiniappMessageBizType, MiniappMessageData } from '@/api/message'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getMiniappMessageUnreadCount } from '@/api/message'
import { useTokenStore } from '@/store/token'
import { tabbarStore } from '@/tabbar/store'
import { getEnvWsUrl } from '@/utils'

/** 与 tabbar/config.ts 里"通知"tab 的 pagePath 保持一致，用于同步未读红点。 */
const NOTIFICATION_TABBAR_PATH = '/pages/notification/index'
/** 断线兜底轮询间隔，对齐管理端；投递状态变化不要求秒级感知。 */
const POLL_INTERVAL_MS = 5 * 60 * 1000
const RECONNECT_BASE_DELAY_MS = 3000
const RECONNECT_MAX_DELAY_MS = 30000
// #ifdef MP-WEIXIN
/** 小程序连接连续空闲一分钟后发送心跳，为网关 180 秒空闲超时预留足够的调度延迟。 */
const HEARTBEAT_IDLE_MS = 60 * 1000
/** 心跳使用固定协议帧，便于后端静默识别，避免污染业务消息日志。 */
const HEARTBEAT_PAYLOAD = '{"type":"PING"}'
// #endif

/** 推送事件名，对应后端 MessageServiceImpl 的常量。 */
type MessagePushEvent = 'MESSAGE_CREATED' | 'UNREAD_CHANGED'

/** 随推送帧下发的新消息体，字段够渲染弹窗与点击跳转。 */
export interface PushedMessage {
  id: string
  title: string
  path?: string
  /** 业务类型，后台纯文本消息（如系统公告）没有此字段，不应弹窗给候选人 */
  bizType?: MiniappMessageBizType
  data?: MiniappMessageData
}

/** WebSocket 推送帧。 */
interface MessagePushFrame {
  event?: MessagePushEvent
  /** 收件人未读数；群发/全员广播时各人不同，后端不下发，此时需主动回查 */
  unreadCount?: number | null
  /** 新消息体，仅 MESSAGE_CREATED 事件带 */
  message?: PushedMessage
}

/**
 * 解析 WebSocket 推送帧。
 *
 * 解析失败返回 null，调用方回退为主动查询未读数——覆盖帧不是合法 JSON、以及将来帧格式演进的情况。
 * 保留这条回退路径，红点才不会因为一次格式变化就失效。
 */
function parsePushFrame(raw: unknown): MessagePushFrame | null {
  if (typeof raw !== 'string')
    return null
  try {
    const frame = JSON.parse(raw) as MessagePushFrame
    return frame && typeof frame === 'object' ? frame : null
  }
  catch {
    return null
  }
}

/**
 * 小程序站内消息未读数与 WebSocket 接入。
 *
 * 复用现有 `/websocket?token=xxx` 端点。推送帧带未读数与新消息体：未读数用于直接更新红点，
 * 消息体用于在任意页面弹窗提示（见 latestMessage）。消息体只服务于这种一次性提示，丢帧最多是
 * 这次没弹窗，消息列表始终以 HTTP 接口为准，因此不需要处理丢帧补偿与列表去重。
 * 断线或连接失败时回退定时轮询。
 */
export const useMessageStore = defineStore('message', () => {
  const unreadCount = ref(0)
  /**
   * 最近一条通过 WS 推送到达的新消息，供任意页面弹窗提示。
   *
   * 只是"最近一条"的瞬时值，不是消息列表——列表始终以 HTTP 接口为准。因此丢帧最多是这次没弹窗，
   * 不会造成列表缺条。消费方（如全局弹窗组件）watch 到变化后应调用 consumeLatestMessage() 清空，
   * 避免页面切换重新挂载时又弹一次旧消息。
   */
  const latestMessage = ref<PushedMessage | null>(null)

  let socketTask: UniApp.SocketTask | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  // #ifdef MP-WEIXIN
  /** 只保留一个空闲心跳定时器，业务帧到达时重置，避免活跃连接产生无意义心跳。 */
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  // #endif
  let reconnectAttempts = 0
  /** onShow/onHide 或登录态变化驱动的生命周期开关，避免应用隐藏后仍在后台重连。 */
  let active = false

  function syncBadge() {
    tabbarStore.setTabbarItemBadgeByPath(NOTIFICATION_TABBAR_PATH, unreadCount.value)
  }

  async function refreshUnreadCount() {
    try {
      unreadCount.value = (await getMiniappMessageUnreadCount()) ?? 0
    }
    catch {
      // 网络抖动时保留上次已知值，不清空红点
    }
    syncBadge()
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startPolling() {
    if (pollTimer)
      return
    pollTimer = setInterval(() => {
      if (active)
        refreshUnreadCount()
    }, POLL_INTERVAL_MS)
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  // #ifdef MP-WEIXIN
  /**
   * 清理待发送心跳，连接关闭或应用隐藏后不得继续操作旧 SocketTask。
   */
  function clearHeartbeatTimer() {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  /**
   * 从最近一次连接活动重新计算空闲时间，只在微信小程序持续空闲时发送心跳。
   */
  function scheduleHeartbeat(task: UniApp.SocketTask) {
    if (socketTask !== task)
      return
    clearHeartbeatTimer()
    heartbeatTimer = setTimeout(() => {
      heartbeatTimer = null
      if (!active || socketTask !== task)
        return
      task.send({ data: HEARTBEAT_PAYLOAD })
      scheduleHeartbeat(task)
    }, HEARTBEAT_IDLE_MS)
  }
  // #endif

  function closeSocket() {
    // #ifdef MP-WEIXIN
    clearHeartbeatTimer()
    // #endif
    if (!socketTask)
      return
    const task = socketTask
    socketTask = null
    // 主动关闭前清掉回调，避免触发 onClose → scheduleReconnect 的"僵尸重连"
    task.onMessage(() => {})
    task.onClose(() => {})
    task.onError(() => {})
    task.close({})
  }

  function scheduleReconnect() {
    // 断线期间用轮询兜底未读数，不能让用户看着红点一直没更新
    startPolling()
    if (!active)
      return
    clearReconnectTimer()
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts, RECONNECT_MAX_DELAY_MS)
    reconnectAttempts += 1
    reconnectTimer = setTimeout(() => {
      if (active)
        connectSocket()
    }, delay)
  }

  function connectSocket() {
    if (!active)
      return
    const token = useTokenStore().updateNowTime().validToken
    const wsBase = getEnvWsUrl()
    if (!token || !wsBase) {
      startPolling()
      return
    }

    closeSocket()
    const task = uni.connectSocket({
      url: `${wsBase}/websocket?token=${encodeURIComponent(token)}`,
      complete: () => {},
    })
    socketTask = task

    task.onOpen(() => {
      reconnectAttempts = 0
      stopPolling()
      // #ifdef MP-WEIXIN
      scheduleHeartbeat(task)
      // #endif
    })

    task.onMessage((res) => {
      // #ifdef MP-WEIXIN
      scheduleHeartbeat(task)
      // #endif
      const frame = parsePushFrame(res?.data)
      // 帧解析不出或后端没带未读数（群发时各人不同），回退主动回查
      if (!frame || typeof frame.unreadCount !== 'number' || !Number.isFinite(frame.unreadCount)) {
        refreshUnreadCount()
      }
      else {
        unreadCount.value = frame.unreadCount
        syncBadge()
      }

      // 只有带业务类型的新消息才对外抛出：后台公告解析不出 bizType，不该弹给候选人
      if (frame?.event === 'MESSAGE_CREATED' && frame.message?.bizType) {
        latestMessage.value = frame.message
      }
    })

    /**
     * 只处理当前连接的断开事件，避免旧 SocketTask 的迟到回调清空新连接并触发重复重连。
     */
    function handleDisconnect() {
      if (socketTask !== task)
        return
      // #ifdef MP-WEIXIN
      clearHeartbeatTimer()
      // #endif
      socketTask = null
      scheduleReconnect()
    }

    task.onError(handleDisconnect)
    task.onClose(handleDisconnect)
  }

  /** App 可见且已登录时调用；重复调用是安全的（幂等）。 */
  function start() {
    if (active)
      return
    active = true
    reconnectAttempts = 0
    refreshUnreadCount()
    connectSocket()
  }

  /** App 隐藏或登出时调用，停止一切后台连接与定时器。 */
  function stop() {
    active = false
    clearReconnectTimer()
    stopPolling()
    closeSocket()
  }

  /** 登出时调用：停止连接并清空红点与待弹窗消息，避免残留上一个用户的数据。 */
  function reset() {
    stop()
    unreadCount.value = 0
    latestMessage.value = null
    syncBadge()
  }

  /** 弹窗展示后调用，清空待弹窗消息，避免页面切换重新挂载时又弹一次旧消息。 */
  function consumeLatestMessage() {
    latestMessage.value = null
  }

  return { unreadCount, latestMessage, refreshUnreadCount, consumeLatestMessage, start, stop, reset }
})
