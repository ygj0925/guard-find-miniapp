import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils', () => ({
  getEnvWsUrl: () => 'ws://ws.test',
}))

type Handler = (payload?: any) => void

const uniMock = uni as unknown as Record<string, any>

function createFakeTask() {
  const handlers: Record<string, Handler> = {}
  const task = {
    onOpen: (cb: Handler) => {
      handlers.open = cb
    },
    onMessage: (cb: Handler) => {
      handlers.message = cb
    },
    onClose: (cb: Handler) => {
      handlers.close = cb
    },
    onError: (cb: Handler) => {
      handlers.error = cb
    },
    send: vi.fn(),
    close: vi.fn(),
  }
  return { task, handlers }
}

async function loadModule() {
  return import('./imSocket')
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  uniMock.connectSocket = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('buildImSocketUrl', () => {
  it('joins the IM endpoint and encodes the token', async () => {
    const { buildImSocketUrl } = await loadModule()
    expect(buildImSocketUrl('ws://localhost:8000/', 'tok en&1'))
      .toBe('ws://localhost:8000/miniapp/ws/im?token=tok%20en%261')
  })

  it('keeps a context path and strips the Bearer prefix', async () => {
    const { buildImSocketUrl } = await loadModule()
    expect(buildImSocketUrl('https://api.example.com/api', 'Bearer abc'))
      .toBe('https://api.example.com/api/miniapp/ws/im?token=abc')
  })

  it('returns empty without a base url or token', async () => {
    const { buildImSocketUrl } = await loadModule()
    expect(buildImSocketUrl('', 'token')).toBe('')
    expect(buildImSocketUrl('wss://ws.test', '  ')).toBe('')
  })
})

describe('parseImSocketEvent', () => {
  it('normalizes numeric ids to strings', async () => {
    const { parseImSocketEvent } = await loadModule()
    expect(parseImSocketEvent(JSON.stringify({
      action: 'new_message',
      conversationId: 7,
      senderId: 2,
      content: 'hello',
      messageId: 9,
    }))).toEqual({
      action: 'new_message',
      conversationId: '7',
      senderId: '2',
      content: 'hello',
      messageId: '9',
    })
  })

  it('parses admin messages with a fallback name', async () => {
    const { parseImSocketEvent } = await loadModule()
    expect(parseImSocketEvent('{"action":"admin_message","messageId":"3","content":"在吗"}')).toEqual({
      action: 'admin_message',
      messageId: '3',
      content: '在吗',
      adminName: '官方客服',
    })
  })

  it('ignores pong, malformed frames and messages without ids', async () => {
    const { parseImSocketEvent } = await loadModule()
    expect(parseImSocketEvent('{"action":"pong"}')).toBeNull()
    expect(parseImSocketEvent('not json')).toBeNull()
    expect(parseImSocketEvent({ action: 'new_message' })).toBeNull()
    expect(parseImSocketEvent('{"action":"new_message","conversationId":1}')).toBeNull()
  })
})

describe('im socket lifecycle', () => {
  it('connects with the token, dispatches pushes and disconnects on last unsubscribe', async () => {
    const fake = createFakeTask()
    uniMock.connectSocket = vi.fn(() => fake.task)
    const { subscribeImSocket, isImSocketConnected } = await loadModule()

    const listener = vi.fn()
    const unsubscribe = subscribeImSocket(listener, 't1')

    expect(uniMock.connectSocket).toHaveBeenCalledWith({ url: 'ws://ws.test/miniapp/ws/im?token=t1' })
    expect(isImSocketConnected()).toBe(false)

    fake.handlers.open?.()
    expect(isImSocketConnected()).toBe(true)

    fake.handlers.message?.({
      data: '{"action":"new_message","conversationId":"7","senderId":"2","content":"hi","messageId":"9"}',
    })
    expect(listener).toHaveBeenCalledWith({
      action: 'new_message',
      conversationId: '7',
      senderId: '2',
      content: 'hi',
      messageId: '9',
    })

    unsubscribe()
    expect(fake.task.close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(fake.task.close).toHaveBeenCalledTimes(1)
  })

  it('does not connect without a token', async () => {
    const { subscribeImSocket } = await loadModule()
    const unsubscribe = subscribeImSocket(vi.fn(), '')
    expect(uniMock.connectSocket).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('reconnects with backoff after the socket drops', async () => {
    const fake = createFakeTask()
    uniMock.connectSocket = vi.fn(() => fake.task)
    const { subscribeImSocket } = await loadModule()
    const unsubscribe = subscribeImSocket(vi.fn(), 't1')
    fake.handlers.open?.()

    fake.handlers.close?.()
    expect(uniMock.connectSocket).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(uniMock.connectSocket).toHaveBeenCalledTimes(2)

    unsubscribe()
  })
})
