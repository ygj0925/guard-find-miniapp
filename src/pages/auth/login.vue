<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import { getWechatMiniPhoneLoginConfig, phoneLogin, sendSmsCaptcha, wechatMiniPhoneLogin } from '@/api/login'
import type { WechatMiniPhoneVerificationMode } from '@/api/types/login'
import { PRIVACY_PAGE } from '@/router/config'
import { startWechatAuthorization } from '@/service/auth/wechat-auth'
// #ifdef H5
import { isWechatH5LoginEnabled, startWechatH5OAuth } from '@/service/auth/wechat-h5-oauth'
// #endif
import { useTokenStore } from '@/store/token'
import { navigateAfterAuthenticated, resolveAuthRedirect } from './navigation'
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

type PendingLoginAction = 'phone' | 'wechat' | null
interface PhoneNumberEvent { detail: { code?: string, errMsg?: string } }

const agreed = ref(false)
const showAgreement = ref(false)
const pendingLoginAction = ref<PendingLoginAction>(null)
const loading = ref(false)
const seconds = ref(0)
const redirectUrl = ref('')
const feedback = ref('')
const wechatPhoneVerificationMode = ref<WechatMiniPhoneVerificationMode>('FAST')
const wechatPhoneConfigLoading = ref(true)
const showCaptcha = ref(false)
const showAreaPicker = ref(false)
const area = ref<AreaCodeItem>(getAreaByIso(DEFAULT_AREA_ISO))
const form = reactive({ phone: '', code: '' })
const errors = reactive({ phone: '', code: '' })
let timer: ReturnType<typeof setInterval> | undefined
let activeLoginAttemptId: number | null = null
const authClientId = import.meta.env.VITE_AUTH_CLIENT_ID || 'ef51c9a3e9046c4f2ea45142c8a8344a'
const tokenStore = useTokenStore()
// #ifdef H5
const wechatH5LoginEnabled = isWechatH5LoginEnabled()
// #endif

const phoneMaxLength = computed(() => getPhoneMaxLength(area.value.code))
const wechatPhoneOpenType = computed(() => wechatPhoneVerificationMode.value === 'REALTIME'
  ? 'getRealtimePhoneNumber'
  : 'getPhoneNumber')

onLoad((options) => {
  redirectUrl.value = typeof options?.redirect === 'string' ? options.redirect : ''
  void loadWechatPhoneLoginConfig()
})
onUnmounted(() => {
  cancelPendingLogin()
  if (timer)
    clearInterval(timer)
})

async function loadWechatPhoneLoginConfig() {
  // #ifdef MP-WEIXIN
  try {
    const config = await getWechatMiniPhoneLoginConfig()
    if (config.phoneVerificationMode === 'REALTIME')
      wechatPhoneVerificationMode.value = 'REALTIME'
  }
  catch {
    // 配置不可用时使用后端默认的 FAST 组件模式。
    wechatPhoneVerificationMode.value = 'FAST'
  }
  finally {
    wechatPhoneConfigLoading.value = false
  }
  // #endif
  // #ifndef MP-WEIXIN
  wechatPhoneConfigLoading.value = false
  // #endif
}

function cancelPendingLogin() {
  if (activeLoginAttemptId === null)
    return
  tokenStore.cancelLoginAttempt(activeLoginAttemptId)
  activeLoginAttemptId = null
}

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

function requireAgreement(action: Exclude<PendingLoginAction, null>) {
  if (agreed.value)
    return true
  pendingLoginAction.value = action
  showAgreement.value = true
  return false
}

