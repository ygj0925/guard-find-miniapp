import type { AgentChatSession } from '@/api/agent'

export function latestTodayConversationId(sessions: AgentChatSession[], now = new Date()) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  let latestId = ''
  let latestTime = todayStart - 1

  for (const session of sessions) {
    const updatedAt = Date.parse(session.lastMessageTime || session.updateTime || session.createTime || '')
    if (session.sessionId && updatedAt >= todayStart && updatedAt < tomorrowStart && updatedAt > latestTime) {
      latestId = session.sessionId
      latestTime = updatedAt
    }
  }

  return latestId
}
