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
const phoneLoginEnabled = computed(() => !loading.value && !validatePhoneByAreaCode(form.phone, area.value.code) && !validateVerificationCode(form.code) && agreed.value)

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
  showAgreement.value = true
  return false
}

function confirmAgreement() {
  agreed.value = true
  showAgreement.value = false
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

async function submitPhoneLogin() {
  checkPhone()
  checkCode()
  if (loading.value || !requireAgreement() || errors.phone || errors.code)
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
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] flex flex-col overflow-hidden bg-white text-[#222]">
    <view class="relative h-620rpx flex-none overflow-hidden bg-[linear-gradient(180deg,#d9edff_0%,#f0f8ff_66%,#ffffff_100%)]">
      <view class="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(64,151,246,0.22),transparent_58%)]" />
      <view class="absolute bottom-372rpx left-0 right-0 text-center text-64rpx text-[#8ecbff] font-900 tracking-2rpx">
        TALENT FOR YOU
      </view>
      <view class="absolute bottom-300rpx left-0 right-0 flex items-start justify-center text-72rpx text-[#262626] font-900 tracking-5rpx">
        <text>麟才寻你</text>
        <text class="ml-4rpx mt-6rpx text-22rpx font-500">®</text>
      </view>
      <view class="absolute bottom-50rpx left-1/2 z-2 h-250rpx w-186rpx -translate-x-1/2" aria-label="品牌吉祥物">
        <view class="absolute left-20rpx top-0 z-3 h-99rpx w-145rpx rounded-[50%_50%_25%_25%] bg-[#075fc2] shadow-[inset_0_12rpx_18rpx_rgba(255,255,255,0.32)]" />
        <view class="absolute left-10rpx top-65rpx z-1 h-123rpx w-166rpx rounded-[46%] bg-[#ffd8c7]" />
        <view class="absolute left-0 top-50rpx z-4 h-87rpx w-186rpx rounded-[52%_52%_38%_38%] bg-[#77bcff]">
          <view class="mascot-eye absolute left-38rpx top-24rpx h-56rpx w-36rpx border-6rpx border-[#252525] rounded-[48%] border-solid bg-white" />
          <view class="mascot-eye absolute right-39rpx top-24rpx h-56rpx w-36rpx border-6rpx border-[#252525] rounded-[48%] border-solid bg-white" />
        </view>
        <view class="absolute bottom-0 left-36rpx z-0 h-92rpx w-115rpx rounded-t-36rpx bg-[#0870d9]" />
        <view class="absolute bottom-34rpx left-66rpx z-0 h-62rpx w-55rpx rounded-t-24rpx bg-[#77bcff]" />
        <view class="absolute bottom-0 left-27rpx z-0 h-63rpx w-46rpx rounded-b-24rpx bg-[#0574da] -rotate-12" />
        <view class="absolute bottom-0 right-27rpx z-0 h-63rpx w-46rpx rotate-12 rounded-b-24rpx bg-[#0574da]" />
      </view>
      <view class="absolute bottom-20rpx left-1/2 h-40rpx w-380rpx rounded-[50%] bg-[#2387ed] -translate-x-1/2" />
    </view>

    <view class="min-h-0 flex-1 px-88rpx pb-[calc(28rpx+env(safe-area-inset-bottom))] pt-24rpx">
      <view v-if="mode === 'phone'">
        <view class="h-96rpx flex items-center border-b-1rpx border-b-[#eee] border-b-solid text-34rpx">
          <view
            class="h-full flex flex-none items-center whitespace-nowrap border-r-1rpx border-r-app-border border-r-solid pr-22rpx"
            role="button"
            :aria-label="`当前区号 +${area.code}，点击选择国家和地区`"
            @tap="showAreaPicker = true"
          >
            <text class="leading-none">+{{ area.code }}</text>
            <view class="i-carbon-chevron-down ml-10rpx h-30rpx w-30rpx flex-none text-app-muted leading-none" />
          </view>
          <input
            class="h-full min-w-0 flex-1 pl-24rpx text-[#333]"
            :value="form.phone"
            type="number"
            :maxlength="phoneMaxLength"
            placeholder="请输入手机号"
            placeholder-class="login-placeholder"
            @input="updatePhone($event.detail.value)"
            @blur="checkPhone"
          >
        </view>
        <text v-if="errors.phone" class="mt-8rpx block text-24rpx text-[#d74b3f]">{{ errors.phone }}</text>

        <view class="h-96rpx flex items-center border-b-1rpx border-b-[#eee] border-b-solid text-34rpx">
          <input
            v-model="form.code"
            class="h-full min-w-0 flex-1 text-[#333]"
            type="number"
            maxlength="6"
            placeholder="请输入验证码"
            placeholder-class="login-placeholder"
            @blur="checkCode"
          >
          <text
            class="whitespace-nowrap border-l-1rpx border-l-[#ddd] border-l-solid pl-28rpx text-brand-blue font-600"
            @tap="requestCode"
          >
            {{ seconds ? `${seconds}s 后重试` : '获取验证码' }}
          </text>
        </view>
        <text v-if="errors.code" class="mt-8rpx block text-24rpx text-[#d74b3f]">{{ errors.code }}</text>

        <button
          class="login-button mt-44rpx h-96rpx rounded-48rpx border-none text-38rpx leading-96rpx"
          :class="phoneLoginEnabled ? 'bg-brand-blue text-white' : 'bg-[#b8d9fa] text-[#78a9d8]'"
          :disabled="!phoneLoginEnabled"
          @tap="submitPhoneLogin"
        >
          登录
        </button>
      </view>

      <view v-else>
        <!-- #ifdef MP-WEIXIN -->
        <button
          v-if="agreed"
          class="login-button h-96rpx rounded-48rpx border-none bg-brand-blue text-38rpx text-white leading-96rpx"
          :loading="loading"
          open-type="getPhoneNumber"
          @getphonenumber="onWechatPhoneNumber"
        >
          一键登录
        </button>
        <button
          v-else
          class="login-button h-96rpx rounded-48rpx border-none bg-brand-blue text-38rpx text-white leading-96rpx"
          @tap="requireAgreement"
        >
          一键登录
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <button
          class="login-button h-96rpx rounded-48rpx border-none bg-brand-blue text-38rpx text-white leading-96rpx"
          :loading="loading"
          @tap="startWechatLogin"
        >
          微信一键登录
        </button>
        <!-- #endif -->
        <text class="mt-32rpx block text-center text-30rpx text-[#999]">手机号安全登录</text>
      </view>

      <view class="mt-28rpx flex flex-wrap items-start text-24rpx text-[#777] leading-36rpx" @tap="agreed = !agreed">
        <view
          class="mr-14rpx mt-3rpx box-border h-32rpx w-32rpx flex-none border-2rpx rounded-full border-solid text-center text-24rpx text-white leading-28rpx"
          :class="agreed ? 'border-brand-blue bg-brand-blue' : 'border-[#c8c8c8]'"
        >
          {{ agreed ? '✓' : '' }}
        </view>
        <text>我已阅读并同意</text>
        <text class="text-brand-blue" @tap.stop="goTo(AGREEMENT_PAGE)">《服务使用协议》</text>
        <text>和</text>
        <text class="text-brand-blue" @tap.stop="goTo(PRIVACY_PAGE)">《隐私政策》</text>
        <text>，未注册手机号登录后自动生成会员账号</text>
      </view>

      <text v-if="feedback" class="mt-8rpx block text-center text-24rpx text-[#888]">{{ feedback }}</text>
      <text
        class="mt-36rpx block text-center text-30rpx text-[#999]"
        @tap="mode = mode === 'phone' ? 'wechat' : 'phone'"
      >
        {{ mode === 'phone' ? '切换为一键登录' : '切换为手机号登录' }}
      </text>
      <text
        class="mt-24rpx block text-center text-30rpx text-[#999]"
        @tap="uni.reLaunch({ url: '/pages/index/index' })"
      >
        暂不登录
      </text>
    </view>

    <AuthBehaviorCaptchaModal v-if="showCaptcha" @cancel="showCaptcha = false" @success="sendCodeAfterCaptcha" />
    <AuthAreaCodePicker v-if="showAreaPicker" :selected-iso="area.iso" @cancel="showAreaPicker = false" @select="selectArea" />

    <view
      v-if="showAgreement"
      class="fixed inset-0 z-10 flex items-center justify-center bg-[rgba(0,0,0,0.68)]"
      @tap="showAgreement = false"
    >
      <view class="box-border w-592rpx rounded-26rpx bg-white px-40rpx pb-38rpx pt-48rpx" @tap.stop>
        <text class="text-29rpx text-[#555] leading-46rpx">
          请您认真阅读以下协议的全部条款，接受后可开始使用我们的服务，未注册手机号登录后自动生成会员账号。
        </text>
        <view class="mt-24rpx flex flex-wrap gap-16rpx text-28rpx">
          <text class="text-brand-blue" @tap="goTo(AGREEMENT_PAGE)">《服务使用协议》</text>
          <text class="text-brand-blue" @tap="goTo(PRIVACY_PAGE)">《隐私政策》</text>
        </view>
        <view class="mt-46rpx flex gap-26rpx">
          <button
            class="login-button flex-1 border-2rpx border-[#333] rounded-42rpx border-solid bg-white text-34rpx leading-74rpx"
            @tap="showAgreement = false"
          >
            不同意
          </button>
          <button
            class="login-button flex-1 rounded-42rpx border-none bg-brand-blue text-34rpx text-white font-600 leading-78rpx"
            @tap="confirmAgreement"
          >
            同意并登录
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.login-placeholder {
  color: #d8d8d8;
}

.login-button::after {
  border: none;
}

.mascot-eye::after {
  content: '';
  position: absolute;
  top: 18rpx;
  left: 11rpx;
  width: 17rpx;
  height: 27rpx;
  background: #151515;
  border-radius: 50%;
}
</style>
