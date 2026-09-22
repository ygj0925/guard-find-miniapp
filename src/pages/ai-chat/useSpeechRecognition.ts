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
const STOP_CALLBACK_TIMEOUT = 3_000

export function useSpeechRecognition(options: SpeechRecognitionOptions) {
  const state = ref<SpeechRecognitionState>('idle')
  const durationSeconds = ref(0)
  const interimText = ref('')
  let manager: WechatSpeechRecognitionManager | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let stopCallbackTimer: ReturnType<typeof setTimeout> | null = null
  let recordingStartedAt = 0
  let startAttemptSequence = 0
  let startInProgress = false
  let permissionCheckPending = false
  let managerStarted = false
  let managerStartPending = false
  let managerStopPending = false
  let stopRetriedAfterManagerStart = false
  let stopRequested = false
  let stopRecoveryPending = false
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

  function clearStopCallbackTimer() {
    if (stopCallbackTimer) {
      clearTimeout(stopCallbackTimer)
      stopCallbackTimer = null
    }
  }

  function resetState() {
    stopTimer()
    clearStopCallbackTimer()
    state.value = 'idle'
    durationSeconds.value = 0
    interimText.value = ''
    managerStarted = false
    permissionCheckPending = false
    managerStartPending = false
    managerStopPending = false
    stopRetriedAfterManagerStart = false
    stopRequested = false
    stopRecoveryPending = false
  }

  function resetVisibleState() {
    stopTimer()
    state.value = 'idle'
    durationSeconds.value = 0
    interimText.value = ''
  }

  function handleStopCallbackTimeout() {
    stopCallbackTimer = null
    if (!managerStopPending && !(stopRequested && managerStartPending))
      return

    // Keep the plugin session isolated until its terminal callback arrives. The plugin
    // does not identify callbacks by recording session, so starting again here could
    // deliver an old result into a new recording.
    const shouldNotify = !disposed && !ignoreNextResult
    stopRecoveryPending = true
    ignoreNextResult = true
    resetVisibleState()
    if (shouldNotify)
      options.onError('语音服务未及时结束，请稍后再试')
  }

  function scheduleStopCallbackTimeout() {
    clearStopCallbackTimer()
    stopCallbackTimer = setTimeout(handleStopCallbackTimeout, STOP_CALLBACK_TIMEOUT)
  }

  function requestManagerStop(target = manager, force = false) {
    if (!target || (managerStopPending && !force))
      return

    managerStopPending = true
    try {
      // Do not wait for onStart: users can release before the plugin confirms startup.
      target.stop()
    }
    catch {
      managerStopPending = false
      // The plugin can reject stop while its start callback is still pending.
      // Keep waiting for that callback and retry from onStart.
      scheduleStopCallbackTimeout()
      return
    }

    scheduleStopCallbackTimeout()
  }

  function bindManagerCallbacks(target: WechatSpeechRecognitionManager) {
    target.onStart = () => {
      const shouldStop = stopRequested || disposed || state.value === 'idle'
      managerStartPending = false
      managerStarted = true
      if (shouldStop) {
        // A stop issued before onStart can be ignored by WechatSI without throwing.
        // Retry once after the manager confirms that the recording actually started.
        const retryAfterManagerStart = !stopRetriedAfterManagerStart
        stopRetriedAfterManagerStart = true
        requestManagerStop(target, retryAfterManagerStart)
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
      || startInProgress
      || permissionCheckPending
      || managerStartPending
      || managerStopPending
      || stopRecoveryPending
    ) {
      if (stopRecoveryPending)
        options.onError('上一段语音仍在结束，请稍后再试')
      return 'cancelled'
    }

    const startAttempt = ++startAttemptSequence
    startInProgress = true
    permissionCheckPending = true
    stopRequested = false
    const permissionState = await getMicrophonePermissionState()

    if (startAttempt !== startAttemptSequence || disposed || stopRequested) {
      if (startAttempt === startAttemptSequence)
        permissionCheckPending = false
      startInProgress = false
      return 'cancelled'
    }

    permissionCheckPending = false
    if (permissionState !== 'granted') {
      if (permissionState === 'failed')
        options.onError('暂时无法检查麦克风权限，请稍后重试')
      else if (permissionState === 'unsupported')
        options.onError('当前环境暂不支持语音识别')
      startInProgress = false
      return permissionState === 'denied' || permissionState === 'prompt'
        ? 'permission-required'
        : 'failed'
    }

    const recognitionManager = getManager()
    if (!recognitionManager) {
      startInProgress = false
      return 'failed'
    }

    if (startAttempt !== startAttemptSequence || disposed || stopRequested) {
      startInProgress = false
      return 'cancelled'
    }

    try {
      managerStarted = false
      managerStartPending = true
      managerStopPending = false
      stopRetriedAfterManagerStart = false
      ignoreNextResult = false
      interimText.value = ''
      state.value = 'recording'
      recordingStartedAt = Date.now()
      durationSeconds.value = 0
      timer = setInterval(() => {
        durationSeconds.value = Math.min(60, Math.floor((Date.now() - recordingStartedAt) / 1000))
      }, 250)
      recognitionManager.start({ duration: MAX_RECORDING_DURATION, lang: 'zh_CN' })
      startInProgress = false
      return 'started'
    }
    catch {
      resetState()
      startInProgress = false
      options.onError('无法启动录音，请重试')
      return 'failed'
    }
  }

  function stop() {
    if (state.value === 'idle' && startInProgress) {
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
    requestManagerStop()
  }

  function cancel() {
    if (state.value === 'idle' && startInProgress) {
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
    requestManagerStop()
  }

  function dispose() {
    disposed = true
    startAttemptSequence += 1
    permissionCheckPending = false
    ignoreNextResult = true
    stopRequested = true
    resetVisibleState()
    requestManagerStop()
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
