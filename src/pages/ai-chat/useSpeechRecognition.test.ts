import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeechRecognition } from './useSpeechRecognition'

interface MockManager {
  onStart?: () => void
  onRecognize?: (result: { result?: string }) => void
  onStop?: (result: { result?: string }) => void
  onError?: (error: { errMsg?: string, msg?: string }) => void
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

let manager: MockManager

function createRecognition() {
  const onResult = vi.fn()
  const onError = vi.fn()
  return {
    speech: useSpeechRecognition({
      onResult,
      onError,
    }),
    onResult,
    onError,
  }
}

beforeEach(() => {
  manager = {
    start: vi.fn(),
    stop: vi.fn(),
  }
  Object.assign(uni, {
    getSetting: ({ success }: { success: (result: { authSetting: { 'scope.record': boolean } }) => void }) => {
      success({ authSetting: { 'scope.record': true } })
    },
  })
  vi.stubGlobal('requirePlugin', vi.fn(() => ({
    getRecordRecognitionManager: () => manager,
  })))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useSpeechRecognition', () => {
  it('retries stop once when the user releases before WechatSI emits onStart', async () => {
    const { speech } = createRecognition()

    await speech.start()
    speech.stop()
    expect(manager.stop).toHaveBeenCalledTimes(1)

    manager.onStart?.()
    expect(manager.stop).toHaveBeenCalledTimes(2)

    manager.onStop?.({ result: 'sample voice' })
    expect(speech.state.value).toBe('idle')
  })

  it('cancels the first start when the user releases during async initialization', async () => {
    let releasePermissionCheck: (() => void) | undefined
    let firstPermissionCheck = true
    Object.assign(uni, {
      getSetting: ({ success }: { success: (result: { authSetting: { 'scope.record': boolean } }) => void }) => {
        if (firstPermissionCheck) {
          firstPermissionCheck = false
          releasePermissionCheck = () => success({ authSetting: { 'scope.record': true } })
          return
        }
        success({ authSetting: { 'scope.record': true } })
      },
    })

    const { speech } = createRecognition()
    const firstStart = speech.start()
    speech.stop()
    releasePermissionCheck?.()

    await expect(firstStart).resolves.toBe('cancelled')
    expect(manager.start).not.toHaveBeenCalled()
    expect(speech.state.value).toBe('idle')

    await expect(speech.start()).resolves.toBe('started')
    expect(manager.start).toHaveBeenCalledTimes(1)
    speech.cancel()
    manager.onStop?.({})
  })

  it('isolates a timed-out recording until its late terminal callback arrives', async () => {
    vi.useFakeTimers()
    const { speech, onResult } = createRecognition()

    await speech.start()
    speech.stop()
    vi.advanceTimersByTime(3_000)

    await expect(speech.start()).resolves.toBe('cancelled')

    manager.onStop?.({ result: 'stale result' })
    expect(onResult).not.toHaveBeenCalled()
    await expect(speech.start()).resolves.toBe('started')

    speech.cancel()
    manager.onStop?.({})
  })
})
