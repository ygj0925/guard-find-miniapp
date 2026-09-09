import { computed, ref } from 'vue'

export type SpeechRecognitionState = 'idle' | 'recording' | 'recognizing'
export type MicrophonePermissionResult = 'granted' | 'denied' | 'failed' | 'unsupported'
export type SpeechStartResult = 'started' | 'cancelled' | 'permission-required' | 'failed'

type MicrophonePermissionState = MicrophonePermissionResult | 'prompt'

interface RecognitionResult {
  result?: string
}

interface RecognitionError {
  errMsg?: string
  msg?: string
}

interface MicrophoneAuthSetting {
  'scope.record'?: boolean
}

interface WechatSpeechRecognitionManager {
  onStart?: () => void
  onRecognize?: (result: RecognitionResult) => void
  onStop?: (result: RecognitionResult) => void
  onError?: (error: RecognitionError) => void
  start: (options: { duration: number, lang: 'zh_CN' }) => void
  stop: () => void
}

interface WechatSpeechPlugin {
  getRecordRecognitionManager: () => WechatSpeechRecognitionManager
}

interface SpeechRecognitionOptions {
  onResult: (text: string) => void
  onError: (message: string) => void
  onPermissionRequired?: () => void
}

interface NormalizedRecognitionError {
  message: string
  permissionRequired: boolean
}

const MAX_RECORDING_DURATION = 60_000

