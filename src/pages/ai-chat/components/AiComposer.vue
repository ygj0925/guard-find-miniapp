<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

type SpeechRecognitionState = 'idle' | 'recording' | 'recognizing'

interface ComposerInputEvent {
  detail: {
    value: string
  }
}

const props = withDefaults(defineProps<{
  modelValue: string
  disabled?: boolean
  replying?: boolean
  chatMode?: boolean
  speechState?: SpeechRecognitionState
  speechStateText?: string
  voiceMode?: boolean
  voicePermissionPending?: boolean
  resumeName?: string
  placeholder?: string
}>(), {
  disabled: false,
  replying: false,
  chatMode: false,
  speechState: 'idle',
  speechStateText: '',
  voiceMode: false,
  voicePermissionPending: false,
  resumeName: '',
  placeholder: '请输入内容',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'send': []
  'stop': []
  'voice-mode-request': [enabled: boolean]
  'record-start': []
  'record-stop': []
  'record-cancel': []
  'choose-resume': []
  'remove-resume': []
}>()

const isFocused = ref(false)
const inputFocused = ref(false)
const recordingGestureActive = ref(false)
const speechActive = computed(() => props.speechState !== 'idle')
const LONG_PRESS_DELAY = 350
let longPressTimer: ReturnType<typeof setTimeout> | null = null

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

watch(
  () => props.speechState,
  (state, previousState) => {
    if (state !== 'idle') {
      inputFocused.value = false
      isFocused.value = false
      uni.hideKeyboard()
      return
    }

    if (previousState !== 'idle')
      recordingGestureActive.value = false
  },
)

onBeforeUnmount(clearLongPressTimer)

function updateValue(event: ComposerInputEvent) {
  emit('update:modelValue', event.detail.value)
}

function send() {
  if (!props.disabled && !props.voiceMode && (props.modelValue.trim() || props.resumeName) && props.speechState === 'idle') {
    emit('send')
  }
}

function stop() {
  emit('stop')
}

function toggleVoiceMode() {
  if (props.disabled || props.speechState !== 'idle' || props.voicePermissionPending) {
    return
  }

  inputFocused.value = false
  isFocused.value = false
  uni.hideKeyboard()
  emit('voice-mode-request', !props.voiceMode)
}

function handleFocus() {
  if (props.voiceMode || speechActive.value) {
    inputFocused.value = false
    uni.hideKeyboard()
    return
  }

  inputFocused.value = true
  isFocused.value = true
}

function handleBlur() {
  inputFocused.value = false
  isFocused.value = false
}

function beginRecording() {
  if (!props.voiceMode || props.disabled || props.speechState !== 'idle') {
    return
  }

  recordingGestureActive.value = true
  inputFocused.value = false
  isFocused.value = false
  uni.hideKeyboard()
  emit('record-start')
}

function prepareRecording() {
  if (!props.voiceMode || props.disabled || props.speechState !== 'idle') {
    return
  }

  clearLongPressTimer()
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    beginRecording()
  }, LONG_PRESS_DELAY)
}

function finishRecording() {
  clearLongPressTimer()
  if (!recordingGestureActive.value) {
    return
  }

  recordingGestureActive.value = false
  emit('record-stop')
}

function cancelRecording() {
  clearLongPressTimer()
  if (!recordingGestureActive.value) {
    return
  }

  recordingGestureActive.value = false
  emit('record-cancel')
}

function showVoiceTip() {
  if (!recordingGestureActive.value && props.speechState === 'idle') {
    uni.showToast({ title: '请长按“按住说话”', icon: 'none' })
  }
}
</script>

