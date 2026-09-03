<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import { phoneLogin, sendSmsCaptcha } from '@/api/login'
import { AGREEMENT_PAGE, BIND_PHONE_PAGE, PRIVACY_PAGE } from '@/router/config'
import { useTokenStore } from '@/store/token'
import { navigateAfterAuthenticated } from './navigation'
import AuthBehaviorCaptchaModal from './components/AuthBehaviorCaptchaModal.vue'
import AuthAreaCodePicker from './components/AuthAreaCodePicker.vue'
import type { AreaCodeItem } from './area-code'
import { DEFAULT_AREA_ISO, getAreaByIso } from './area-code'
import { getPhoneMaxLength, normalizePhone, validatePhoneByAreaCode, validateVerificationCode } from './auth'

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
const pendingPhoneLogin = ref(false)
const loading = ref(false)
const seconds = ref(0)
const redirectUrl = ref('')
const feedback = ref('')
const showCaptcha = ref(false)
const showAreaPicker = ref(false)
const area = ref<AreaCodeItem>(getAreaByIso(DEFAULT_AREA_ISO))
const form = reactive({ phone: '', code: '' })
const errors = reactive({ phone: '', code: '' })
let timer: ReturnType<typeof setInterval> | undefined
const authClientId = import.meta.env.VITE_AUTH_CLIENT_ID || 'ef51c9a3e9046c4f2ea45142c8a8344a'
const tokenStore = useTokenStore()

const phoneMaxLength = computed(() => getPhoneMaxLength(area.value.code))

onLoad((options) => {
  redirectUrl.value = typeof options?.redirect === 'string' ? options.redirect : ''
})
onUnmounted(() => {
  if (timer)
    clearInterval(timer)
})

function goTo(url: string) {
  uni.navigateTo({ url })
}

function updatePhone(value: string) {
  form.phone = normalizePhone(value, phoneMaxLength.value)
  if (errors.phone)
    errors.phone = validatePhoneByAreaCode(form.phone, area.value.code)
}

function checkPhone() {
  errors.phone = validatePhoneByAreaCode(form.phone, area.value.code)
}

function checkCode() {
  errors.code = validateVerificationCode(form.code)
}

function requireAgreement() {
  if (agreed.value)
    return true
  pendingPhoneLogin.value = false
  showAgreement.value = true
  return false
}

function closeAgreement() {
  showAgreement.value = false
  pendingPhoneLogin.value = false
}

function selectArea(selected: AreaCodeItem) {
  area.value = selected
  showAreaPicker.value = false
  form.phone = normalizePhone(form.phone, phoneMaxLength.value)
  if (errors.phone)
    errors.phone = validatePhoneByAreaCode(form.phone, area.value.code)
}

