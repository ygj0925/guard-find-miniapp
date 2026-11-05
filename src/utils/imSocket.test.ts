import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils', () => ({
  getEnvWsUrl: () => 'ws://ws.test',
}))

const failure = { errMsg: 'connectSocket:fail' }
const push = '{"action":"new_message","conversationId":"7","senderId":"2","content":"hi","messageId":"9"}'

function createFakeTask() {
  const handlers: {
    open?: Parameters<UniApp.SocketTask['onOpen']>[0]
    message?: Parameters<UniApp.SocketTask['onMessage']>[0]
    close?: Parameters<UniApp.SocketTask['onClose']>[0]
    error?: Parameters<UniApp.SocketTask['onError']>[0]
  } = {}
  const task = {
    onOpen: vi.fn((cb: NonNullable<typeof handlers.open>) => {
      handlers.open = cb
    }),
    onMessage: vi.fn((cb: NonNullable<typeof handlers.message>) => {
      handlers.message = cb
    }),
    onClose: vi.fn((cb: NonNullable<typeof handlers.close>) => {
      handlers.close = cb
    }),
    onError: vi.fn((cb: NonNullable<typeof handlers.error>) => {
      handlers.error = cb
    }),
    send: vi.fn<(options: UniApp.SendSocketMessageOptions) => void>(),
    close: vi.fn<(options: UniApp.CloseSocketOptions) => void>(),
  } satisfies UniApp.SocketTask
  return {
    task,
    open: () => handlers.open?.({ header: {} }),
    message: (data: unknown) => handlers.message?.({ data }),
    close: () => handlers.close?.({}),
    error: () => handlers.error?.(failure),
  }
}

const connections: (ReturnType<typeof createFakeTask> & { options: UniApp.ConnectSocketOption })[] = []

function createConnection(options: UniApp.ConnectSocketOption) {
  const fake = createFakeTask()
  connections.push({ ...fake, options })
  return fake.task
}

const nativeConnect = vi.fn((options: UniApp.ConnectSocketOption) => {
  const task = createConnection(options)
  options.success?.({ errMsg: 'connectSocket:ok' })
  return task
})

const connectSocket = vi.fn((options: UniApp.ConnectSocketOption) => {
  if ([options.success, options.fail, options.complete].some(callback => typeof callback === 'function'))
    return nativeConnect(options)
  return new Promise((resolve, reject) => {
    nativeConnect({ ...options, success: resolve, fail: reject })
  })
})

async function loadModule() {
  return import('./imSocket')
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  nativeConnect.mockReset()
  connectSocket.mockReset()
  connections.length = 0
  vi.stubGlobal('uni', { connectSocket })
})