<template>
  <view class="composer-wrap">
    <view v-if="resumeName" class="resume-chip">
      <text class="resume-chip-name">{{ resumeName }}</text>
      <button class="resume-chip-remove" aria-label="移除待发送简历" :disabled="disabled" @tap="$emit('remove-resume')">
        <text>×</text>
      </button>
    </view>
    <view class="composer-row">
      <view
        class="composer-shell"
        :class="{
          'focused': isFocused,
          'disabled': disabled,
          'replying': replying,
          'voice-mode': voiceMode,
          'recording': speechState === 'recording',
          'recognizing': speechState === 'recognizing',
        }"
      >
        <!-- #ifdef MP-WEIXIN -->
        <view
          class="icon-button voice-button"
          :class="{ active: voiceMode, pending: voicePermissionPending }"
          role="button"
          :aria-label="voiceMode ? '切换为文字输入' : '切换为语音输入'"
          :aria-disabled="voicePermissionPending"
          @tap.stop="toggleVoiceMode"
        >
          <view v-if="voicePermissionPending" class="voice-permission-spinner" aria-hidden="true" />
          <view
            v-else
            class="composer-icon voice-icon"
            :class="voiceMode ? 'i-carbon-keyboard' : 'i-carbon-microphone'"
          />
        </view>
        <!-- #endif -->

        <view class="input-area">
          <view
            v-if="voiceMode"
            class="hold-to-talk"
            :class="{
              recording: speechState === 'recording',
              recognizing: speechState === 'recognizing',
            }"
            @tap="showVoiceTip"
            @touchstart.stop="prepareRecording"
            @touchend.capture="finishRecording"
            @touchcancel.capture="cancelRecording"
          >
            <template v-if="speechActive">
              <view v-if="speechState === 'recording'" class="speech-wave" aria-hidden="true">
                <view v-for="index in 5" :key="index" class="speech-wave-bar" />
              </view>
              <view v-else class="recognizing-spinner" />
              <text class="speech-state-text">{{ speechStateText }}</text>
            </template>
            <text v-else>按住说话</text>
          </view>

          <input
            v-else
            class="composer-input"
            :value="modelValue"
            :focus="inputFocused"
            :disabled="disabled"
            :adjust-position="false"
            confirm-type="send"
            :cursor-spacing="12"
            :maxlength="500"
            :placeholder="placeholder"
            placeholder-class="composer-placeholder"
            @input="updateValue"
            @confirm="send"
            @focus="handleFocus"
            @blur="handleBlur"
          >
        </view>

        <view
          v-if="replying"
          class="stop-button"
          @tap="stop"
        >
          <view class="composer-icon stop-icon i-carbon-stop-filled" />
        </view>

        <button
          v-else-if="!voiceMode && speechState === 'idle' && !modelValue.trim()"
          class="resume-button"
          :disabled="disabled"
          aria-label="选择简历发送给 AI"
          title="选择简历"
          @tap.stop="$emit('choose-resume')"
        >
          <view class="resume-add-icon" aria-hidden="true">
            <view class="resume-add-line resume-add-line-horizontal" />
            <view class="resume-add-line resume-add-line-vertical" />
          </view>
        </button>

        <view
          v-else-if="!voiceMode && speechState === 'idle'"
          class="send-button"
          :class="{ disabled: disabled || !modelValue.trim() }"
          @tap="send"
        >
          <view class="composer-icon send-icon i-carbon-arrow-up" />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.composer-wrap {
  width: 100%;
}
.composer-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  width: 100%;
}
.resume-chip {
  display: flex;
  align-items: center;
  gap: 10rpx;
  width: fit-content;
  max-width: 90%;
  height: 58rpx;
  margin-bottom: 12rpx;
  padding: 0 8rpx 0 18rpx;
  border: 1rpx solid #c5d7f0;
  border-radius: 8rpx;
  background: #fff;
  color: #285284;
  font-size: 24rpx;
}
.resume-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resume-chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 42rpx;
  height: 42rpx;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #54677d;
  font-size: 26rpx;
}
.resume-chip-remove::after,
.resume-button::after {
  border: 0;
}
.resume-button {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 68rpx;
  height: 68rpx;
  margin: 0;
  padding: 0;
  border: 1rpx solid rgba(107, 139, 204, 0.25);
  border-radius: 50%;
  background: #eef4ff;
  box-shadow: 0 5rpx 14rpx rgba(63, 92, 155, 0.1);
  color: #315fa8;
}
.resume-button:active:not([disabled]) {
  background: #e9f2ff;
}
.resume-button[disabled] {
  opacity: 0.45;
}
.resume-add-icon {
  position: relative;
  width: 32rpx;
  height: 32rpx;
}
.resume-add-line {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 26rpx;
  height: 4rpx;
  border-radius: 4rpx;
  background: currentColor;
  transform: translate(-50%, -50%);
}
.resume-add-line-vertical {
  transform: translate(-50%, -50%) rotate(90deg);
}
.composer-shell {
  box-sizing: border-box;
  min-width: 0;
  flex: 1;
  min-height: 104rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 12rpx 10rpx 14rpx;
  border: 1rpx solid rgba(107, 139, 204, 0.28);
  border-radius: 54rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 10rpx 28rpx rgba(63, 92, 155, 0.13),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.96);
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.composer-shell.focused {
  border-color: rgba(54, 111, 226, 0.6);
  box-shadow:
    0 12rpx 32rpx rgba(54, 92, 171, 0.16),
    0 0 0 4rpx rgba(69, 123, 235, 0.08);
}

.composer-shell.voice-mode {
  border-color: rgba(78, 122, 207, 0.42);
}

.composer-shell.recording {
  border-color: rgba(45, 111, 230, 0.66);
  background: rgba(244, 248, 255, 0.98);
  box-shadow:
    0 12rpx 32rpx rgba(45, 94, 185, 0.18),
    0 0 0 5rpx rgba(45, 111, 230, 0.09);
}

