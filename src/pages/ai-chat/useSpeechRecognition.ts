import { computed, ref } from 'vue'

export type SpeechRecognitionState = 'idle' | 'recording' | 'recognizing'

interface RecognitionResult {
  result?: string
}

interface RecognitionError {
  errMsg?: string
  msg?: string
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
}

const MAX_RECORDING_DURATION = 60_000

export function useSpeechRecognition(options: SpeechRecognitionOptions) {
  const state = ref<SpeechRecognitionState>('idle')
  const durationSeconds = ref(0)
  const interimText = ref('')
  let manager: WechatSpeechRecognitionManager | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let recordingStartedAt = 0
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
      if (shouldNotify)
        options.onError(normalizeError(error))
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

  function start() {
    if (disposed || state.value !== 'idle' || managerStartPending || managerStopPending)
      return false
    const recognitionManager = getManager()
    if (!recognitionManager)
      return false
    try {
      managerStarted = false
      managerStartPending = true
      managerStopPending = false
      stopRequested = false
      ignoreNextResult = false
      interimText.value = ''
      state.value = 'recording'
      recordingStartedAt = Date.now()
      durationSeconds.value = 0
      timer = setInterval(() => {
        durationSeconds.value = Math.min(60, Math.floor((Date.now() - recordingStartedAt) / 1000))
      }, 250)
      recognitionManager.start({ duration: MAX_RECORDING_DURATION, lang: 'zh_CN' })
      return true
    }
    catch {
      resetState()
      options.onError('无法启动录音，请重试')
      return false
    }
  }

  function stop() {
    if (state.value !== 'recording' || !manager)
      return
    stopTimer()
    stopRequested = true
    state.value = 'recognizing'
    if (managerStarted) {
      managerStopPending = true
      manager.stop()
    }
  }

  function cancel() {
    if (state.value === 'idle' && !managerStartPending)
      return
    ignoreNextResult = true
    stopRequested = true
    resetVisibleState()
    if (manager && managerStarted) {
      managerStopPending = true
      manager.stop()
    }
  }

  function dispose() {
    disposed = true
    ignoreNextResult = true
    stopRequested = true
    resetVisibleState()
    if (manager && managerStarted) {
      managerStopPending = true
      manager.stop()
    }
  }

  return { state, stateText, start, stop, cancel, dispose }
}

function normalizeError(error: RecognitionError) {
  const detail = error.errMsg || error.msg || ''
  if (/auth|permission/i.test(detail))
    return '请允许使用麦克风后再试'
  if (/network|timeout/i.test(detail))
    return '网络不稳定，语音识别失败，请重试'
  return '语音识别失败，请再说一遍'
}
