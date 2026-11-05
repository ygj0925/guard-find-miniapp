import { flushPromises, mount } from '@vue/test-utils'
import { reactive, ref, watch } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  conversations: vi.fn(),
  unread: vi.fn(),
  subscribe: vi.fn(),
  disconnect: vi.fn(),
  login: vi.fn(),
  online: false,
}))
let token: { validToken: string, updateNowTime: () => typeof token }
vi.mock('@/api/im', () => ({ fetchConversations: mocks.conversations, fetchSupportUnread: mocks.unread }))
vi.mock('@/store/token', () => ({ useTokenStore: () => token }))
vi.mock('@/utils/toLoginPage', () => ({ toLoginPage: mocks.login }))
vi.mock('@/utils/imSocket', () => ({
  subscribeImSocket: mocks.subscribe,
  disconnectImSocket: mocks.disconnect,
  isImSocketConnected: () => mocks.online,
}))

let show: () => void
let hide: () => void
let unload: () => void
let ready: () => void
let event: (value: { action: string }) => void
let wrapper: ReturnType<typeof mount> | undefined
const unsubscribe = vi.fn()

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.useFakeTimers()
  token = reactive({ validToken: 'first', updateNowTime: () => token })
  mocks.online = false
  mocks.conversations.mockReset().mockResolvedValue([])
  mocks.unread.mockReset().mockResolvedValue(3)
  mocks.subscribe.mockImplementation((listener, _token, connected) => {
    event = listener
    ready = connected
    return unsubscribe
  })
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('definePage', vi.fn())
  vi.stubGlobal('onShow', (callback: () => void) => {
    show = callback
  })
  vi.stubGlobal('onHide', (callback: () => void) => {
    hide = callback
  })
  vi.stubGlobal('onUnload', (callback: () => void) => {
    unload = callback
  })
  vi.stubGlobal('onPullDownRefresh', vi.fn())
})

afterEach(() => {
  unload?.()
  wrapper?.unmount()
  wrapper = undefined
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function open() {
  const { default: Page } = await import('./index.vue')
  wrapper = mount(Page)
  show()
  await flushPromises()
}

describe('message list synchronization', () => {
  it('shows support unread without reading messages and polls only while visible', async () => {
    await open()
    expect(wrapper!.text()).toContain('3')
    expect(mocks.unread).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(3000)
    expect(mocks.conversations).toHaveBeenCalledTimes(2)
    hide()
    await vi.advanceTimersByTimeAsync(60000)
    expect(mocks.conversations).toHaveBeenCalledTimes(2)
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('merges push and reconnect refreshes into a single queued request', async () => {
    const first = deferred<never[]>()
    mocks.conversations.mockReturnValueOnce(first.promise)
    await open()
    ready()
    event({ action: 'new_message' })
    await vi.advanceTimersByTimeAsync(400)
    expect(mocks.conversations).toHaveBeenCalledOnce()
    first.resolve([])
    await flushPromises()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.conversations).toHaveBeenCalledTimes(2)
  })

  it('discards old identity results and does not restart hidden pages on login', async () => {
    const old = deferred<{ id: string, peerNickname: string }[]>()
    mocks.conversations.mockReturnValueOnce(old.promise)
    await open()
    token.validToken = ''
    expect(wrapper!.text()).not.toContain('3')
    hide()
    token.validToken = 'second'
    expect(mocks.conversations).toHaveBeenCalledOnce()
    show()
    await flushPromises()
    old.resolve([{ id: 'old', peerNickname: 'OLD ACCOUNT' }])
    await flushPromises()
    expect(wrapper!.text()).not.toContain('OLD ACCOUNT')
    expect(mocks.conversations).toHaveBeenCalledTimes(2)
    expect(mocks.disconnect).toHaveBeenCalled()
  })

  it('refreshes immediately on reconnect instead of waiting for online fallback', async () => {
    mocks.online = true
    await open()
    ready()
    await flushPromises()
    expect(mocks.conversations).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(14999)
    expect(mocks.conversations).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.conversations).toHaveBeenCalledTimes(3)
  })
})
