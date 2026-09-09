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

/**
 * 小程序站内消息未读数与 WebSocket 接入。
 *
 * 复用现有 `/websocket?token=xxx` 端点；推送载荷只当作"有变化"的信号，收到后重新查未读数取真值，
 * 不解析载荷内容（与管理端 use-message-count.ts 语义保持一致）。断线或连接失败时回退定时轮询。
 */
export const useMessageStore = defineStore('message', () => {
  const unreadCount = ref(0)

  let socketTask: UniApp.SocketTask | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
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

  function closeSocket() {
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
    })

    task.onMessage(() => {
      // 只当作"有变化"信号，不解析内容
      refreshUnreadCount()
    })

    task.onError(() => {
      socketTask = null
      scheduleReconnect()
    })

    task.onClose(() => {
      socketTask = null
      scheduleReconnect()
    })
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

  /** 登出时调用：停止连接并清空红点，避免残留上一个用户的未读数。 */
  function reset() {
    stop()
    unreadCount.value = 0
    syncBadge()
  }

  return { unreadCount, refreshUnreadCount, start, stop, reset }
})