function requestCode() {
  checkPhone()
  if (errors.phone || seconds.value || loading.value)
    return
  showCaptcha.value = true
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

async function performPhoneLogin() {
  if (loading.value)
    return
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

async function submitPhoneLogin() {
  checkPhone()
  checkCode()
  if (loading.value || errors.phone || errors.code)
    return
  if (!agreed.value) {
    pendingPhoneLogin.value = true
    showAgreement.value = true
    return
  }
  await performPhoneLogin()
}

async function confirmAgreementAndLogin() {
  agreed.value = true
  showAgreement.value = false
  if (!pendingPhoneLogin.value)
    return
  pendingPhoneLogin.value = false
  await performPhoneLogin()
}

function startWechatLogin() {
  if (!requireAgreement())
    return
  // #ifdef MP-WEIXIN
  uni.navigateTo({ url: `${BIND_PHONE_PAGE}?wechat=1&redirect=${encodeURIComponent(redirectUrl.value)}` })
  // #endif
  // #ifndef MP-WEIXIN
  feedback.value = '请在微信小程序中使用微信登录'
  // #endif
}

function onWechatPhoneNumber(event: PhoneNumberEvent) {
  if (!requireAgreement())
    return
  if (!event.detail.code) {
    feedback.value = event.detail.errMsg?.includes('deny') ? '你已取消手机号授权。' : '未获取到微信手机号授权凭证，请重试。'
    return
  }
  // 短信验证码提交时再获取 wx.login() code，避免临时凭证在输入期间过期。
  startWechatLogin()
}

function skipLogin() {
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-white text-[#222]">
    <view class="login-hero relative overflow-hidden bg-[#dceeff]">
      <image
        class="absolute inset-0 h-full w-full"
        src="/static/auth/login-hero-bg.jpg"
        mode="aspectFill"
        aria-hidden="true"
      />

      <view class="hero-copy absolute left-0 right-0 z-2 flex flex-col items-center text-center">
        <view class="flex items-center justify-center text-68rpx text-[#255b8f] font-900 leading-82rpx tracking-3rpx">
          <text>生生智家</text>
        </view>
        <view class="mt-12rpx flex items-center justify-center">
          <view class="h-2rpx w-44rpx bg-[linear-gradient(90deg,transparent,#1788f4)]" />
          <text class="mx-20rpx text-27rpx text-[#344b60] font-500 leading-38rpx tracking-2rpx">与你一起 · 让优秀被看见</text>
          <view class="h-2rpx w-44rpx bg-[linear-gradient(90deg,#1788f4,transparent)]" />
        </view>
        <view class="mt-20rpx flex items-center justify-center gap-18rpx text-25rpx text-[#0a82f7] font-500">
          <view class="h-60rpx w-188rpx flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.8)]">
            <image class="mr-10rpx h-34rpx w-34rpx" src="/static/auth/recruit-social.svg" mode="aspectFit" aria-hidden="true" />
            <text>社会招聘</text>
          </view>
          <view class="h-60rpx w-188rpx flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.8)]">
            <image class="mr-10rpx h-34rpx w-34rpx" src="/static/auth/recruit-campus.svg" mode="aspectFit" aria-hidden="true" />
            <text>校园招聘</text>
          </view>
        </view>
      </view>

      <image
        class="login-mascot absolute bottom-0 right-68rpx z-3"
        src="/static/auth/login-mascot.png"
        mode="aspectFit"
        aria-label="生生智家卡通形象挥手欢迎"
      />
    </view>

    <view class="hero-form-transition h-36rpx" aria-hidden="true" />

    <view class="bg-white px-104rpx pb-[calc(188rpx+env(safe-area-inset-bottom))] pt-6rpx">
      <view v-if="mode === 'phone'">
        <view class="h-94rpx flex items-center border-b-1rpx border-b-[#ececec] border-b-solid text-31rpx">
          <view
            class="tap-target h-full min-w-104rpx flex flex-none items-center whitespace-nowrap pr-8rpx"
            role="button"
            :aria-expanded="showAreaPicker"
            :aria-label="`当前区号 +${area.code}，点击选择国家和地区`"
            @tap="showAreaPicker = true"
          >
            <text class="leading-none">+{{ area.code }}</text>
            <view class="i-carbon-chevron-down ml-5rpx h-24rpx w-24rpx flex-none text-[#727b84] leading-none" />
          </view>
          <input
            class="h-full min-w-0 flex-1 pl-8rpx text-[#333]"
            :value="form.phone"
            type="number"
            :maxlength="phoneMaxLength"
            placeholder="请输入手机号"
            placeholder-class="login-placeholder"
            aria-label="手机号"
            @input="updatePhone($event.detail.value)"
            @blur="checkPhone"
          >
        </view>
        <text v-if="errors.phone" class="mt-8rpx block text-24rpx text-[#d74b3f]" role="alert">{{ errors.phone }}</text>

        <view class="h-94rpx flex items-center border-b-1rpx border-b-[#ececec] border-b-solid text-31rpx">
          <input
            v-model="form.code"
            class="h-full min-w-0 flex-1 text-[#333]"
            type="number"
            :maxlength="6"
            placeholder="请输入验证码"
            placeholder-class="login-placeholder"
            aria-label="短信验证码"
            @blur="checkCode"
          >
          <button
            class="code-button h-full flex flex-none items-center justify-center whitespace-nowrap border-0 bg-transparent pl-26rpx text-30rpx text-[#087ff5] font-400"
            :disabled="Boolean(seconds || loading)"
            :aria-label="seconds ? `${seconds} 秒后可重新获取验证码` : '获取短信验证码'"
            @tap="requestCode"
          >
            {{ seconds ? `${seconds}s 后重试` : '获取验证码' }}
          </button>
        </view>
        <text v-if="errors.code" class="mt-8rpx block text-24rpx text-[#d74b3f]" role="alert">{{ errors.code }}</text>

        <button
          class="login-button mt-44rpx h-92rpx rounded-48rpx border-none bg-[#2389ef] text-34rpx text-white font-600 leading-92rpx transition-opacity duration-180"
          :disabled="loading"
          :loading="loading"
          aria-label="登录"
          @tap="submitPhoneLogin"
        >
          登录
        </button>
      </view>

      <view v-else>
        <!-- #ifdef MP-WEIXIN -->
        <button
          v-if="agreed"
          class="login-button h-92rpx rounded-48rpx border-none bg-[#2389ef] text-34rpx text-white font-600 leading-92rpx"
          :loading="loading"
          open-type="getPhoneNumber"
          @getphonenumber="onWechatPhoneNumber"
        >
          一键登录
        </button>
        <button
          v-else
          class="login-button h-92rpx rounded-48rpx border-none bg-[#2389ef] text-34rpx text-white font-600 leading-92rpx"
          @tap="requireAgreement"
        >
          一键登录
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <button
          class="login-button h-92rpx rounded-48rpx border-none bg-[#2389ef] text-34rpx text-white font-600 leading-92rpx"
          :loading="loading"
          @tap="startWechatLogin"
        >
          微信一键登录
        </button>
        <!-- #endif -->
        <view
          class="tap-target mt-28rpx h-72rpx flex items-center justify-center text-29rpx text-[#8b8b8b]"
          role="button"
          aria-label="切换为手机号安全登录"
          @tap="mode = 'phone'"
        >
          <text>手机号安全登录</text>
        </view>
      </view>

      <view
        class="mt-24rpx flex items-start text-23rpx text-[#666] leading-34rpx"
        role="checkbox"
        :aria-checked="agreed"
        aria-label="同意服务使用协议和隐私政策"
        @tap="agreed = !agreed"
      >
        <view class="h-64rpx w-64rpx flex flex-none items-center justify-center -ml-16rpx -mt-13rpx">
          <view
            class="box-border h-30rpx w-30rpx border-2rpx rounded-full border-solid text-center text-22rpx text-white leading-26rpx transition-colors duration-180"
            :class="agreed ? 'border-[#2389ef] bg-[#2389ef]' : 'border-[#bfc4c9] bg-white'"
          >
            {{ agreed ? '✓' : '' }}
          </view>
        </view>
        <view class="min-w-0 flex flex-1 flex-wrap">
          <text>我已阅读并同意</text>
          <text class="tap-link text-[#087ff5]" role="link" @tap.stop="goTo(AGREEMENT_PAGE)">《服务使用协议》</text>
          <text>和</text>
          <text class="tap-link text-[#087ff5]" role="link" @tap.stop="goTo(PRIVACY_PAGE)">《隐私政策》</text>
          <text>，未注册手机号登录后自动生成会员账号</text>
        </view>
      </view>

      <text v-if="feedback" class="mt-10rpx block text-center text-24rpx text-[#6f7780]" role="status">{{ feedback }}</text>
    </view>

    <view class="login-footer fixed inset-x-0 bottom-0 z-10 bg-white px-104rpx pb-[calc(12rpx+env(safe-area-inset-bottom))] pt-8rpx">
      <view
        v-if="mode === 'phone'"
        class="tap-target h-72rpx flex items-center justify-center text-29rpx text-[#777]"
        role="button"
        aria-label="切换为微信一键登录"
        @tap="mode = 'wechat'"
      >
        <text>切换为一键登录</text>
      </view>
      <view
        class="tap-target h-72rpx flex items-center justify-center text-29rpx text-[#777]"
        role="button"
        aria-label="暂不登录，进入首页"
        @tap="skipLogin"
      >
        <text>暂不登录</text>
      </view>
    </view>

    <AuthBehaviorCaptchaModal v-if="showCaptcha" @cancel="showCaptcha = false" @success="sendCodeAfterCaptcha" />
    <AuthAreaCodePicker v-if="showAreaPicker" :selected-iso="area.iso" @cancel="showAreaPicker = false" @select="selectArea" />

    <view
      v-if="showAgreement"
      class="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(7,24,54,0.72)] px-40rpx"
      role="dialog"
      aria-label="服务协议确认"
    >
      <view class="box-border max-w-620rpx w-full overflow-hidden rounded-32rpx bg-white shadow-[0_24rpx_80rpx_rgba(7,45,94,0.28)]" @tap.stop>
        <view class="h-12rpx bg-[linear-gradient(90deg,#21b9f3_0%,#2d6fe6_100%)]" />
        <view class="px-40rpx pb-38rpx pt-36rpx">
          <text class="block text-center text-34rpx text-[#18365f] font-700">服务协议与隐私政策</text>
          <view class="mt-24rpx flex flex-wrap text-28rpx text-[#5d6775] leading-46rpx">
            <text>请您认真阅读</text>
            <text class="tap-link text-[#167cf3]" role="link" @tap="goTo(AGREEMENT_PAGE)">《服务使用协议》</text>
            <text>和</text>
            <text class="tap-link text-[#167cf3]" role="link" @tap="goTo(PRIVACY_PAGE)">《隐私政策》</text>
            <text>的全部条款，接受后可开始使用我们的服务，未注册手机号登录后将自动生成会员账号。</text>
          </view>
          <view class="mt-40rpx flex gap-22rpx">
            <button class="login-button h-84rpx flex-1 border-2rpx border-[#2d6fe6] rounded-44rpx border-solid bg-white p-0 text-31rpx text-[#2d6fe6] font-600 leading-80rpx" @tap="closeAgreement">
              不同意
            </button>
            <button class="login-button h-84rpx flex-1 rounded-44rpx border-none bg-[linear-gradient(90deg,#21a9ef_0%,#2d6fe6_100%)] p-0 text-31rpx text-white font-600 leading-84rpx" @tap="confirmAgreementAndLogin">
              同意并登录
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.login-hero {
  height: 840rpx;
}

.hero-copy {
  top: calc(env(safe-area-inset-top) + 190rpx);
}

.login-mascot {
  width: 270rpx;
  height: 406rpx;
  filter: drop-shadow(0 12rpx 16rpx rgba(24, 98, 161, 0.08));
}

.hero-form-transition {
  margin-top: -2rpx;
  background: linear-gradient(180deg, #e8f5ff 0%, rgba(246, 251, 255, 0.92) 48%, #fff 100%);
}

@media (max-height: 820px) {
  .login-hero {
    height: 720rpx;
  }

  .hero-copy {
    top: calc(env(safe-area-inset-top) + 150rpx);
  }

  .login-mascot {
    width: 232rpx;
    height: 350rpx;
  }

  .hero-form-transition {
    height: 24rpx;
  }
}

@media (max-height: 700px) {
  .login-hero {
    height: 590rpx;
  }

  .hero-copy {
    top: calc(env(safe-area-inset-top) + 84rpx);
  }

  .login-mascot {
    right: 48rpx;
    width: 180rpx;
    height: 270rpx;
  }
}

.login-placeholder {
  color: #aaa;
}

.login-button::after,
.code-button::after {
  border: none;
}

.code-button {
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent !important;
  font-weight: 400;
  line-height: 1;
}

.code-button[disabled] {
  background: transparent !important;
  color: #8ebce8;
  opacity: 1;
}

.tap-target,
.tap-link,
.code-button,
.login-button {
  transition: opacity var(--app-motion-duration-fast) var(--app-motion-easing-standard);
}

.tap-target:active,
.tap-link:active,
.code-button:active,
.login-button:active {
  opacity: 0.68;
}
</style>