afterEach(async () => {
  const { disconnectImSocket } = await loadModule()
  disconnectImSocket()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
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
  it('notifies connection recovery only for active subscribers and current tasks', async () => {
    const { subscribeImSocket } = await loadModule()
    const ready = vi.fn()
    const unsubscribe = subscribeImSocket(vi.fn(), 't1', ready)
    const first = connections[0]
    first.open()
    first.open()
    expect(ready).toHaveBeenCalledOnce()
    first.error()
    first.open()
    expect(ready).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1000)
    connections[1].open()
    expect(ready).toHaveBeenCalledTimes(2)
    unsubscribe()
    subscribeImSocket(vi.fn(), 't1')
    connections[1].error()
    vi.advanceTimersByTime(1000)
    connections[2].open()
    expect(ready).toHaveBeenCalledTimes(2)
  })

  it('models the Promise branch without callbacks and uses the task branch in production', async () => {
    const promise = connectSocket({ url: 'ws://ws.test' })
    expect(promise).toBeInstanceOf(Promise)
    await expect(promise).resolves.toEqual({ errMsg: 'connectSocket:ok' })
    expect(connections[0].task.onOpen).not.toHaveBeenCalled()
    connections[0].task.close({})

    const { subscribeImSocket } = await loadModule()
    subscribeImSocket(vi.fn(), 't1')
    expect(connectSocket).toHaveBeenLastCalledWith({
      url: 'ws://ws.test/miniapp/ws/im?token=t1',
      fail: expect.any(Function),
    })
    expect(connectSocket.mock.results[1].value).toBe(connections[1].task)
    expect(connections[1].task.onOpen).toHaveBeenCalledOnce()
    expect(connections[1].task.onMessage).toHaveBeenCalledOnce()
  })

  it('dispatches pushes and closes only after the last unsubscribe grace period', async () => {
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    const listener = vi.fn()
    const unsubscribe = subscribeImSocket(listener, 't1')
    const unsubscribeOther = subscribeImSocket(vi.fn(), 'Bearer t1')
    const fake = connections[0]
    expect(connectSocket).toHaveBeenCalledOnce()
    expect(isImSocketConnected()).toBe(false)
    fake.open()
    expect(isImSocketConnected()).toBe(true)
    fake.message(push)
    expect(listener).toHaveBeenCalledWith({
      action: 'new_message',
      conversationId: '7',
      senderId: '2',
      content: 'hi',
      messageId: '9',
    })

    unsubscribeOther()
    vi.advanceTimersByTime(2000)
    expect(fake.task.close).not.toHaveBeenCalled()
    unsubscribe()
    vi.advanceTimersByTime(1999)
    expect(fake.task.close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fake.task.close).toHaveBeenCalledOnce()
    expect(isImSocketConnected()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    fake.open()
    fake.message(push)
    fake.error()
    fake.close()
    vi.advanceTimersByTime(60000)
    expect(listener).toHaveBeenCalledOnce()
    expect(connectSocket).toHaveBeenCalledOnce()
  })

  it('reuses the connection when a subscriber returns during the grace period', async () => {
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    const unsubscribe = subscribeImSocket(vi.fn(), 't1')
    connections[0].open()
    unsubscribe()
    vi.advanceTimersByTime(1999)
    subscribeImSocket(vi.fn(), 't1')
    vi.advanceTimersByTime(1)
    expect(connections[0].task.close).not.toHaveBeenCalled()
    expect(connectSocket).toHaveBeenCalledOnce()
    expect(isImSocketConnected()).toBe(true)
  })

  it.each(['', '   '])('does not connect or retry when subscribing with an empty token: %j', async (token) => {
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    const unsubscribe = subscribeImSocket(vi.fn(), token)
    vi.advanceTimersByTime(120000)
    expect(connectSocket).not.toHaveBeenCalled()
    expect(isImSocketConnected()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    unsubscribe()
    vi.advanceTimersByTime(2000)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('closes the returned task after a synchronous connect failure and can retry', async () => {
    nativeConnect.mockImplementationOnce((options) => {
      const task = createConnection(options)
      options.fail?.(failure)
      return task
    })
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    subscribeImSocket(vi.fn(), 't1')
    expect(connections[0].task.close).toHaveBeenCalledOnce()
    expect(connections[0].task.onOpen).not.toHaveBeenCalled()
    expect(isImSocketConnected()).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(999)
    expect(connectSocket).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1)
    expect(connectSocket).toHaveBeenCalledTimes(2)
    connections[1].open()
    expect(isImSocketConnected()).toBe(true)
  })

  it('handles asynchronous connect failure without retaining the task or deadline', async () => {
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    subscribeImSocket(vi.fn(), 't1')
    const fake = connections[0]
    await Promise.resolve()
    fake.options.fail?.(failure)
    expect(fake.task.close).toHaveBeenCalledOnce()
    expect(isImSocketConnected()).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
    fake.options.fail?.(failure)
    fake.error()
    fake.close()
    expect(fake.task.close).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1000)
    connections[1].open()
    vi.advanceTimersByTime(10000)
    expect(isImSocketConnected()).toBe(true)
    expect(connectSocket).toHaveBeenCalledTimes(2)
  })

  it('backs off when connectSocket throws synchronously', async () => {
    nativeConnect.mockImplementationOnce(() => {
      throw new Error('connect failed')
    })
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    expect(() => subscribeImSocket(vi.fn(), 't1')).not.toThrow()
    expect(isImSocketConnected()).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(1000)
    connections[0].open()
    expect(isImSocketConnected()).toBe(true)
  })

  it('times out a connection that never opens and retries after backoff', async () => {
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    subscribeImSocket(vi.fn(), 't1')
    const fake = connections[0]
    vi.advanceTimersByTime(9999)
    expect(fake.task.close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fake.task.close).toHaveBeenCalledOnce()
    expect(isImSocketConnected()).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
    fake.open()
    expect(isImSocketConnected()).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(connectSocket).toHaveBeenCalledTimes(2)
    connections[1].open()
    vi.advanceTimersByTime(10000)
    expect(isImSocketConnected()).toBe(true)
  })

  it.each(['error', 'close'] as const)('rejects all stale events during and after reconnect following %s', async (event) => {
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    const listener = vi.fn()
    subscribeImSocket(listener, 't1')
    const old = connections[0]
    old.open()
    vi.advanceTimersByTime(25000)
    old.task.close.mockImplementation(() => old.close())
    old[event]()
    expect(old.task.close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)

    const emitStale = () => {
      old.open()
      old.message(push)
      old.message('{"action":"pong"}')
      old.error()
      old.close()
      old.options.fail?.(failure)
      old.task.send.mock.calls[0][0].fail?.(failure)
    }
    emitStale()
    expect(isImSocketConnected()).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    vi.advanceTimersByTime(999)
    expect(connectSocket).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1)
    const current = connections[1]
    emitStale()
    expect(isImSocketConnected()).toBe(false)
    current.open()
    emitStale()
    current.message(push)
    expect(listener).toHaveBeenCalledOnce()
    expect(isImSocketConnected()).toBe(true)
    expect(current.task.close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(25000)
    expect(current.task.send).toHaveBeenCalledOnce()
    emitStale()
    vi.advanceTimersByTime(10000)
    expect(current.task.close).toHaveBeenCalledOnce()
    expect(isImSocketConnected()).toBe(false)
  })

  it('caps retry backoff at 30 seconds and resets it after opening', async () => {
    const { subscribeImSocket } = await loadModule()
    subscribeImSocket(vi.fn(), 't1')
    for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
      const count = connections.length
      connections[count - 1].error()
      vi.advanceTimersByTime(delay - 1)
      expect(connections).toHaveLength(count)
      vi.advanceTimersByTime(1)
      expect(connections).toHaveLength(count + 1)
    }
    const count = connections.length
    connections[count - 1].open()
    connections[count - 1].close()
    vi.advanceTimersByTime(1000)
    expect(connections).toHaveLength(count + 1)
  })

  it('keeps the socket alive with pong replies without dispatching them', async () => {
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    const listener = vi.fn()
    subscribeImSocket(listener, 't1')
    const fake = connections[0]
    fake.open()
    fake.open()
    for (let count = 1; count <= 3; count += 1) {
      vi.advanceTimersByTime(25000)
      expect(fake.task.send).toHaveBeenCalledTimes(count)
      expect(fake.task.send).toHaveBeenLastCalledWith({ data: '{"action":"ping"}', fail: expect.any(Function) })
      fake.message('{ "action": "pong" }')
      expect(vi.getTimerCount()).toBe(1)
    }
    expect(listener).not.toHaveBeenCalled()
    expect(isImSocketConnected()).toBe(true)
    expect(fake.task.close).not.toHaveBeenCalled()
  })

  it('drops the socket without pong even if unrelated or invalid messages arrive', async () => {
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    const listener = vi.fn()
    subscribeImSocket(listener, 't1')
    const fake = connections[0]
    fake.open()
    vi.advanceTimersByTime(25000)
    fake.message(push)
    fake.message('not json')
    fake.message(null)
    fake.message('null')
    fake.message('{"action":"unknown"}')
    vi.advanceTimersByTime(9999)
    expect(isImSocketConnected()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(isImSocketConnected()).toBe(false)
    expect(fake.task.close).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(1000)
    expect(connectSocket).toHaveBeenCalledTimes(2)
  })

  it.each(['sync', 'async', 'throw'] as const)('handles %s heartbeat send failure', async (mode) => {
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    subscribeImSocket(vi.fn(), 't1')
    const fake = connections[0]
    fake.open()
    if (mode === 'sync')
      fake.task.send.mockImplementationOnce(options => options.fail?.(failure))
    if (mode === 'throw') {
      fake.task.send.mockImplementationOnce(() => {
        throw new Error('send failed')
      })
    }
    vi.advanceTimersByTime(25000)
    if (mode === 'async') {
      expect(isImSocketConnected()).toBe(true)
      await Promise.resolve()
      fake.task.send.mock.calls[0][0].fail?.(failure)
    }
    expect(isImSocketConnected()).toBe(false)
    expect(fake.task.close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(1000)
    expect(connectSocket).toHaveBeenCalledTimes(2)
  })

  it.each(['connecting', 'open', 'backoff'] as const)('replaces the token while %s and ignores the old task', async (phase) => {
    const { subscribeImSocket, connectImSocket, isImSocketConnected } = await loadModule()
    const listener = vi.fn()
    subscribeImSocket(listener, 't1')
    const old = connections[0]
    if (phase !== 'connecting') {
      old.open()
      vi.advanceTimersByTime(25000)
    }
    if (phase === 'backoff')
      old.error()
    connectImSocket('Bearer t2')
    const current = connections[1]
    expect(current.options.url).toBe('ws://ws.test/miniapp/ws/im?token=t2')
    expect(old.task.close).toHaveBeenCalledOnce()
    expect(isImSocketConnected()).toBe(false)
    old.open()
    old.message(push)
    old.error()
    old.close()
    old.options.fail?.(failure)
    expect(listener).not.toHaveBeenCalled()
    current.open()
    current.message(push)
    vi.advanceTimersByTime(10000)
    expect(connectSocket).toHaveBeenCalledTimes(2)
    expect(isImSocketConnected()).toBe(true)
    expect(current.task.close).not.toHaveBeenCalled()
    expect(listener).toHaveBeenCalledOnce()
  })

  it.each(['connecting', 'pong', 'backoff'] as const)('clears all timers on last unsubscribe during %s', async (phase) => {
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    const unsubscribe = subscribeImSocket(vi.fn(), 't1')
    const fake = connections[0]
    if (phase === 'pong') {
      fake.open()
      vi.advanceTimersByTime(25000)
    }
    if (phase === 'backoff')
      fake.error()
    unsubscribe()
    vi.advanceTimersByTime(2000)
    expect(fake.task.close).toHaveBeenCalledOnce()
    expect(isImSocketConnected()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(120000)
    expect(connectSocket).toHaveBeenCalledOnce()
  })

  it('clears the grace timer when the socket drops without subscribers', async () => {
    const { subscribeImSocket } = await loadModule()
    const unsubscribe = subscribeImSocket(vi.fn(), 't1')
    connections[0].open()
    unsubscribe()
    connections[0].error()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(120000)
    expect(connectSocket).toHaveBeenCalledOnce()
  })

  it.each(['missing uni', 'missing API', 'throwing API', 'failing API'] as const)('does not tight-loop on unsupported platforms: %s', async (mode) => {
    if (mode === 'missing uni')
      vi.stubGlobal('uni', undefined)
    if (mode === 'missing API')
      vi.stubGlobal('uni', {})
    if (mode === 'throwing API') {
      connectSocket.mockImplementation(() => {
        throw new Error('not supported')
      })
    }
    if (mode === 'failing API') {
      nativeConnect.mockImplementation((options) => {
        const task = createConnection(options)
        options.fail?.({ errMsg: 'connectSocket:fail not supported' })
        return task
      })
    }
    const { subscribeImSocket, isImSocketConnected } = await loadModule()
    subscribeImSocket(vi.fn(), 't1')
    vi.advanceTimersByTime(120000)
    expect(isImSocketConnected()).toBe(false)
    if (mode.startsWith('missing')) {
      expect(connectSocket).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    }
    else {
      expect(connectSocket).toHaveBeenCalledTimes(8)
      expect(vi.getTimerCount()).toBe(1)
      connections.forEach(fake => expect(fake.task.close).toHaveBeenCalledOnce())
    }
  })
})
