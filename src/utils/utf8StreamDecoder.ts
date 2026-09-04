export type Utf8DecoderMode = 'native' | 'fallback'

type Utf8DecoderInput = ArrayBuffer | Uint8Array

export interface Utf8StreamDecoder {
  readonly mode: Utf8DecoderMode
  decode: (input?: Utf8DecoderInput, options?: { stream?: boolean }) => string
}

export function createUtf8StreamDecoder(): Utf8StreamDecoder {
  if (typeof TextDecoder === 'function') {
    try {
      const decoder = new TextDecoder('utf-8')
      return {
        mode: 'native',
        decode: (input, options) => decoder.decode(input, options),
      }
    }
    catch {
      // 部分小程序运行时暴露了不完整的 TextDecoder，继续使用兼容实现。
    }
  }

  return createFallbackUtf8StreamDecoder()
}

function createFallbackUtf8StreamDecoder(): Utf8StreamDecoder {
  let bytesNeeded = 0
  let bytesSeen = 0
  let codePoint = 0
  let lowerBoundary = 0x80
  let upperBoundary = 0xBF
  let bomHandled = false

  function resetSequence() {
    bytesNeeded = 0
    bytesSeen = 0
    codePoint = 0
    lowerBoundary = 0x80
    upperBoundary = 0xBF
  }

  function appendCodePoint(output: string[], value: number) {
    if (!bomHandled) {
      bomHandled = true
      if (value === 0xFEFF)
        return
    }
    if (value <= 0xFFFF) {
      output.push(String.fromCharCode(value))
      return
    }
    const adjusted = value - 0x10000
    output.push(String.fromCharCode(
      0xD800 + (adjusted >> 10),
      0xDC00 + (adjusted & 0x3FF),
    ))
  }

  return {
    mode: 'fallback',
    decode(input, options = {}) {
      const bytes = input instanceof Uint8Array
        ? input
        : input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(0)
      const output: string[] = []
      let index = 0

      while (index < bytes.length) {
        const byte = bytes[index]
        if (bytesNeeded === 0) {
          if (byte <= 0x7F) {
            appendCodePoint(output, byte)
          }
          else if (byte >= 0xC2 && byte <= 0xDF) {
            bytesNeeded = 1
            codePoint = byte & 0x1F
          }
          else if (byte >= 0xE0 && byte <= 0xEF) {
            bytesNeeded = 2
            codePoint = byte & 0x0F
            lowerBoundary = byte === 0xE0 ? 0xA0 : 0x80
            upperBoundary = byte === 0xED ? 0x9F : 0xBF
          }
          else if (byte >= 0xF0 && byte <= 0xF4) {
            bytesNeeded = 3
            codePoint = byte & 0x07
            lowerBoundary = byte === 0xF0 ? 0x90 : 0x80
            upperBoundary = byte === 0xF4 ? 0x8F : 0xBF
          }
          else {
            appendCodePoint(output, 0xFFFD)
          }
          index += 1
          continue
        }

        if (byte < lowerBoundary || byte > upperBoundary) {
          appendCodePoint(output, 0xFFFD)
          resetSequence()
          continue
        }

        lowerBoundary = 0x80
        upperBoundary = 0xBF
        codePoint = (codePoint << 6) | (byte & 0x3F)
        bytesSeen += 1
        index += 1

        if (bytesSeen === bytesNeeded) {
          appendCodePoint(output, codePoint)
          resetSequence()
        }
      }

      if (!options.stream) {
        if (bytesNeeded > 0) {
          appendCodePoint(output, 0xFFFD)
          resetSequence()
        }
        bomHandled = false
      }

      return output.join('')
    },
  }
}