function closeAgreement() {
  showAgreement.value = false
  pendingLoginAction.value = null
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

async function getWechatLoginCodeForPhoneLogin(): Promise<string | undefined> {
  // #ifdef MP-WEIXIN
  const authorization = await startWechatAuthorization()
  if (authorization.status !== 'binding_required') {
    throw new Error(authorization.message)
  }
  return authorization.code
  // #endif
  // #ifndef MP-WEIXIN
  return undefined
  // #endif
}

async function performPhoneLogin() {
  if (loading.value)
    return

  const attemptId = tokenStore.beginLoginAttempt()
  activeLoginAttemptId = attemptId
  loading.value = true
  feedback.value = ''
  try {
    const wxLoginCode = await getWechatLoginCodeForPhoneLogin()
    const token = await phoneLogin({
      clientId: authClientId,
      authType: 'PHONE',
      phone: form.phone,
      captcha: form.code,
      wxLoginCode,
      shareIds: (uni.getStorageSync('shareIds') || '').split(',').filter(Boolean),
    })
    const committed = await tokenStore.completeExternalLogin(token, attemptId)
    if (!committed)
      return
    uni.removeStorageSync('shareIds')
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

async function submitPhoneLogin() {
  checkPhone()
  checkCode()
  if (loading.value || errors.phone || errors.code)
    return
  if (!agreed.value) {
    pendingLoginAction.value = 'phone'
    showAgreement.value = true
    return
  }
  await performPhoneLogin()
}

async function performH5WechatLogin() {
  // #ifdef H5
  if (loading.value)
    return
  if (!requireAgreement('wechat'))
    return

  loading.value = true
  feedback.value = ''
  try {
    await startWechatH5OAuth(redirectUrl.value)
  }
  catch (error) {
    feedback.value = error instanceof Error ? error.message : '微信登录发起失败，请稍后重试。'
  }
  finally {
    loading.value = false
  }
  // #endif
}

async function confirmAgreementAndLogin() {
  const action = pendingLoginAction.value
  agreed.value = true
  showAgreement.value = false
  pendingLoginAction.value = null
  if (action === 'phone') {
    await performPhoneLogin()
    return
  }
  if (action === 'wechat') {
    // #ifdef H5
    await performH5WechatLogin()
    // #endif
  }
}

function confirmAgreementAndWechatLogin(event: PhoneNumberEvent) {
  agreed.value = true
  showAgreement.value = false
  pendingLoginAction.value = null
  void onWechatPhoneNumber(event)
}

async function onWechatPhoneNumber(event: PhoneNumberEvent) {
  if (!requireAgreement('wechat'))
    return

  const phoneCode = event.detail.code
  if (!phoneCode) {
    feedback.value = event.detail.errMsg?.includes('deny')
      ? '你已取消手机号授权。'
      : '未获取到微信手机号授权凭证，请重试。'
    return
  }
  if (loading.value)
    return

  const attemptId = tokenStore.beginLoginAttempt()
  activeLoginAttemptId = attemptId
  loading.value = true
  feedback.value = ''
  try {
    const authorization = await startWechatAuthorization()
    if (authorization.status !== 'binding_required')
      throw new Error(authorization.message)

    const token = await wechatMiniPhoneLogin({
      clientId: authClientId,
      authType: 'WECHAT_MINI_PHONE',
      wxLoginCode: authorization.code,
      phoneCode,
    })
    const committed = await tokenStore.completeExternalLogin(token, attemptId)
    if (!committed)
      return

    uni.removeStorageSync('shareIds')
    if (activeLoginAttemptId === attemptId)
      activeLoginAttemptId = null
    navigateAfterAuthenticated(redirectUrl.value)
  }
  catch (error) {
    feedback.value = error instanceof Error ? error.message : '微信登录失败，请稍后重试。'
  }
  finally {
    tokenStore.cancelLoginAttempt(attemptId)
    if (activeLoginAttemptId === attemptId)
      activeLoginAttemptId = null
    loading.value = false
  }
}

function skipLogin() {
  cancelPendingLogin()
  const pages = getCurrentPages()
  if (resolveAuthRedirect(redirectUrl.value) === '/pages/ai-chat/index' && pages.length > 1) {
    uni.navigateBack({
      fail: () => uni.reLaunch({ url: '/pages/index/index' }),
    })
    return
  }
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-white text-[#222]">
    <view class="login-hero relative overflow-hidden bg-[#dceeff]">
      <image
        class="absolute inset-0 h-full w-full"
        src="https://static1.3sbio.com/assets/lingcai/login-hero-bg.jpg"
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
            <image class="mr-10rpx h-34rpx w-34rpx" src="https://static1.3sbio.com/assets/lingcai/recruit-social.svg" mode="aspectFit" aria-hidden="true" />
            <text>社会招聘</text>
          </view>
          <view class="h-60rpx w-188rpx flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.8)]">
            <image class="mr-10rpx h-34rpx w-34rpx" src="https://static1.3sbio.com/assets/lingcai/recruit-campus.svg" mode="aspectFit" aria-hidden="true" />
            <text>校园招聘</text>
          </view>
        </view>
      </view>

      <image
        class="login-mascot absolute bottom-0 right-68rpx z-3"
        src="https://static1.3sbio.com/assets/lingcai/%E7%94%9F%E7%94%9F%E7%99%BD%E5%A4%A7%E8%A4%82-%E5%85%A8%E8%BA%AB.gif"
        mode="aspectFit"
        aria-label="生生智家卡通形象挥手欢迎"
      />
    </view>

    <view class="hero-form-transition h-36rpx" aria-hidden="true" />

    <view class="bg-white px-104rpx pb-[calc(188rpx+env(safe-area-inset-bottom))] pt-6rpx">
      <view>
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

        <!-- #ifdef H5 -->
        <view v-if="wechatH5LoginEnabled" class="mt-32rpx">
          <view class="flex items-center gap-18rpx" aria-hidden="true">
            <view class="h-1rpx flex-1 bg-[#e5e7eb]" />
            <text class="text-24rpx text-[#8a94a3]">其他登录方式</text>
            <view class="h-1rpx flex-1 bg-[#e5e7eb]" />
          </view>
          <button
            class="wechat-login-button mt-24rpx h-88rpx w-full flex items-center justify-center border-2rpx border-[#07a84f] rounded-44rpx border-solid bg-white p-0 text-31rpx text-[#079447] font-600 leading-88rpx"
            :disabled="loading"
            aria-label="使用微信一键登录"
            @tap="performH5WechatLogin"
          >
            <view class="i-carbon-logo-wechat mr-12rpx text-38rpx leading-none" aria-hidden="true" />
            <text>微信一键登录</text>
          </button>
        </view>
        <!-- #endif -->
      </view>

      <view
        class="mt-24rpx flex items-start text-23rpx text-[#666] leading-34rpx"
        role="checkbox"
        :aria-checked="agreed"
        aria-label="同意隐私政策"
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
          <view class="inline-flex flex-none whitespace-nowrap">
            <text>我已阅读并同意</text>
            <text class="tap-link text-[#087ff5]" role="link" @tap.stop="goTo(PRIVACY_PAGE)">《隐私政策》</text>
          </view>
          <text>，首次登录将自动创建会员账号</text>
        </view>
      </view>

      <text v-if="feedback" class="mt-10rpx block text-center text-24rpx text-[#6f7780]" role="status">{{ feedback }}</text>
    </view>

    <view class="login-footer fixed inset-x-0 bottom-0 z-10 bg-white px-104rpx pb-[calc(12rpx+env(safe-area-inset-bottom))] pt-8rpx">
      <!-- #ifdef MP-WEIXIN -->
      <!-- @vue-ignore 微信已支持 getRealtimePhoneNumber，当前 uni 组件类型声明尚未同步。 -->
      <button
        v-if="agreed"
        class="wechat-login-button box-border h-88rpx w-full flex items-center justify-center border-2rpx border-[#07a84f] rounded-44rpx border-solid bg-[#effcf4] px-28rpx text-30rpx text-[#078f45] font-700 leading-84rpx shadow-[0_8rpx_24rpx_rgba(7,168,79,0.16)]"
        :disabled="loading || wechatPhoneConfigLoading"
        :loading="loading"
        :open-type="wechatPhoneOpenType"
        aria-label="使用微信一键登录"
        @getphonenumber="onWechatPhoneNumber"
        @getrealtimephonenumber="onWechatPhoneNumber"
      >
        <view class="i-carbon-logo-wechat mr-12rpx text-38rpx leading-none" aria-hidden="true" />
        <text>微信一键登录</text>
      </button>
      <button
        v-else
        class="wechat-login-button box-border h-88rpx w-full flex items-center justify-center border-2rpx border-[#07a84f] rounded-44rpx border-solid bg-[#effcf4] px-28rpx text-30rpx text-[#078f45] font-700 leading-84rpx shadow-[0_8rpx_24rpx_rgba(7,168,79,0.16)]"
        :disabled="loading || wechatPhoneConfigLoading"
        aria-label="使用微信一键登录"
        @tap="requireAgreement('wechat')"
      >
        <view class="i-carbon-logo-wechat mr-12rpx text-38rpx leading-none" aria-hidden="true" />
        <text>微信一键登录</text>
      </button>
      <!-- #endif -->
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
      aria-label="隐私政策确认"
    >
      <view class="box-border max-w-620rpx w-full overflow-hidden rounded-32rpx bg-white shadow-[0_24rpx_80rpx_rgba(7,45,94,0.28)]" @tap.stop>
        <view class="px-40rpx pb-38rpx pt-36rpx">
          <text class="block text-center text-34rpx text-[#18365f] font-700">隐私政策确认</text>
          <view class="mt-24rpx flex flex-wrap text-28rpx text-[#5d6775] leading-46rpx">
            <text>请您认真阅读</text>
            <view class="inline-flex flex-none whitespace-nowrap">
              <text class="tap-link text-[#167cf3]" role="link" @tap="goTo(PRIVACY_PAGE)">《隐私政策》</text>
              <text>的全部条款</text>
            </view>
            <text>，接受后可开始使用我们的服务，首次登录将自动创建会员账号。</text>
          </view>
          <view class="mt-40rpx flex gap-22rpx">
            <button class="login-button h-84rpx flex-1 border-2rpx border-[#2d6fe6] rounded-44rpx border-solid bg-white p-0 text-31rpx text-[#2d6fe6] font-600 leading-80rpx" @tap="closeAgreement">
              不同意
            </button>
            <!-- #ifdef MP-WEIXIN -->
            <!-- @vue-ignore 微信已支持 getRealtimePhoneNumber，当前 uni 组件类型声明尚未同步。 -->
            <button
              v-if="pendingLoginAction === 'wechat'"
              class="login-button h-84rpx flex-1 rounded-44rpx border-none bg-[linear-gradient(90deg,#21a9ef_0%,#2d6fe6_100%)] p-0 text-31rpx text-white font-600 leading-84rpx"
              :disabled="loading || wechatPhoneConfigLoading"
              :open-type="wechatPhoneOpenType"
              @getphonenumber="confirmAgreementAndWechatLogin"
              @getrealtimephonenumber="confirmAgreementAndWechatLogin"
            >
              同意并登录
            </button>
            <button
              v-else
              class="login-button h-84rpx flex-1 rounded-44rpx border-none bg-[linear-gradient(90deg,#21a9ef_0%,#2d6fe6_100%)] p-0 text-31rpx text-white font-600 leading-84rpx"
              @tap="confirmAgreementAndLogin"
            >
              同意并登录
            </button>
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <button class="login-button h-84rpx flex-1 rounded-44rpx border-none bg-[linear-gradient(90deg,#21a9ef_0%,#2d6fe6_100%)] p-0 text-31rpx text-white font-600 leading-84rpx" @tap="confirmAgreementAndLogin">
              同意并登录
            </button>
            <!-- #endif -->
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
.wechat-login-button::after,
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
.login-button,
.wechat-login-button {
  transition: opacity var(--app-motion-duration-fast) var(--app-motion-easing-standard);
}

.tap-target:active,
.tap-link:active,
.code-button:active,
.login-button:active,
.wechat-login-button:active {
  opacity: 0.68;
}
</style>
