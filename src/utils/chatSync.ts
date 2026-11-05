import type { ImMessage } from '@/api/im'
import { compareIds, mergeMessages } from './messageCursor'

export interface ChatState {
  convId: string | number
  myUserId: string
  messages: ImMessage[]
  lastId: string | number
  draft: string
  sending: boolean
}

interface ChatRoute {
  convId: string
  peerId: string
  support: boolean
}

interface ChatDependencies {
  token: () => string
  user: () => Promise<{ userId: string | number }>
  conversation: (peerId: string) => Promise<{ id: string | number }>
  read: (convId: string | number, afterId?: string | number) => Promise<ImMessage[]>
  send: (convId: string | number, content: string) => Promise<ImMessage>
  subscribe: (refresh: () => void, token: string) => () => void
  connected: () => boolean
  login: () => void
  error: (message: string) => void
  scroll: (valid: () => boolean) => void
}

/** One queue per visible, authenticated generation; obsolete work owns no shared flags. */
export function createChatSync(state: ChatState, route: ChatRoute, deps: ChatDependencies) {
  let visible = false
  let disposed = false
  let generation = 0
  let identity = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined
  let refreshCurrent: (() => void) | undefined
  let sendCurrent: (() => Promise<void>) | undefined
  let draftRevision = 0

  function invalidate() {
    generation++
    if (timer)
      clearTimeout(timer)
    timer = undefined
    unsubscribe?.()
    unsubscribe = undefined
    refreshCurrent = undefined
    sendCurrent = undefined
    state.sending = false
  }

  function clearIdentity() {
    state.convId = ''
    state.myUserId = ''
    state.messages = []
    state.lastId = ''
    state.draft = ''
  }

  function restart(token: string) {
    invalidate()
    if (identity !== token) {
      identity = token
      clearIdentity()
    }
    if (!visible || disposed)
      return
    if (!token) {
      deps.login()
      return
    }
    const current = generation
    const valid = () => visible && !disposed && current === generation && deps.token() === token
    let inFlight = false
    let queued = false
    let ready = false
    let authorized = false

    const refresh = () => {
      if (!valid())
        return
      queued = true
      if (ready && !inFlight)
        void drain()
    }

    async function drain() {
      if (!valid() || inFlight || !ready)
        return
      inFlight = true
      if (timer)
        clearTimeout(timer)
      timer = undefined
      try {
        do {
          queued = false
          const before = state.lastId
          const incoming = await deps.read(state.convId, before || undefined)
          if (!valid())
            return
          authorized = true
          state.messages = mergeMessages(state.messages, incoming)
          for (const message of incoming) {
            if (!state.lastId || compareIds(message.id, state.lastId) > 0)
              state.lastId = message.id
          }
          if (incoming.length)
            deps.scroll(valid)
          // A full, duplicate page must not spin forever. Pushes still get one queued read.
          if (incoming.length >= 100 && compareIds(state.lastId, before) > 0)
            queued = true
        } while (valid() && queued)
      }
      catch {
        // Retain the read cursor and retry through the normal fallback timer.
      }
      finally {
        if (valid()) {
          inFlight = false
          timer = setTimeout(refresh, queued ? 0 : deps.connected() ? 15000 : 3000)
        }
      }
    }

    sendCurrent = async () => {
      const content = state.draft.trim()
      if (!valid() || !authorized || !content || state.sending)
        return
      const revision = draftRevision
      const originalDraft = state.draft
      state.sending = true
      try {
        const message = await deps.send(state.convId, content)
        if (!valid())
          return
        state.messages = mergeMessages(state.messages, [message])
        if (revision === draftRevision && state.draft === originalDraft)
          state.draft = ''
        // Sending never advances the receive/read cursor.
        deps.scroll(valid)
      }
      catch (error) {
        if (valid())
          deps.error(error instanceof Error ? error.message : '发送失败，请重试')
      }
      finally {
        if (valid())
          state.sending = false
      }
    }
    refreshCurrent = refresh
    unsubscribe = deps.subscribe(refresh, token)
    void (async () => {
      try {
        const info = await deps.user()
        if (!valid())
          return
        state.myUserId = String(info.userId)
        if (route.support) {
          state.convId = 'support'
        }
        else if (route.convId) {
          // A route ID is only a candidate: reads authorize it under the new token.
          state.convId = route.convId
        }
        else if (!state.convId && route.peerId) {
          const conversation = await deps.conversation(route.peerId)
          if (!valid())
            return
          state.convId = conversation.id
        }
        if (!valid() || !state.convId)
          return
        ready = true
        refresh()
      }
      catch {
        if (valid())
          deps.error('会话加载失败，请返回重试')
      }
    })()
  }

  return {
    show() {
      if (disposed)
        return
      visible = true
      restart(deps.token())
    },
    hide() {
      visible = false
      invalidate()
    },
    unload() {
      disposed = true
      visible = false
      invalidate()
    },
    tokenChanged(token: string) {
      if (!disposed && token !== identity)
        restart(token)
    },
    draftChanged() { draftRevision++ },
    refresh() { refreshCurrent?.() },
    async send() { await sendCurrent?.() },
  }
}
