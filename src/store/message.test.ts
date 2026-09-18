import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMessageStore } from './message'

const { refreshUnreadCount, syncBadge, getEnvWsUrl, useTokenStore } = vi.hoisted(() => ({
  refreshUnreadCount: vi.fn().mockResolvedValue(0),
  syncBadge: vi.fn(),
  getEnvWsUrl: vi.fn().mockReturnValue('wss://example.com/sss-recruitment'),
  useTokenStore: vi.fn(() => ({
    updateNowTime: () => ({ validToken: 'test-token' }),
  })),
}))

vi.mock('@/api/message', () => ({
  getMiniappMessageUnreadCount: refreshUnreadCount,
}))

vi.mock('@/store/token', () => ({ useTokenStore }))
vi.mock('@/tabbar/store', () => ({
  tabbarStore: { setTabbarItemBadgeByPath: syncBadge },
}))
vi.mock('@/utils', () => ({ getEnvWsUrl }))

interface SocketCallbacks {
  open?: () => void
  message?: (event: { data: string }) => void
  error?: () => void
  close?: () => void
}

function createSocketTask() {
  const callbacks: SocketCallbacks = {}
  const task = {
    send: vi.fn(),
    close: vi.fn(),
    onOpen: vi.fn((callback: SocketCallbacks['open']) => { callbacks.open = callback }),
    onMessage: vi.fn((callback: SocketCallbacks['message']) => { callbacks.message = callback }),
    onError: vi.fn((callback: SocketCallbacks['error']) => { callbacks.error = callback }),
    onClose: vi.fn((callback: SocketCallbacks['close']) => { callbacks.close = callback }),
  }
  return { callbacks, task }
}

describe('useMessageStore WebSocket 心跳', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    uni.connectSocket = vi.fn() as typeof uni.connectSocket
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('连接连续空闲 60 秒后才发送心跳', () => {
    const { callbacks, task } = createSocketTask()
    vi.mocked(uni.connectSocket).mockReturnValue(task as unknown as UniApp.SocketTask)
    const store = useMessageStore()

    store.start()
    callbacks.open?.()
    vi.advanceTimersByTime(59_999)
    expect(task.send).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(task.send).toHaveBeenCalledOnce()
    expect(task.send).toHaveBeenCalledWith({ data: '{"type":"PING"}' })
  })

  it('收到业务消息后重新计算空闲时间', () => {
    const { callbacks, task } = createSocketTask()
    vi.mocked(uni.connectSocket).mockReturnValue(task as unknown as UniApp.SocketTask)
    const store = useMessageStore()

    store.start()
    callbacks.open?.()
    vi.advanceTimersByTime(40_000)
    callbacks.message?.({ data: '{"event":"UNREAD_CHANGED","unreadCount":1}' })
    vi.advanceTimersByTime(20_000)
    expect(task.send).not.toHaveBeenCalled()

    vi.advanceTimersByTime(40_000)
    expect(task.send).toHaveBeenCalledOnce()
  })

  it('停止连接时取消待发送心跳', () => {
    const { callbacks, task } = createSocketTask()
    vi.mocked(uni.connectSocket).mockReturnValue(task as unknown as UniApp.SocketTask)
    const store = useMessageStore()

    store.start()
    callbacks.open?.()
    store.stop()
    vi.advanceTimersByTime(60_000)

    expect(task.send).not.toHaveBeenCalled()
  })

  it('旧连接的迟到消息不能取消新连接的心跳', () => {
    const first = createSocketTask()
    const second = createSocketTask()
    vi.mocked(uni.connectSocket)
      .mockReturnValueOnce(first.task as unknown as UniApp.SocketTask)
      .mockReturnValueOnce(second.task as unknown as UniApp.SocketTask)
    const store = useMessageStore()

    store.start()
    first.callbacks.open?.()
    first.callbacks.error?.()
    vi.advanceTimersByTime(3000)
    second.callbacks.open?.()
    first.callbacks.message?.({ data: '{"event":"UNREAD_CHANGED","unreadCount":1}' })
    vi.advanceTimersByTime(60_000)

    expect(first.task.send).not.toHaveBeenCalled()
    expect(second.task.send).toHaveBeenCalledOnce()
  })
})
