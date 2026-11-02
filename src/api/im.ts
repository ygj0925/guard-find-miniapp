/**
 * IM 私信与官方客服(guard-find-server /app/im)。
 * 轮询方案:3 秒拉一次新消息;客服消息 senderId 为 0。
 */
import { http } from '@/http/http'

export interface ImConversation {
  id: number
  peerUserId: number
  peerNickname: string | null
  peerAvatar: string | null
  lastMessage: string | null
  lastTime: string | null
  unreadCount: number
}

export interface ImMessage {
  id: number
  senderId: number
  content: string
  createTime?: string
}

/** 我的会话列表(按最后消息时间倒序,含未读数) */
export function fetchConversations() {
  return http.get<ImConversation[]>('/app/im/conversations')
}

/** 拉取会话消息(afterId 增量;自动标已读) */
export function fetchMessages(conversationId: number | string, afterId?: number) {
  return http.get<ImMessage[]>(`/app/im/conversation/${conversationId}/messages`, afterId ? { afterId } : undefined)
}

/** 发送私信 */
export function sendMessage(conversationId: number | string, content: string) {
  return http.post<ImMessage>(`/app/im/conversation/${conversationId}/message`, { content })
}

/** 获取或创建与目标用户的会话(幂等) */
export function getOrCreateConversation(targetUserId: number | string) {
  return http.post<ImConversation>(`/app/im/conversation/${targetUserId}`)
}

/** 联系客服:拉取消息 */
export function fetchSupportMessages(afterId?: number) {
  return http.get<ImMessage[]>('/app/im/support/messages', afterId ? { afterId } : undefined)
}

/** 联系客服:发送消息 */
export function sendSupportMessage(content: string) {
  return http.post<ImMessage>('/app/im/support/message', { content })
}