export function useSpeechRecognition(options: SpeechRecognitionOptions) {
  const state = ref<SpeechRecognitionState>('idle')
  const durationSeconds = ref(0)
  const interimText = ref('')
  let manager: WechatSpeechRecognitionManager | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let recordingStartedAt = 0
  let startAttemptSequence = 0
  let permissionCheckPending = false
  let managerStarted = false
  let managerStartPending = false
  let managerStopPending = false
  let stopRequested = false
  let ignoreNextResult = false
  let disposed = false

  const stateText = computed(() => {
    if (state.value === 'recording') {
      const minutes = String(Math.floor(durationSeconds.value / 60)).padStart(2, '0')
      const seconds = String(durationSeconds.value % 60).padStart(2, '0')
      return `松开结束 · ${minutes}:${seconds}`
    }
    return state.value === 'recognizing' ? '正在转成文字…' : ''
  })

  function stopTimer() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function resetState() {
    stopTimer()
    state.value = 'idle'
    durationSeconds.value = 0
    interimText.value = ''
    managerStarted = false
    permissionCheckPending = false
    managerStartPending = false
    managerStopPending = false
    stopRequested = false
  }

  function resetVisibleState() {
    stopTimer()
    state.value = 'idle'
    durationSeconds.value = 0
    interimText.value = ''
  }

  function bindManagerCallbacks(target: WechatSpeechRecognitionManager) {
    target.onStart = () => {
      managerStartPending = false
      managerStarted = true
      if (stopRequested || disposed) {
        managerStopPending = true
        target.stop()
      }
    }
    target.onRecognize = ({ result }) => {
      if (!disposed && !ignoreNextResult)
        interimText.value = result?.trim() || ''
    }
    target.onStop = ({ result }) => {
      const shouldIgnore = ignoreNextResult || disposed
      const text = result?.trim() || interimText.value.trim()
      ignoreNextResult = false
      resetState()
      if (shouldIgnore)
        return
      text ? options.onResult(text) : options.onError('没有听清，请长按后再说一遍')
    }
    target.onError = (error) => {
      const shouldNotify = !ignoreNextResult && !disposed
      ignoreNextResult = false
      resetState()
      if (!shouldNotify)
        return
      const normalizedError = normalizeError(error)
      if (normalizedError.permissionRequired)
        options.onPermissionRequired?.()
      options.onError(normalizedError.message)
    }
  }

  function getManager() {
    if (manager)
      return manager

    // #ifdef MP-WEIXIN
    try {
      const plugin = requirePlugin('WechatSI') as unknown as WechatSpeechPlugin
      manager = plugin.getRecordRecognitionManager()
      bindManagerCallbacks(manager)
    }
    catch {
      options.onError('语音识别服务未启用，请联系管理员配置')
    }
    // #endif

    // #ifndef MP-WEIXIN
    options.onError('当前环境暂不支持语音识别')
    // #endif

    return manager
  }

  function getMicrophonePermissionState(): Promise<MicrophonePermissionState> {
    return new Promise((resolve) => {
      // #ifdef MP-WEIXIN
      uni.getSetting({
        success: ({ authSetting }) => {
          const recordPermission = (authSetting as MicrophoneAuthSetting)['scope.record']
          if (recordPermission === true)
            resolve('granted')
          else if (recordPermission === false)
            resolve('denied')
          else
            resolve('prompt')
        },
        fail: () => resolve('failed'),
      })
      // #endif

      // #ifndef MP-WEIXIN
      resolve('unsupported')
      // #endif
    })
  }

  async function requestPermission(): Promise<MicrophonePermissionResult> {
    const permissionState = await getMicrophonePermissionState()
    if (permissionState !== 'prompt')
      return permissionState

    return new Promise((resolve) => {
      // #ifdef MP-WEIXIN
      uni.authorize({
        scope: 'scope.record',
        success: () => resolve('granted'),
        fail: (error) => {
          const detail = error.errMsg || ''
          resolve(/deny|denied|auth deny/i.test(detail) ? 'denied' : 'failed')
        },
      })
      // #endif

      // #ifndef MP-WEIXIN
      resolve('unsupported')
      // #endif
    })
  }

  function openPermissionSettings(): Promise<MicrophonePermissionResult> {
    return new Promise((resolve) => {
      // #ifdef MP-WEIXIN
      uni.openSetting({
        success: ({ authSetting }) => {
          const recordPermission = (authSetting as MicrophoneAuthSetting)['scope.record']
          resolve(recordPermission === true ? 'granted' : 'denied')
        },
        fail: () => resolve('failed'),
      })
      // #endif

      // #ifndef MP-WEIXIN
      resolve('unsupported')
      // #endif
    })
  }

  async function start(): Promise<SpeechStartResult> {
    if (
      disposed
      || state.value !== 'idle'
      || permissionCheckPending
      || managerStartPending
      || managerStopPending
    ) {
      return 'cancelled'
    }

    const startAttempt = ++startAttemptSequence
    permissionCheckPending = true
    stopRequested = false
    const permissionState = await getMicrophonePermissionState()

    if (startAttempt !== startAttemptSequence || disposed || stopRequested) {
      if (startAttempt === startAttemptSequence)
        permissionCheckPending = false
      return 'cancelled'
    }

    permissionCheckPending = false
    if (permissionState !== 'granted') {
      if (permissionState === 'failed')
        options.onError('暂时无法检查麦克风权限，请稍后重试')
      else if (permissionState === 'unsupported')
        options.onError('当前环境暂不支持语音识别')
      return permissionState === 'denied' || permissionState === 'prompt'
        ? 'permission-required'
        : 'failed'
    }

    const recognitionManager = getManager()
    if (!recognitionManager)
      return 'failed'

    try {
      managerStarted = false
      managerStartPending = true
      managerStopPending = false
      ignoreNextResult = false
      interimText.value = ''
      state.value = 'recording'
      recordingStartedAt = Date.now()
      durationSeconds.value = 0
      timer = setInterval(() => {
        durationSeconds.value = Math.min(60, Math.floor((Date.now() - recordingStartedAt) / 1000))
      }, 250)
      recognitionManager.start({ duration: MAX_RECORDING_DURATION, lang: 'zh_CN' })
      return 'started'
    }
    catch {
      resetState()
      options.onError('无法启动录音，请重试')
      return 'failed'
    }
  }

  function stop() {
    if (state.value === 'idle' && permissionCheckPending) {
      startAttemptSequence += 1
      permissionCheckPending = false
      stopRequested = true
      return
    }
    if (state.value !== 'recording' || !manager)
      return
    stopTimer()
    stopRequested = true
    state.value = 'recognizing'
    if (managerStarted && !managerStopPending) {
      managerStopPending = true
      manager.stop()
    }
  }

  function cancel() {
    if (state.value === 'idle' && permissionCheckPending) {
      startAttemptSequence += 1
      permissionCheckPending = false
      stopRequested = true
      resetVisibleState()
      return
    }
    if (
      state.value === 'idle'
      && !managerStartPending
      && !managerStarted
      && !managerStopPending
    ) {
      return
    }

    ignoreNextResult = true
    stopRequested = true
    resetVisibleState()
    if (manager && managerStarted && !managerStopPending) {
      managerStopPending = true
      manager.stop()
    }
  }

  function dispose() {
    disposed = true
    startAttemptSequence += 1
    permissionCheckPending = false
    ignoreNextResult = true
    stopRequested = true
    resetVisibleState()
    if (manager && managerStarted && !managerStopPending) {
      managerStopPending = true
      manager.stop()
    }
  }

  return {
    state,
    stateText,
    requestPermission,
    openPermissionSettings,
    start,
    stop,
    cancel,
    dispose,
  }
}

function normalizeError(error: RecognitionError): NormalizedRecognitionError {
  const detail = error.errMsg || error.msg || ''
  if (/auth|permission|denied|拒绝|权限/i.test(detail)) {
    return {
      message: '麦克风权限已关闭，请重新点击语音图标',
      permissionRequired: true,
    }
  }
  if (/network|timeout/i.test(detail)) {
    return {
      message: '网络不稳定，语音识别失败，请重试',
      permissionRequired: false,
    }
  }
  return {
    message: '语音识别失败，请再说一遍',
    permissionRequired: false,
  }
}
