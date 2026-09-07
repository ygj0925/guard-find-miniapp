import { createUtf8StreamDecoder } from '@/utils/utf8StreamDecoder'

export interface AgentSseFrame {
  event: string
  value: Record<string, unknown>
}

export type AgentSseParserError = 'STREAM_PARSE_ERROR' | 'STREAM_TOO_LARGE'

export interface AgentSseParser {
  push: (chunk: ArrayBuffer | Uint8Array) => void
  pushText: (text: string) => void
  finish: () => void
}

const MAX_BUFFER_LENGTH = 512 * 1024

export function createAgentSseParser(
  onFrame: (frame: AgentSseFrame) => void,
  onError: (code: AgentSseParserError) => void,
): AgentSseParser {
  const decoder = createUtf8StreamDecoder()
  let buffer = ''
  let failed = false
  let finished = false

  function fail(code: AgentSseParserError) {
    if (failed)
      return
    failed = true
    buffer = ''
    onError(code)
  }

  function consumeFrame(source: string) {
    let event = ''
    const dataLines: string[] = []
    source.split(/\r?\n/).forEach((line) => {
      if (line.startsWith('event:')) {
        event = line.slice(6).trimStart()
      }
      else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    })

    if (!dataLines.length)
      return

    const data = dataLines.join('\n')
    if (data === '[DONE]') {
      onFrame({ event: event || 'done', value: { type: 'done' } })
      return
    }

    try {
      const value: unknown = JSON.parse(data)
      if (!isRecord(value)) {
        fail('STREAM_PARSE_ERROR')
        return
      }
      onFrame({ event: event || readString(value.type), value })
    }
    catch {
      fail('STREAM_PARSE_ERROR')
    }
  }

  function consumeBuffer(final = false) {
    if (failed)
      return

    let boundary = findBoundary(buffer)
    while (boundary) {
      if (boundary.index > MAX_BUFFER_LENGTH) {
        fail('STREAM_TOO_LARGE')
        return
      }
      const frame = buffer.slice(0, boundary.index)
      buffer = buffer.slice(boundary.index + boundary.length)
      consumeFrame(frame)
      if (failed)
        return
      boundary = findBoundary(buffer)
    }

    if (buffer.length > MAX_BUFFER_LENGTH) {
      fail('STREAM_TOO_LARGE')
      return
    }

    if (final && buffer.trim()) {
      const frame = buffer
      buffer = ''
      consumeFrame(frame)
    }
  }

  function append(text: string) {
    if (failed || finished || !text)
      return
    buffer += text
    consumeBuffer()
  }

  return {
    push(chunk) {
      append(decoder.decode(chunk, { stream: true }))
    },
    pushText(text) {
      append(text)
    },
    finish() {
      if (failed || finished)
        return
      buffer += decoder.decode()
      consumeBuffer(true)
      finished = true
    },
  }
}

function findBoundary(source: string) {
  const crlf = source.indexOf('\r\n\r\n')
  const lf = source.indexOf('\n\n')
  if (crlf < 0 && lf < 0)
    return undefined
  if (crlf >= 0 && (lf < 0 || crlf < lf))
    return { index: crlf, length: 4 }
  return { index: lf, length: 2 }
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
