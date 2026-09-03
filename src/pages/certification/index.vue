<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { innerEmployeeSend, innerEmployeeVerify } from '@/api/login'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { useUserStore } from '@/store'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '员工认证',
    backgroundColor: '#ffffff',
  },
})

const email = ref('')
const code = ref('')
const emailError = ref('')
const codeError = ref('')
const loading = ref(false)
const sending = ref(false)
const seconds = ref(0)
const sendTip = ref('验证码已发送至您的企业邮箱，请注意查收。')
let timer: ReturnType<typeof setInterval> | undefined

const canSend = computed(() => email.value.trim() !== '' && seconds.value === 0 && !sending.value)
const canSubmit = computed(() => email.value.trim() !== '' && code.value.trim() !== '' && !loading.value)

onUnmounted(() => {
  if (timer)
    clearInterval(timer)
})

function validateEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function handleBack() {
  if (getCurrentPages().length > 1)
    uni.navigateBack()
  else
    uni.switchTab({ url: '/pages/me/me' })
}

async function handleSendCode() {
  if (!canSend.value)
    return
  emailError.value = ''
  if (!validateEmail(email.value.trim())) {
    emailError.value = '请输入有效的邮箱地址'
    return
  }

  sending.value = true
  try {
    const result = await innerEmployeeSend(email.value.trim())
    if (result)
      sendTip.value = `验证码已发送至您的企业邮箱，请注意查收。${result}`
    uni.showToast({ title: '验证码已发送', icon: 'success' })
    seconds.value = 300
    timer = setInterval(() => {
      seconds.value -= 1
      if (seconds.value <= 0) {
        clearInterval(timer)
        timer = undefined
      }
    }, 1000)
  }
  catch (error: any) {
    uni.showToast({ title: error?.message || '发送失败', icon: 'none' })
  }
  finally {
    sending.value = false
  }
}

async function handleSubmit() {
  if (!canSubmit.value)
    return
  emailError.value = ''
  codeError.value = ''
  if (!validateEmail(email.value.trim())) {
    emailError.value = '请输入有效的邮箱地址'
    return
  }

  loading.value = true
  try {
    await innerEmployeeVerify({ email: email.value.trim(), captcha: code.value.trim() })
    await useUserStore().fetchUserInfo()
    uni.showToast({ title: '认证成功', icon: 'success' })
    setTimeout(() => handleBack(), 1500)
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '认证失败，请重试', icon: 'none' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-white">
    <AppPageHeader title="员工认证" background="#ffffff" scrolled-background="#ffffff">
      <template #left>
        <button
          class="plain-button h-12 w-12 flex cursor-pointer items-center justify-center border-0 rounded-full bg-transparent p-0 text-xl text-[#17233d] leading-none active:bg-[#eef4ff]"
          aria-label="返回"
          @tap="handleBack"
        >
          <view class="i-carbon-chevron-left" />
        </button>
      </template>
    </AppPageHeader>

    <view class="px-5 pt-6">
      <!-- 邮箱 -->
      <view class="mb-5">
        <view class="mb-2 flex items-center gap-0.5">
          <text class="text-[#e74c3c] font-600">*</text>
          <text class="text-sm text-[#1a2640] font-600">邮箱</text>
        </view>
        <view class="overflow-hidden border-b-2rpx border-b-solid" :class="emailError ? 'border-[#e74c3c]' : 'border-[#e0e5ef]'">
          <input
            v-model="email"
            class="h-96rpx w-full text-sm text-[#1a2640] leading-none"
            type="text"
            placeholder="请输入企业邮箱"
            placeholder-style="color:#c0c7d4"
            :disabled="loading"
            @input="emailError = ''"
          >
        </view>
        <text v-if="emailError" class="mt-1.5 block text-xs text-[#e74c3c]">{{ emailError }}</text>
      </view>

      <!-- 验证码 -->
      <view class="mb-2">
        <view class="mb-2 flex items-center gap-0.5">
          <text class="text-[#e74c3c] font-600">*</text>
          <text class="text-sm text-[#1a2640] font-600">验证码</text>
        </view>
        <view class="flex items-center gap-3 border-b-2rpx border-b-solid" :class="codeError ? 'border-[#e74c3c]' : 'border-[#e0e5ef]'">
          <input
            v-model="code"
            class="h-96rpx min-w-0 flex-1 text-sm text-[#1a2640] leading-none"
            type="number"
            :maxlength="6"
            placeholder="请输入验证码"
            placeholder-style="color:#c0c7d4"
            :disabled="loading"
            @input="codeError = ''"
          >
          <view
            class="flex-shrink-0 rounded-lg px-3.5 py-2 text-sm text-white font-600"
            :class="canSend
              ? 'bg-[#e84040] cursor-pointer active:opacity-85'
              : 'bg-[#c0c7d4] cursor-not-allowed'"
            @tap="handleSendCode"
          >
            <text>{{ seconds > 0 ? `${seconds}s后重发` : sending ? '发送中...' : '发送验证码' }}</text>
          </view>
        </view>
        <text v-if="codeError" class="mt-1.5 block text-xs text-[#e74c3c]">{{ codeError }}</text>
      </view>

      <text class="block text-xs text-[#9aa5b5] leading-[1.6]">{{ sendTip }}</text>

      <!-- 提交按钮 -->
      <view
        class="mt-10 min-h-96rpx flex items-center justify-center rounded-xl text-base text-white font-700"
        :class="canSubmit
          ? 'bg-[#1a56db] cursor-pointer active:opacity-88'
          : 'bg-[#c0c7d4] cursor-not-allowed'"
        @tap="handleSubmit"
      >
        <text>{{ loading ? '提交中...' : '提交' }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.plain-button::after {
  border: 0;
}
</style>
