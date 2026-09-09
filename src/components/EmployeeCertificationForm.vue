<script setup lang="ts">
import type { IUserInfoRes } from '@/api/types/login'
import { computed, onUnmounted, ref, watch } from 'vue'
import { innerEmployeeSend, innerEmployeeVerify } from '@/api/login'
import { useUserStore } from '@/store'
import { getEmployeeCertificationCooldownSeconds, startEmployeeCertificationCooldown } from '@/utils/employeeCertificationCooldown'

interface InputEvent {
  detail: { value: string }
}

const props = withDefaults(defineProps<{
  initialEmail?: string
  submitLabel?: string
}>(), {
  initialEmail: '',
  submitLabel: '完成员工认证',
})

const emit = defineEmits<{
  success: [userInfo: IUserInfoRes]
  busyChange: [busy: boolean]
}>()

const userStore = useUserStore()
const email = ref(props.initialEmail.trim())
const code = ref('')
const emailError = ref('')
const codeError = ref('')
const feedback = ref('使用企业邮箱接收 6 位验证码，认证结果将同步到你的账号。')
const feedbackType = ref<'info' | 'error' | 'success'>('info')
const sending = ref(false)
const verifying = ref(false)
const refreshing = ref(false)
const verifiedRemotely = ref(false)
const seconds = ref(0)
const sentEmail = ref('')
let timer: ReturnType<typeof setInterval> | undefined
let active = true

const busy = computed(() => sending.value || verifying.value || refreshing.value)
const canSend = computed(() => Boolean(email.value.trim()) && seconds.value === 0 && !busy.value)
const canSubmit = computed(() => !busy.value && (
  verifiedRemotely.value
  || (Boolean(email.value.trim()) && /^\d{6}$/.test(code.value.trim()))
))
const submitText = computed(() => {
  if (refreshing.value)
    return '正在同步认证状态...'
  if (verifying.value)
    return '正在验证员工身份...'
  if (verifiedRemotely.value)
    return '重新同步认证状态'
  return props.submitLabel
})

watch(busy, value => emit('busyChange', value), { immediate: true })

onUnmounted(() => {
  active = false
  clearCountdown()
})

function validateEmail(value: string) {
  return /^[^\s@]+@[^.\s@]+(?:\.[^.\s@]+)+$/.test(value)
}

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    const message = (error as Record<string, unknown>).message
    if (typeof message === 'string' && message.trim())
      return message.trim()
  }
  return fallback
}

function setFeedback(message: string, type: 'info' | 'error' | 'success' = 'info') {
  feedback.value = message
  feedbackType.value = type
}

function clearCountdown() {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
  seconds.value = 0
}

function restoreCountdown(emailValue: string) {
  clearCountdown()
  seconds.value = getEmployeeCertificationCooldownSeconds(emailValue)
  if (seconds.value <= 0)
    return

  timer = setInterval(() => {
    seconds.value = getEmployeeCertificationCooldownSeconds(emailValue)
    if (seconds.value <= 0)
      clearCountdown()
  }, 1000)
}

function startCountdown(emailValue: string) {
  startEmployeeCertificationCooldown(emailValue)
  restoreCountdown(emailValue)
}

restoreCountdown(email.value)

function handleEmailInput(event: InputEvent) {
  const nextEmail = event.detail.value
  email.value = nextEmail
  emailError.value = ''
  verifiedRemotely.value = false

  if (sentEmail.value && nextEmail.trim() !== sentEmail.value) {
    sentEmail.value = ''
    code.value = ''
    codeError.value = ''
    setFeedback('邮箱已修改，请重新获取验证码。')
  }
  restoreCountdown(nextEmail)
}

function handleCodeInput(event: InputEvent) {
  code.value = event.detail.value.replace(/\D/g, '').slice(0, 6)
  codeError.value = ''
  verifiedRemotely.value = false
}

async function handleSendCode() {
  if (!canSend.value)
    return

  const normalizedEmail = email.value.trim()
  emailError.value = ''
  codeError.value = ''
  if (!validateEmail(normalizedEmail)) {
    emailError.value = '请输入有效的企业邮箱地址'
    return
  }

  sending.value = true
  setFeedback('正在发送验证码，请稍候...')
  try {
    await innerEmployeeSend(normalizedEmail)
    if (!active)
      return
    sentEmail.value = normalizedEmail
    code.value = ''
    startCountdown(normalizedEmail)
    setFeedback(`验证码已发送至 ${normalizedEmail}，请在 5 分钟内完成验证。`, 'success')
  }
  catch (error) {
    if (!active)
      return
    setFeedback(errorMessage(error, '验证码发送失败，请稍后重试。'), 'error')
  }
  finally {
    if (active)
      sending.value = false
  }
}

async function refreshCertifiedUser() {
  refreshing.value = true
  setFeedback('员工认证已提交，正在同步账号状态...')
  try {
    const userInfo = await userStore.fetchUserInfo()
    if (!active)
      return
    if (userInfo.isInternalEmployee !== true) {
      verifiedRemotely.value = true
      setFeedback('认证已完成，员工状态正在同步，请稍后点击重试。', 'error')
      return
    }
    verifiedRemotely.value = false
    setFeedback('员工认证成功，即将为你打开职位列表。', 'success')
    emit('success', userInfo)
  }
  catch (error) {
    if (!active)
      return
    verifiedRemotely.value = true
    setFeedback(errorMessage(error, '认证已完成，但状态同步失败，请点击按钮重试。'), 'error')
  }
  finally {
    if (active)
      refreshing.value = false
  }
}

