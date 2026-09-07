<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import { phoneLogin, sendSmsCaptcha } from '@/api/login'
import { startWechatAuthorization } from '@/service/auth/wechat-auth'
import { useTokenStore } from '@/store/token'
import { navigateAfterAuthenticated } from './navigation'
import AuthButton from './components/AuthButton.vue'
import AuthBehaviorCaptchaModal from './components/AuthBehaviorCaptchaModal.vue'
import AuthInput from './components/AuthInput.vue'
import AuthLayout from './components/AuthLayout.vue'
import { normalizePhone, validatePhone, validateVerificationCode } from './auth'

definePage({
  excludeLoginPath: true,
  style: { navigationStyle: 'custom', navigationBarTitleText: '绑定手机号' },
})

const form = reactive({ phone: '', code: '' })
const errors = reactive({ phone: '', code: '' })
const showCaptcha = ref(false)
const seconds = ref(0)
const feedback = ref('')
const loading = ref(false)
const shouldBindWechat = ref(false)
const redirectUrl = ref('')
let timer: ReturnType<typeof setInterval> | undefined
let activeLoginAttemptId: number | null = null
const canBind = computed(() => !validatePhone(form.phone) && !validateVerificationCode(form.code))
const authClientId = import.meta.env.VITE_AUTH_CLIENT_ID || 'ef51c9a3e9046c4f2ea45142c8a8344a'
const tokenStore = useTokenStore()

onLoad((options) => {
  shouldBindWechat.value = options?.wechat === '1'
  redirectUrl.value = typeof options?.redirect === 'string' ? options.redirect : ''
})

function cancelPendingLogin() {
  if (activeLoginAttemptId === null)
    return
  tokenStore.cancelLoginAttempt(activeLoginAttemptId)
  activeLoginAttemptId = null
}

function goBack() {
  cancelPendingLogin()
  uni.navigateBack()
}

function updatePhone(value: string) {
  form.phone = normalizePhone(value)
  if (errors.phone) {
    checkPhone()
  }
}

function checkPhone() {
  errors.phone = validatePhone(form.phone)
}

function checkCode() {
  errors.code = validateVerificationCode(form.code)
}

function requestCode() {
  checkPhone()
  if (!errors.phone && !seconds.value && !loading.value) {
    showCaptcha.value = true
  }
}

function startCountdown() {
  seconds.value = 60
  timer = setInterval(() => {
    seconds.value -= 1
    if (seconds.value <= 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }, 1000)
}

async function confirmCaptcha(captchaVerification: string) {
  showCaptcha.value = false
  loading.value = true
  feedback.value = ''
  try {
    await sendSmsCaptcha(form.phone, {
      captchaType: 'blockPuzzle',
      captchaVerification,
    })
    startCountdown()
    feedback.value = '验证码已发送，请注意查收。'
  }
  catch (error) {
    feedback.value = error instanceof Error ? error.message : '验证码发送失败，请稍后重试。'
  }
  finally {
    loading.value = false
  }
}

async function submit() {
  checkPhone()
  checkCode()
  if (!canBind.value || loading.value) {
    return
  }

  const attemptId = tokenStore.beginLoginAttempt()
  activeLoginAttemptId = attemptId
  loading.value = true
  feedback.value = ''
  try {
    let wxLoginCode: string | undefined
    if (shouldBindWechat.value) {
      const authorization = await startWechatAuthorization()
      if (authorization.status !== 'binding_required') {
        throw new Error(authorization.message)
      }
      wxLoginCode = authorization.code
    }

    const token = await phoneLogin({
      clientId: authClientId,
      authType: 'PHONE',
      phone: form.phone,
      captcha: form.code,
      wxLoginCode,
    })
    const committed = await tokenStore.completeExternalLogin(token, attemptId)
    if (!committed)
      return
    if (activeLoginAttemptId === attemptId)
      activeLoginAttemptId = null
    navigateAfterAuthenticated(redirectUrl.value)
  }
  catch (error) {
    feedback.value = error instanceof Error ? error.message : '登录失败，请稍后重试。'
  }
  finally {
    tokenStore.cancelLoginAttempt(attemptId)
    if (activeLoginAttemptId === attemptId)
      activeLoginAttemptId = null
    loading.value = false
  }
}

onUnmounted(() => {
  cancelPendingLogin()
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<template>
  <AuthLayout title="绑定手机号" subtitle="绑定后可使用手机号安全登录" @back="goBack">
    <AuthInput v-model="form.phone" icon="⌕" placeholder="请输入手机号" input-type="number" :maxlength="11" :error="errors.phone" @blur="checkPhone" @update:model-value="updatePhone" />
    <AuthInput v-model="form.code" icon="◇" placeholder="请输入验证码" input-type="number" :maxlength="6" :error="errors.code" :action-text="seconds ? `${seconds}s` : '发送验证码'" @blur="checkCode" @action="requestCode" />
    <AuthButton label="登录并关联微信" :disabled="!canBind || loading" :loading="loading" @tap="submit" />
    <text v-if="feedback" class="mt-3 block text-center text-2xs text-#3b82f6 leading-[1.5]">{{ feedback }}</text>
    <AuthBehaviorCaptchaModal v-if="showCaptcha" @cancel="showCaptcha = false" @success="confirmCaptcha" />
  </AuthLayout>
</template>
