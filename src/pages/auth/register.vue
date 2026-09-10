<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import { PRIVACY_PAGE } from '@/router/config'
import AuthPrivacyConsent from './components/AuthPrivacyConsent.vue'
import AuthButton from './components/AuthButton.vue'
import AuthCaptchaModal from './components/AuthCaptchaModal.vue'
import AuthInput from './components/AuthInput.vue'
import AuthLayout from './components/AuthLayout.vue'
import { canSubmitPhoneCode, normalizePhone, validatePhone, validateVerificationCode } from './auth'

definePage({
  excludeLoginPath: true,
  style: {
    navigationStyle: 'custom',
    navigationBarBackgroundColor: '#2D6FE6',
    navigationBarTextStyle: 'white',
    navigationBarTitleText: '验证码登录/注册',
    backgroundColor: '#FFFFFF',
    backgroundColorTop: '#2D6FE6',
    backgroundColorBottom: '#FFFFFF',
  },
})

const form = reactive({ phone: '', code: '', agreed: false })
const errors = reactive({ phone: '', code: '', agreement: '' })
const showCaptcha = ref(false)
const seconds = ref(0)
const feedback = ref('')
let timer: ReturnType<typeof setInterval> | undefined
const canSubmit = computed(() => canSubmitPhoneCode(form))

function goTo(url: string) {
  uni.navigateTo({ url })
}

function goBack() {
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

function requestCode() {
  checkPhone()
  if (errors.phone || seconds.value) {
    return
  }
  showCaptcha.value = true
}

function confirmCaptcha() {
  showCaptcha.value = false
  startCountdown()
  feedback.value = '验证码已发送（开发演示，不会发送真实短信）'
}

function submit() {
  checkPhone()
  checkCode()
  errors.agreement = form.agreed ? '' : '请先阅读并同意《隐私政策》'
  if (!canSubmit.value || errors.agreement) {
    return
  }
  feedback.value = '验证码登录/注册服务待接入，本次不会创建账号。'
}

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<template>
  <AuthLayout title="验证码登录/注册" subtitle="未注册的手机号将自动注册" @back="goBack">
    <AuthInput v-model="form.phone" icon="⌕" placeholder="请输入手机号" input-type="number" :maxlength="11" :error="errors.phone" @blur="checkPhone" @update:model-value="updatePhone" />
    <AuthInput v-model="form.code" icon="◇" placeholder="请输入验证码" input-type="number" :maxlength="6" :error="errors.code" :action-text="seconds ? `${seconds}s` : '发送验证码'" @blur="checkCode" @action="requestCode" />
    <AuthPrivacyConsent v-model="form.agreed" @privacy="goTo(PRIVACY_PAGE)" />
    <text v-if="errors.agreement" class="mb-3 block text-center text-2xs text-#e95d63 leading-[1.5] -mt-2">{{ errors.agreement }}</text>
    <AuthButton label="登录 / 注册" @tap="submit" />
    <text class="mt-3 block min-h-74rpx cursor-pointer text-center text-xs text-#467bff font-600 leading-74rpx" role="link" @tap="goTo('/pages/auth/login')">使用账号密码登录</text>
    <text v-if="feedback" class="mb-3 block text-center text-2xs text-#467bff leading-[1.5] -mt-2">{{ feedback }}</text>
    <AuthCaptchaModal v-if="showCaptcha" @cancel="showCaptcha = false" @confirm="confirmCaptcha" />
  </AuthLayout>
</template>