async function handleSubmit() {
  if (busy.value)
    return
  if (verifiedRemotely.value) {
    await refreshCertifiedUser()
    return
  }

  const normalizedEmail = email.value.trim()
  const normalizedCode = code.value.trim()
  emailError.value = ''
  codeError.value = ''
  if (!validateEmail(normalizedEmail)) {
    emailError.value = '请输入有效的企业邮箱地址'
    return
  }
  if (!/^\d{6}$/.test(normalizedCode)) {
    codeError.value = '请输入邮件中的 6 位数字验证码'
    return
  }
  if (sentEmail.value && sentEmail.value !== normalizedEmail) {
    emailError.value = '邮箱已修改，请重新获取验证码'
    return
  }

  verifying.value = true
  setFeedback('正在验证企业邮箱和员工身份...')
  try {
    await innerEmployeeVerify({ email: normalizedEmail, captcha: normalizedCode })
    if (!active)
      return
    verifiedRemotely.value = true
  }
  catch (error) {
    if (!active)
      return
    const message = errorMessage(error, '员工认证失败，请检查邮箱和验证码。')
    if (message.includes('验证码'))
      codeError.value = message
    else if (message.includes('邮箱'))
      emailError.value = message
    setFeedback(message, 'error')
    return
  }
  finally {
    if (active)
      verifying.value = false
  }

  await refreshCertifiedUser()
}
</script>

<template>
  <view>
    <view class="mb-5">
      <view class="mb-2 flex items-center gap-1">
        <text class="text-app-danger font-700">*</text>
        <text class="text-sm text-app-ink font-700">企业邮箱</text>
      </view>
      <view class="box-border h-92rpx flex items-center border-2rpx rounded-20rpx border-solid bg-white px-3.5 transition-colors" :class="emailError ? 'border-app-danger' : 'border-[#dfe7f2]'">
        <view class="i-carbon-email mr-2.5 flex-none text-lg text-brand-blue leading-none" aria-hidden="true" />
        <input
          class="h-full min-w-0 flex-1 text-sm text-app-ink"
          type="text"
          :value="email"
          placeholder="请输入企业邮箱"
          placeholder-style="color:#9aa5b5"
          :disabled="busy"
          aria-label="企业邮箱"
          @input="handleEmailInput"
        >
      </view>
      <text v-if="emailError" class="mt-1.5 block text-xs text-app-danger" role="alert">{{ emailError }}</text>
    </view>

    <view>
      <view class="mb-2 flex items-center gap-1">
        <text class="text-app-danger font-700">*</text>
        <text class="text-sm text-app-ink font-700">邮箱验证码</text>
      </view>
      <view class="box-border h-92rpx flex items-center border-2rpx rounded-20rpx border-solid bg-white pl-3.5 pr-1.5 transition-colors" :class="codeError ? 'border-app-danger' : 'border-[#dfe7f2]'">
        <view class="i-carbon-password mr-2.5 flex-none text-lg text-brand-blue leading-none" aria-hidden="true" />
        <input
          class="h-full min-w-0 flex-1 text-sm text-app-ink"
          type="number"
          :value="code"
          :maxlength="6"
          placeholder="请输入 6 位验证码"
          placeholder-style="color:#9aa5b5"
          :disabled="busy"
          aria-label="邮箱验证码"
          @input="handleCodeInput"
        >
        <button
          class="code-button box-border min-h-68rpx flex flex-none items-center justify-center border-0 rounded-16rpx px-3 text-xs font-700 leading-none"
          :class="canSend ? 'bg-[#eaf2ff] text-brand-blue active:opacity-72' : 'bg-[#f1f4f8] text-[#9aa5b5]'"
          :disabled="!canSend"
          :aria-label="seconds ? `${seconds} 秒后可重新发送验证码` : '发送邮箱验证码'"
          @tap="handleSendCode"
        >
          {{ seconds ? `${seconds}s` : sending ? '发送中' : '发送验证码' }}
        </button>
      </view>
      <text v-if="codeError" class="mt-1.5 block text-xs text-app-danger" role="alert">{{ codeError }}</text>
    </view>

    <view
      class="mt-3 flex items-start gap-2 rounded-18rpx px-3 py-2.5 text-xs leading-[1.55]"
      :class="feedbackType === 'error'
        ? 'bg-[#fff2f3] text-app-danger'
        : feedbackType === 'success'
          ? 'bg-[#edfbf6] text-app-success'
          : 'bg-[#f3f7fd] text-app-muted'"
      :role="feedbackType === 'error' ? 'alert' : 'status'"
    >
      <view class="i-carbon-information mt-0.5 flex-none text-sm leading-none" aria-hidden="true" />
      <text class="min-w-0 flex-1">{{ feedback }}</text>
    </view>

    <button
      class="certification-button mt-6 h-92rpx w-full flex items-center justify-center border-0 rounded-46rpx p-0 text-base text-white font-700 shadow-[0_12rpx_28rpx_rgba(45,111,230,0.24)] bg-brand-hero"
      :class="canSubmit ? 'active:opacity-84' : 'opacity-48'"
      :disabled="!canSubmit"
      :loading="busy"
      @tap="handleSubmit"
    >
      {{ submitText }}
    </button>
  </view>
</template>

<style scoped>
.code-button::after,
.certification-button::after {
  border: 0;
}
</style>
