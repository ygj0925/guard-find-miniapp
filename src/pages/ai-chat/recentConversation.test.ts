import { describe, expect, it } from 'vitest'
import type { AgentChatSession } from '@/api/agent'
import { latestTodayConversationId } from './recentConversation'

const now = new Date(2026, 8, 28, 14, 30)
const localTime = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute).toISOString()

function session(sessionId: string, lastMessageTime?: string): AgentChatSession {
  return { sessionId, title: sessionId, lastMessageTime }
}

describe('latestTodayConversationId', () => {
  it('returns the most recently active session today even when it was created earlier', () => {
    const sessions = [
      { ...session('updated-today', localTime(28, 13)), createTime: localTime(27, 10) },
      session('newest', localTime(28, 14)),
      session('yesterday', localTime(27, 23, 59)),
    ]
    expect(latestTodayConversationId(sessions, now)).toBe('newest')
  })

  it('respects local midnight and ignores missing or future timestamps', () => {
    expect(latestTodayConversationId([
      session('old', localTime(27, 23, 59)),
      session('tomorrow', localTime(29, 0)),
      session('invalid'),
    ], now)).toBe('')
    expect(latestTodayConversationId([
      session('midnight', localTime(28, 0)),
    ], now)).toBe('midnight')
  })

  it('uses update time and creation time when there is no message time', () => {
    expect(latestTodayConversationId([
      { ...session('created'), createTime: localTime(28, 8) },
      { ...session('updated'), updateTime: localTime(28, 9) },
    ], now)).toBe('updated')
  })
})
