import { http } from '@/http/http'

/** 小程序消息列表项，对应后端 MiniappMessageResp。 */
export interface MiniappMessage {
  id: number | string
  title: string
  type: number
  path?: string
  isRead: boolean
  readTime?: string
  createTime: string
}

/** 小程序消息详情，对应后端 MiniappMessageDetailResp。 */
export interface MiniappMessageDetail {
  id: number | string
  title: string
  content: string
  type: number
  path?: string
  createTime: string
}

export interface MiniappMessagePageData {
  list: MiniappMessage[]
  total: number
}

/** 查询未读消息数量，onShow、收到 WS 信号、轮询时均调用。 */
export function getMiniappMessageUnreadCount() {
  return http.get<number>('/miniapp/messages/unread', undefined, undefined, { hideErrorToast: true })
}

/** 分页查询消息列表，isRead 为空则不过滤。 */
export function getMiniappMessagePage(params: { page: number, size: number, isRead?: boolean }) {
  return http.get<MiniappMessagePageData>('/miniapp/messages', params)
}

/** 查询消息详情，后端会同时标记该消息已读。 */
export function getMiniappMessageDetail(id: number | string) {
  return http.get<MiniappMessageDetail>(`/miniapp/messages/${id}`)
}

/** 全部消息标记已读。 */
export function readAllMiniappMessages() {
  return http<void>({
    url: '/miniapp/messages/read',
    method: 'PATCH' as any,
  })
}
