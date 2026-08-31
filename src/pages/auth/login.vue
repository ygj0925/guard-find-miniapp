<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import { phoneLogin, sendSmsCaptcha } from '@/api/login'
import { AGREEMENT_PAGE, BIND_PHONE_PAGE, PRIVACY_PAGE } from '@/router/config'
import { useTokenStore } from '@/store/token'
import { navigateAfterAuthenticated } from './navigation'
import AuthBehaviorCaptchaModal from './components/AuthBehaviorCaptchaModal.vue'
import { normalizePhone, validatePhone, validateVerificationCode } from './auth'

definePage({
  excludeLoginPath: true,
  style: {
    navigationStyle: 'custom',
    navigationBarBackgroundColor: '#D9EDFF',
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '会员登录',
    backgroundColor: '#FFFFFF',
  },
})

type LoginMode = 'phone' | 'wechat'
interface PhoneNumberEvent { detail: { code?: string, errMsg?: string } }

const mode = ref<LoginMode>('phone')
const agreed = ref(false)
const showAgreement = ref(false)
const loading = ref(false)
const seconds = ref(0)
const redirectUrl = ref('')
const feedback = ref('')
const showCaptcha = ref(false)
const form = reactive({ phone: '', code: '' })
const errors = reactive({ phone: '', code: '' })
let timer: ReturnType<typeof setInterval> | undefined
const authClientId = import.meta.env.VITE_AUTH_CLIENT_ID || 'ef51c9a3e9046c4f2ea45142c8a8344a'
const tokenStore = useTokenStore()

const phoneLoginEnabled = computed(() => !loading.value && !validatePhone(form.phone) && !validateVerificationCode(form.code) && agreed.value)

onLoad((options) => { redirectUrl.value = typeof options?.redirect === 'string' ? options.redirect : '' })
onUnmounted(() => { if (timer) clearInterval(timer) })

function goTo(url: string) { uni.navigateTo({ url }) }
function updatePhone(value: string) { form.phone = normalizePhone(value); if (errors.phone) errors.phone = validatePhone(form.phone) }
function checkPhone() { errors.phone = validatePhone(form.phone) }
function checkCode() { errors.code = validateVerificationCode(form.code) }
function requireAgreement() { if (agreed.value) return true; showAgreement.value = true; return false }
function confirmAgreement() { agreed.value = true; showAgreement.value = false }

function requestCode() {
  checkPhone()
  if (errors.phone || seconds.value || loading.value) return
  showCaptcha.value = true
}

function startCountdown() {
  seconds.value = 60
  timer = setInterval(() => {
    seconds.value -= 1
    if (seconds.value <= 0 && timer) { clearInterval(timer); timer = undefined }
  }, 1000)
}

