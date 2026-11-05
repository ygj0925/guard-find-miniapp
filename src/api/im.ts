/**
 * IM 私信与官方客服(guard-find-backend /miniapp/im)。
 * 轮询方案:3 秒拉一次新消息;客服消息 senderId 为 0。
 */
import { http } from '@/http/http'

export interface ImConversation {
  id: string | number
  peerUserId: string | number
  peerNickname: string | null
  peerAvatar: string | null
  lastMessage: string | null
  lastTime: string | null
  unreadCount: number
}

export interface ImMessage {
  id: string | number
  senderId: string | number
  content: string
  createTime?: string
}

/** 我的会话列表(按最后消息时间倒序,含未读数) */
export function fetchConversations() {
  return http.get<ImConversation[]>('/miniapp/im/conversations')
}

/** 拉取会话消息(afterId 增量;自动标已读) */
export function fetchMessages(conversationId: number | string, afterId?: string | number) {
  return http.get<ImMessage[]>(`/miniapp/im/conversation/${conversationId}/messages`, afterId ? { afterId } : undefined)
}

/** 发送私信 */
export function sendMessage(conversationId: number | string, content: string) {
  return http.post<ImMessage>(`/miniapp/im/conversation/${conversationId}/message`, { content })
}

/** 获取或创建与目标用户的会话(幂等) */
export function getOrCreateConversation(targetUserId: number | string) {
  return http.post<ImConversation>(`/miniapp/im/conversation/${targetUserId}`)
}

/** 联系客服:拉取消息 */
export function fetchSupportMessages(afterId?: string | number) {
  return http.get<ImMessage[]>('/miniapp/im/support/messages', afterId ? { afterId } : undefined)
}

export function fetchSupportUnread() {
  return http.get<number>('/miniapp/im/support/unread')
}

/** 联系客服:发送消息 */
export function sendSupportMessage(content: string) {
  return http.post<ImMessage>('/miniapp/im/support/message', { content })
}
