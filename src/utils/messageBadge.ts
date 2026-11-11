import type { ImConversation } from '@/api/im'
import { fetchConversations, fetchSupportUnread } from '@/api/im'
import { useTokenStore } from '@/store/token'
import { tabbarStore } from '@/tabbar/store'

const MESSAGE_TAB_PATH = '/pages/message/index'

export function countUnread(conversations: Pick<ImConversation, 'unreadCount'>[], supportUnread: number): number {
  const total = conversations.reduce((sum, item) => sum + (Number(item.unreadCount) || 0), supportUnread || 0)
  return Math.max(0, total)
}

export function setMessageBadge(count: number) {
  tabbarStore.setTabbarItemBadgeByPath(MESSAGE_TAB_PATH, count > 0 ? count : 0)
}

export async function refreshMessageBadge(): Promise<void> {
  const tokenStore = useTokenStore()
  const token = tokenStore.updateNowTime().validToken
  if (!token) {
    setMessageBadge(0)
    return
  }
  try {
    const silent = { hideErrorToast: true }
    const [conversations, supportUnread] = await Promise.all([fetchConversations(silent), fetchSupportUnread(silent)])
    if (tokenStore.validToken === token)
      setMessageBadge(countUnread(conversations, supportUnread))
  }
  catch {
    // 角标刷新失败不打扰用户，保留上一次的数值
  }
}
