import type { ImMessage } from '@/api/im'
import type { ChatState } from './chatSync'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChatSync } from './chatSync'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const message = (id: string | number): ImMessage => ({ id, senderId: 'peer', content: String(id) })
async function flush() {
  for (let i = 0; i < 12; i++)
    await Promise.resolve()
}
function fixture(convId = 'route-conv', support = false) {
  const state: ChatState = { convId: '', myUserId: '', messages: [], lastId: '', draft: '', sending: false }
  let token = 'A'
  let push = () => {}
  const unsubs: ReturnType<typeof vi.fn>[] = []
  const deps = {
    token: () => token,
    user: vi.fn(async () => ({ userId: token })),
    conversation: vi.fn(async () => ({ id: `conv-${token}` })),
    read: vi.fn(async (_id: string | number, _after?: string | number): Promise<ImMessage[]> => []),
    send: vi.fn(async (_id: string | number, _content: string) => message('99')),
    subscribe: vi.fn((refresh: () => void, _token: string) => {
      push = refresh
      const unsub = vi.fn()
      unsubs.push(unsub)
      return unsub
    }),
    connected: () => false,
    login: vi.fn(),
    error: vi.fn(),
    scroll: vi.fn((_valid: () => boolean) => {}),
  }
  const sync = createChatSync(state, { convId, peerId: 'peer', support }, deps)
  return { state, deps, sync, unsubs, push: () => push(), auth: (value: string) => {
    token = value
    sync.tokenChanged(value)
  } }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('chat generation and single-flight queue', () => {
  it('coalesces start + pushes into one in-flight read and one queued read', async () => {
    const f = fixture()
    const first = deferred<ImMessage[]>()
    const second = deferred<ImMessage[]>()
    f.deps.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    f.sync.show()
    f.push()
    await flush()
    f.push()
    f.push()
    expect(f.deps.read).toHaveBeenCalledTimes(1)
    first.resolve([message(1)])
    await flush()
    expect(f.deps.read).toHaveBeenCalledTimes(2)
    expect(f.deps.read).toHaveBeenLastCalledWith('route-conv', 1)
    second.resolve([])
    await flush()
    expect(vi.getTimerCount()).toBe(1)
  })

  it('drains 100+ with exact large-ID ordering, dedup and monotonic cursor', async () => {
    const f = fixture()
    const ids = Array.from({ length: 100 }, (_, i) => `9007199254741${String(i).padStart(3, '0')}`)
    f.deps.read.mockResolvedValueOnce(ids.map(message).reverse())
      .mockResolvedValueOnce([message(ids[99]), message('9007199254741100'), message(ids[0])])
    f.sync.show()
    await flush()
    expect(f.deps.read).toHaveBeenNthCalledWith(2, 'route-conv', ids[99])
    expect(f.state.messages).toHaveLength(101)
    expect(f.state.messages[0].id).toBe(ids[0])
    expect(f.state.lastId).toBe('9007199254741100')
    f.deps.read.mockResolvedValueOnce(ids.map(message))
    f.push()
    await flush()
    expect(f.deps.read).toHaveBeenCalledTimes(3)
    expect(f.state.lastId).toBe('9007199254741100')
  })

  it('ignores old user initialization before creating a peer conversation', async () => {
    const f = fixture('')
    const old = deferred<{ userId: string }>()
    f.deps.user.mockReturnValueOnce(old.promise)
    f.sync.show()
    f.auth('B')
    await flush()
    old.resolve({ userId: 'A' })
    await flush()
    expect(f.state.myUserId).toBe('B')
    expect(f.state.convId).toBe('conv-B')
    expect(f.deps.conversation).toHaveBeenCalledTimes(1)
  })

  it('ignores old conversation initialization and initialization errors', async () => {
    const f = fixture('')
    const old = deferred<{ id: string }>()
    f.deps.conversation.mockReturnValueOnce(old.promise)
    f.sync.show()
    await flush()
    f.auth('B')
    await flush()
    old.resolve({ id: 'conv-A' })
    await flush()
    expect(f.state.convId).toBe('conv-B')
    const failing = deferred<{ userId: string }>()
    f.deps.user.mockReturnValueOnce(failing.promise)
    f.sync.show()
    f.sync.hide()
    failing.reject(new Error('old init'))
    await flush()
    expect(f.deps.error).not.toHaveBeenCalled()
  })

  it.each([false, true])('old read response/finally cannot unlock new read (reject=%s)', async (reject) => {
    const f = fixture()
    const old = deferred<ImMessage[]>()
    const current = deferred<ImMessage[]>()
    f.deps.read.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    f.sync.show()
    await flush()
    f.auth('B')
    await flush()
    if (reject)
      old.reject(new Error('old'))
    else
      old.resolve([message(999)])
    await flush()
    f.push()
    expect(f.deps.read).toHaveBeenCalledTimes(2)
    expect(f.state.messages).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    current.resolve([message(2)])
    await flush()
    expect(f.deps.read).toHaveBeenCalledTimes(3)
    expect(f.state.lastId).toBe(2)
  })

  it('hide discards queued drain and subscription; show reauthenticates and catches up', async () => {
    const f = fixture()
    const old = deferred<ImMessage[]>()
    f.deps.read.mockReturnValueOnce(old.promise)
    f.sync.show()
    await flush()
    f.push()
    f.sync.hide()
    old.resolve(Array.from({ length: 100 }, (_, i) => message(i + 1)))
    await flush()
    f.push()
    await vi.advanceTimersByTimeAsync(30000)
    expect(f.deps.read).toHaveBeenCalledTimes(1)
    expect(f.unsubs[0]).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    f.sync.show()
    await flush()
    expect(f.deps.user).toHaveBeenCalledTimes(2)
    expect(f.deps.read).toHaveBeenCalledTimes(2)
    f.sync.unload()
    f.sync.show()
    f.auth('C')
    await vi.advanceTimersByTimeAsync(30000)
    expect(f.deps.read).toHaveBeenCalledTimes(2)
  })

  it.each(['route-conv', ''])('logout/login clears identity and restores conversation (%s) only when shown', async (convId) => {
    const f = fixture(convId)
    f.deps.read.mockResolvedValueOnce([message(7)])
    f.sync.show()
    await flush()
    f.state.draft = 'private'
    f.sync.hide()
    f.auth('')
    expect(f.state).toMatchObject({ convId: '', myUserId: '', messages: [], draft: '', lastId: '' })
    f.auth('B')
    await flush()
    expect(f.deps.user).toHaveBeenCalledTimes(1)
    expect(f.deps.subscribe).toHaveBeenCalledTimes(1)
    f.sync.show()
    await flush()
    expect(f.deps.read).toHaveBeenLastCalledWith(convId || 'conv-B', undefined)
    expect(f.state.myUserId).toBe('B')
    expect(f.deps.conversation).toHaveBeenCalledTimes(convId ? 0 : 2)
  })

  it('requires server-authorized read before sending to a static route as a new identity', async () => {
    const f = fixture()
    f.sync.show()
    await flush()
    const denied = deferred<ImMessage[]>()
    f.deps.read.mockReturnValueOnce(denied.promise)
    f.auth('B')
    await flush()
    f.state.draft = 'hello'
    await f.sync.send()
    expect(f.deps.send).not.toHaveBeenCalled()
    denied.reject(new Error('403'))
    await flush()
    await f.sync.send()
    expect(f.deps.send).not.toHaveBeenCalled()
    expect(f.state.messages).toEqual([])
  })

  it('send merges without advancing cursor or clearing a newer/retyped draft', async () => {
    const f = fixture()
    f.deps.read.mockResolvedValueOnce([message(1)])
    const sent = deferred<ImMessage>()
    f.deps.send.mockReturnValueOnce(sent.promise)
    f.sync.show()
    await flush()
    f.state.draft = 'hello'
    const pending = f.sync.send()
    f.state.draft = 'new'
    f.sync.draftChanged()
    f.state.draft = 'hello'
    f.sync.draftChanged()
    sent.resolve(message(99))
    await pending
    expect(f.state.draft).toBe('hello')
    expect(f.state.lastId).toBe(1)
    f.deps.read.mockResolvedValueOnce([message(2), message(99)])
    f.push()
    await flush()
    expect(f.state.messages.map(m => m.id)).toEqual([1, 2, 99])
    await f.sync.send()
    expect(f.state.draft).toBe('')
  })

  it.each([false, true])('old send response/error/finally leaves the new send untouched (reject=%s)', async (reject) => {
    const f = fixture()
    const old = deferred<ImMessage>()
    const current = deferred<ImMessage>()
    f.deps.send.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    f.sync.show()
    await flush()
    f.state.draft = 'A'
    const first = f.sync.send()
    f.auth('B')
    await flush()
    f.state.draft = 'B'
    const second = f.sync.send()
    if (reject)
      old.reject(new Error('old send'))
    else
      old.resolve(message(100))
    await first
    expect(f.state.sending).toBe(true)
    expect(f.state.draft).toBe('B')
    expect(f.state.messages).toEqual([])
    expect(f.deps.error).not.toHaveBeenCalled()
    current.resolve(message(2))
    await second
    expect(f.state.sending).toBe(false)
    expect(f.state.draft).toBe('')
    expect(f.state.messages.map(m => m.id)).toEqual([2])
  })

  it('hidden initialization never creates a conversation or restarts a subscription', async () => {
    const f = fixture('')
    const old = deferred<{ userId: string }>()
    f.deps.user.mockReturnValueOnce(old.promise)
    f.sync.show()
    f.sync.hide()
    old.resolve({ userId: 'A' })
    await flush()
    expect(f.state.myUserId).toBe('')
    expect(f.deps.conversation).not.toHaveBeenCalled()
    expect(f.deps.read).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    f.sync.show()
    await flush()
    expect(f.state.convId).toBe('conv-A')
    expect(f.deps.read).toHaveBeenCalledTimes(1)
  })

  it('hide/show invalidates sends and deferred UI callbacks even with the same token', async () => {
    const f = fixture()
    let canScroll = () => false
    f.deps.scroll.mockImplementation((valid: () => boolean) => {
      canScroll = valid
    })
    f.deps.read.mockResolvedValueOnce([message(1)])
    const sent = deferred<ImMessage>()
    f.deps.send.mockReturnValueOnce(sent.promise)
    f.sync.show()
    await flush()
    expect(canScroll()).toBe(true)
    f.state.draft = 'old'
    const pending = f.sync.send()
    f.sync.hide()
    expect(canScroll()).toBe(false)
    f.sync.show()
    await flush()
    f.state.draft = 'new'
    sent.resolve(message(99))
    await pending
    expect(f.state.draft).toBe('new')
    expect(f.state.messages.map(m => m.id)).toEqual([1])
    expect(f.state.lastId).toBe(1)
    expect(f.state.sending).toBe(false)
    expect(f.deps.read).toHaveBeenLastCalledWith('route-conv', 1)
  })

  it('support uses the same guarded drain and visible logout requests login', async () => {
    const f = fixture('', true)
    f.sync.show()
    await flush()
    expect(f.deps.read).toHaveBeenCalledWith('support', undefined)
    f.auth('')
    expect(f.deps.login).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    f.auth('B')
    await flush()
    expect(f.deps.read).toHaveBeenCalledTimes(2)
  })
})