async function sendCodeAfterCaptcha(captchaVerification: string) {
  showCaptcha.value = false
  loading.value = true
  feedback.value = ''
  try {
    await sendSmsCaptcha(form.phone, { captchaType: 'blockPuzzle', captchaVerification })
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

async function submitPhoneLogin() {
  checkPhone(); checkCode()
  if (loading.value || !requireAgreement() || errors.phone || errors.code) return
  loading.value = true
  feedback.value = ''
  try {
    const token = await phoneLogin({
      clientId: authClientId,
      authType: 'PHONE',
      phone: form.phone,
      captcha: form.code,
    })
    await tokenStore.completeExternalLogin(token)
    navigateAfterAuthenticated(redirectUrl.value)
  }
  catch (error) {
    feedback.value = error instanceof Error ? error.message : '登录失败，请稍后重试。'
  }
  finally {
    loading.value = false
  }
}

function startWechatLogin() {
  if (!requireAgreement()) return
  // #ifdef MP-WEIXIN
  uni.navigateTo({ url: `${BIND_PHONE_PAGE}?wechat=1&redirect=${encodeURIComponent(redirectUrl.value)}` })
  // #endif
  // #ifndef MP-WEIXIN
  feedback.value = '请在微信小程序中使用微信登录'
  // #endif
}

function onWechatPhoneNumber(event: PhoneNumberEvent) {
  if (!requireAgreement()) return
  if (!event.detail.code) {
    feedback.value = event.detail.errMsg?.includes('deny') ? '你已取消手机号授权。' : '未获取到微信手机号授权凭证，请重试。'
    return
  }
  // 短信验证码提交时再获取 wx.login() code，避免临时凭证在输入期间过期。
  startWechatLogin()
}
</script>

<template>
  <view class="member-login min-h-[var(--app-viewport-height)] overflow-hidden bg-white text-[#222]">
    <view class="hero relative h-700rpx overflow-hidden">
      <view class="hero-glow absolute inset-0" />
      <view class="brand-word absolute left-0 right-0 top-178rpx text-center text-76rpx text-[#8ecbff] font-900 tracking-2rpx">BUSY FOR YOU</view>
      <view class="brand-cn absolute left-0 right-0 top-248rpx text-center text-82rpx text-[#262626] font-900 tracking-5rpx">零食很忙</view>
      <view class="mascot absolute left-1/2 top-350rpx h-292rpx w-218rpx -translate-x-1/2" aria-label="品牌吉祥物">
        <view class="hat absolute left-24rpx top-0 h-116rpx w-170rpx rounded-[50%_50%_25%_25%] bg-[#075fc2] shadow-[inset_0_14rpx_22rpx_rgba(255,255,255,0.32)]" />
        <view class="face absolute left-12rpx top-76rpx h-144rpx w-194rpx rounded-[46%] bg-[#ffd8c7]" />
        <view class="mask absolute left-0 top-58rpx h-102rpx w-218rpx rounded-[52%_52%_38%_38%] bg-[#77bcff]"><view class="eye left-46rpx" /><view class="eye right-46rpx" /></view>
        <view class="body absolute bottom-0 left-42rpx h-108rpx w-134rpx rounded-t-42rpx bg-[#0870d9]" /><view class="shirt absolute bottom-40rpx left-77rpx h-72rpx w-64rpx rounded-t-28rpx bg-[#77bcff]" />
        <view class="leg absolute bottom-0 left-32rpx h-74rpx w-54rpx rounded-b-28rpx bg-[#0574da] -rotate-12" /><view class="leg absolute bottom-0 right-32rpx h-74rpx w-54rpx rounded-b-28rpx bg-[#0574da] rotate-12" />
      </view>
      <view class="stage absolute bottom-25rpx left-1/2 h-46rpx w-440rpx -translate-x-1/2 rounded-[50%] bg-[#2387ed]" />
    </view>

    <view class="px-88rpx"><text class="block pt-16rpx text-center text-40rpx font-500">成为会员，立享更多优惠福利</text>
      <view v-if="mode === 'phone'" class="mt-132rpx">
        <view class="field"><text class="country">+86　⌄</text><input :value="form.phone" type="number" maxlength="11" placeholder="请输入手机号" placeholder-class="placeholder" @input="updatePhone($event.detail.value)" @blur="checkPhone"></view><text v-if="errors.phone" class="error">{{ errors.phone }}</text>
        <view class="field"><input v-model="form.code" type="number" maxlength="6" placeholder="请输入验证码" placeholder-class="placeholder" @blur="checkCode"><text class="code-action" @tap="requestCode">{{ seconds ? `${seconds}s 后重试` : '获取验证码' }}</text></view><text v-if="errors.code" class="error">{{ errors.code }}</text>
        <button class="login-button" :disabled="!phoneLoginEnabled" @tap="submitPhoneLogin">登录</button>
      </view>
      <view v-else class="mt-154rpx">
        <!-- #ifdef MP-WEIXIN --><button v-if="agreed" class="login-button" :loading="loading" open-type="getPhoneNumber" @getphonenumber="onWechatPhoneNumber">一键登录</button><button v-else class="login-button" @tap="requireAgreement">一键登录</button><!-- #endif -->
        <!-- #ifndef MP-WEIXIN --><button class="login-button" :loading="loading" @tap="startWechatLogin">微信一键登录</button><!-- #endif -->
        <text class="block mt-42rpx text-center text-32rpx text-[#999]">手机号安全登录</text>
      </view>
      <view class="agreement" @tap="agreed = !agreed"><view class="agreement-check" :class="{ checked: agreed }">{{ agreed ? '✓' : '' }}</view><text>我已阅读并同意</text><text class="agreement-link" @tap.stop="goTo(AGREEMENT_PAGE)">《服务使用协议》</text><text>和</text><text class="agreement-link" @tap.stop="goTo(PRIVACY_PAGE)">《隐私政策》</text><text>，未注册手机号登录后自动生成会员账号</text></view>
      <text v-if="feedback" class="feedback">{{ feedback }}</text><text class="switch-mode" @tap="mode = mode === 'phone' ? 'wechat' : 'phone'">{{ mode === 'phone' ? '切换为一键登录' : '切换为手机号登录' }}</text><text class="skip" @tap="uni.reLaunch({ url: '/pages/index/index' })">暂不登录</text>
    </view>
    <AuthBehaviorCaptchaModal v-if="showCaptcha" @cancel="showCaptcha = false" @success="sendCodeAfterCaptcha" />
    <view v-if="showAgreement" class="agreement-mask" @tap="showAgreement = false"><view class="agreement-dialog" @tap.stop><text class="dialog-copy">请您认真阅读以下协议的全部条款，接受后可开始使用我们的服务，未注册手机号登录后自动生成会员账号。</text><view class="dialog-links"><text class="dialog-link" @tap="goTo(AGREEMENT_PAGE)">《服务使用协议》</text><text class="dialog-link" @tap="goTo(PRIVACY_PAGE)">《隐私政策》</text></view><view class="dialog-actions"><button class="dialog-button reject" @tap="showAgreement = false">不同意</button><button class="dialog-button accept" @tap="confirmAgreement">同意并登录</button></view></view></view>
  </view>
</template>

<style scoped>
.hero { background: linear-gradient(180deg, #d9edff 0%, #f0f8ff 66%, #fff 100%); }.hero-glow { background: radial-gradient(ellipse at 50% 35%, rgba(64, 151, 246, .22), transparent 58%); }.mascot { z-index: 2; }.hat { z-index: 3; }.face { z-index: 1; }.mask { z-index: 4; }.body, .shirt, .leg { z-index: 0; }.eye { position: absolute; top: 28rpx; height: 66rpx; width: 42rpx; border: 7rpx solid #252525; border-radius: 48%; background: #fff; }.eye::after { content: ''; position: absolute; left: 11rpx; top: 18rpx; height: 27rpx; width: 17rpx; border-radius: 50%; background: #151515; }.eye:first-child { left: 45rpx; }.field { height: 106rpx; display: flex; align-items: center; border-bottom: 1rpx solid #eee; font-size: 34rpx; }.field input { min-width: 0; flex: 1; height: 100%; color: #333; }.country { padding-right: 24rpx; white-space: nowrap; }.placeholder { color: #d8d8d8; }.code-action { border-left: 1rpx solid #ddd; padding-left: 28rpx; color: #1677df; font-weight: 600; white-space: nowrap; }.error, .feedback { display: block; margin-top: 12rpx; font-size: 24rpx; color: #d74b3f; }.login-button { margin-top: 58rpx; height: 108rpx; border: none; border-radius: 54rpx; background: #1677df; color: #fff; font-size: 42rpx; line-height: 108rpx; }.login-button::after { border: none; }.login-button[disabled] { background: #b8d9fa; color: #78a9d8; }.agreement { margin-top: 56rpx; display: flex; align-items: flex-start; flex-wrap: wrap; color: #777; font-size: 28rpx; line-height: 42rpx; }.agreement-check { box-sizing: border-box; margin: 5rpx 18rpx 0 0; width: 36rpx; height: 36rpx; flex: none; border: 2rpx solid #c8c8c8; border-radius: 50%; color: #fff; font-size: 27rpx; line-height: 32rpx; text-align: center; }.agreement-check.checked { border-color: #1677df; background: #1677df; }.agreement-link, .dialog-link { color: #1677df; }.feedback { text-align: center; color: #888; }.switch-mode, .skip { display: block; text-align: center; color: #999; font-size: 32rpx; }.switch-mode { margin-top: 260rpx; }.skip { margin-top: 48rpx; padding-bottom: calc(42rpx + env(safe-area-inset-bottom)); }.agreement-mask { position: fixed; z-index: 10; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .68); }.agreement-dialog { box-sizing: border-box; width: 592rpx; border-radius: 26rpx; background: #fff; padding: 48rpx 40rpx 38rpx; }.dialog-copy { color: #555; font-size: 29rpx; line-height: 46rpx; }.dialog-links { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 24rpx; font-size: 28rpx; }.dialog-actions { display: flex; gap: 26rpx; margin-top: 46rpx; }.dialog-button { flex: 1; height: 78rpx; border-radius: 42rpx; font-size: 34rpx; line-height: 76rpx; }.dialog-button::after { border: none; }.reject { border: 2rpx solid #333; background: #fff; }.accept { background: #1677df; color: #fff; }
</style>