.composer-shell.recognizing {
  border-color: rgba(98, 132, 195, 0.42);
  background: rgba(248, 250, 254, 0.98);
}

.composer-shell.disabled:not(.recording):not(.recognizing):not(.replying) {
  opacity: 0.72;
}

.input-area {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  align-self: stretch;
}

.composer-input {
  width: 100%;
  height: 64rpx;
  color: var(--app-ink);
  font-size: 29rpx;
  line-height: 64rpx;
}

:deep(.composer-placeholder) {
  color: var(--app-placeholder);
}

.hold-to-talk {
  box-sizing: border-box;
  width: 100%;
  height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  border: 1rpx solid rgba(88, 126, 201, 0.28);
  border-radius: 34rpx;
  background: #f5f8ff;
  color: var(--app-ink-soft);
  font-size: 28rpx;
  font-weight: 500;
  user-select: none;
  transition:
    background-color 0.18s ease,
    transform 0.18s ease;
}

.hold-to-talk:active,
.hold-to-talk.recording {
  background: #e5edff;
  transform: scale(0.99);
}

.hold-to-talk.recognizing {
  background: #f1f4fa;
  color: var(--app-muted);
}

.icon-button {
  width: 68rpx;
  height: 68rpx;
  flex: 0 0 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition:
    background-color 0.18s ease,
    transform 0.18s ease;
}

.icon-button:active,
.send-button:active {
  transform: scale(0.94);
}

.voice-button {
  position: relative;
  background: #eef4ff;
}

.voice-button.pending {
  background: #f5f8ff;
}

.voice-permission-spinner {
  box-sizing: border-box;
  width: 30rpx;
  height: 30rpx;
  border: 4rpx solid rgba(75, 127, 227, 0.18);
  border-top-color: #4b7fe3;
  border-radius: 50%;
  animation: recognizing-spin 0.8s linear infinite;
}

.voice-button.active {
  background: var(--app-brand-blue);
}

.voice-button.active::after {
  position: absolute;
  inset: -7rpx;
  border: 3rpx solid rgba(45, 111, 230, 0.2);
  border-radius: 50%;
  content: '';
}

.composer-shell.recording .voice-button.active::after {
  animation: voice-pulse 1.2s ease-out infinite;
}

.composer-icon {
  display: block;
}

.voice-icon {
  width: 34rpx;
  height: 34rpx;
  color: var(--app-ink-soft);
}

.voice-button.active .voice-icon {
  color: #fff;
}

.speech-state-text {
  overflow: hidden;
  font-size: 27rpx;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.speech-wave {
  height: 36rpx;
  display: flex;
  align-items: center;
  gap: 5rpx;
}

.speech-wave-bar {
  width: 5rpx;
  height: 24rpx;
  border-radius: 4rpx;
  background: #4b7fe3;
  animation: speech-wave 0.8s ease-in-out infinite alternate;
}

.speech-wave-bar:nth-child(2),
.speech-wave-bar:nth-child(4) {
  animation-delay: -0.25s;
}

.speech-wave-bar:nth-child(3) {
  animation-delay: -0.5s;
}

.recognizing-spinner {
  box-sizing: border-box;
  width: 30rpx;
  height: 30rpx;
  flex: 0 0 30rpx;
  border: 4rpx solid rgba(75, 127, 227, 0.18);
  border-top-color: #4b7fe3;
  border-radius: 50%;
  animation: recognizing-spin 0.8s linear infinite;
}

.send-button,
.stop-button {
  width: 68rpx;
  height: 68rpx;
  flex: 0 0 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition:
    background-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.send-button {
  background: var(--app-brand-blue);
  box-shadow: 0 7rpx 18rpx rgba(45, 111, 230, 0.24);
}

.send-button.disabled {
  background: #b6c5dd;
  box-shadow: none;
}

.send-icon {
  width: 34rpx;
  height: 34rpx;
  color: #fff;
}

.stop-button {
  background: var(--app-danger);
  box-shadow: 0 7rpx 18rpx rgba(224, 85, 69, 0.24);
}

.stop-button:active {
  background: #c94535;
  transform: scale(0.94);
}

.stop-icon {
  width: 32rpx;
  height: 32rpx;
  color: #fff;
}

@keyframes speech-wave {
  from {
    transform: scaleY(0.4);
  }

  to {
    transform: scaleY(1.15);
  }
}

@keyframes voice-pulse {
  from {
    opacity: 0.72;
    transform: scale(0.88);
  }

  to {
    opacity: 0;
    transform: scale(1.12);
  }
}

@keyframes recognizing-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
