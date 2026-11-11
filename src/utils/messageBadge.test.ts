import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tabbarList } from '@/tabbar/store'
import { countUnread, refreshMessageBadge, setMessageBadge } from './messageBadge'

const api = vi.hoisted(() => ({
  fetchConversations: vi.fn(),
  fetchSupportUnread: vi.fn(),
}))
const token = vi.hoisted(() => ({ value: '' }))

vi.mock('@/api/im', () => api)
vi.mock('@/store/token', () => ({
  useTokenStore: () => ({
    get validToken() { return token.value },
    updateNowTime() { return this },
  }),
}))

function messageBadge() {
  return tabbarList.value.find(item => String(item.pagePath) === '/pages/message/index')?.badge
}

describe('messageBadge', () => {
  beforeEach(() => {
    token.value = ''
    setMessageBadge(0)
  })

  it('sums conversation and support unread counts, ignoring bad values', () => {
    expect(countUnread([{ unreadCount: 2 }, { unreadCount: 3 }], 1)).toBe(6)
    expect(countUnread([{ unreadCount: Number.NaN }], 0)).toBe(0)
    expect(countUnread([], 0)).toBe(0)
  })

  it('clears the badge without requesting when logged out', async () => {
    setMessageBadge(5)
    await refreshMessageBadge()
    expect(messageBadge()).toBe(0)
    expect(api.fetchConversations).not.toHaveBeenCalled()
  })

  it('fetches silently and sets the total when logged in', async () => {
    token.value = 'a'
    api.fetchConversations.mockResolvedValue([{ unreadCount: 4 }])
    api.fetchSupportUnread.mockResolvedValue(2)
    await refreshMessageBadge()
    expect(messageBadge()).toBe(6)
    expect(api.fetchConversations).toHaveBeenCalledWith({ hideErrorToast: true })
  })

  it('drops a result that arrives after the account changed', async () => {
    token.value = 'a'
    api.fetchConversations.mockImplementation(async () => {
      token.value = 'b'
      return [{ unreadCount: 9 }]
    })
    api.fetchSupportUnread.mockResolvedValue(0)
    await refreshMessageBadge()
    expect(messageBadge()).toBe(0)
  })

  it('keeps the previous badge when the request fails', async () => {
    token.value = 'a'
    setMessageBadge(3)
    api.fetchConversations.mockRejectedValue(new Error('offline'))
    api.fetchSupportUnread.mockResolvedValue(0)
    await refreshMessageBadge()
    expect(messageBadge()).toBe(3)
  })
})
