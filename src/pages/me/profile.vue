<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { changeInfoProfile, changeProfilePhone, sendSmsCaptcha } from '@/api/login'
import AuthBehaviorCaptchaModal from '@/pages/auth/components/AuthBehaviorCaptchaModal.vue'
import { useUserStore } from '@/store'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '修改个人信息',
    backgroundColor: '#f5f7fa',
  },
})

const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

const username = ref(userInfo.value.nickname || '')
const phone = ref(String(userInfo.value.phone || ''))
const loading = ref(false)

const editingField = ref<'username' | 'phone' | null>(null)

// 用户名编辑
const editUsername = ref('')
const usernameFocus = ref(false)

// 手机号换绑
const newPhone = ref('')
const smsCode = ref('')
const phoneFocus = ref(false)
const codeFocus = ref(false)
const sending = ref(false)
const seconds = ref(0)
const phoneError = ref('')
const showCaptcha = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const canSendCode = computed(() => /^1\d{10}$/.test(newPhone.value) && seconds.value === 0 && !sending.value)
const canSubmitPhone = computed(() => /^1\d{10}$/.test(newPhone.value) && smsCode.value.trim().length > 0 && !loading.value)

onUnmounted(() => {
  if (timer)
    clearInterval(timer)
})

function handleBack() {
  if (getCurrentPages().length > 1)
    uni.navigateBack()
  else
    uni.switchTab({ url: '/pages/me/me' })
}

function openEdit(field: 'username' | 'phone') {
  editingField.value = field
  if (field === 'username') {
    editUsername.value = username.value
    usernameFocus.value = true
  }
  else {
    newPhone.value = ''
    smsCode.value = ''
    seconds.value = 0
    phoneFocus.value = true
  }
}

function closeEdit() {
  editingField.value = null
  usernameFocus.value = false
  phoneFocus.value = false
  codeFocus.value = false
  if (timer) {
    clearInterval(timer)
    timer = undefined
    seconds.value = 0
  }
}

async function handleSendCode() {
  if (!canSendCode.value)
    return
  if (newPhone.value.length !== 11) {
    phoneError.value = '请输入11位手机号'
    return
  }
  phoneError.value = ''
  showCaptcha.value = true
}

async function sendCodeAfterCaptcha(captchaVerification: string) {
  showCaptcha.value = false
  sending.value = true
  try {
    await sendSmsCaptcha(newPhone.value, { captchaType: 'blockPuzzle', captchaVerification })
    uni.showToast({ title: '验证码已发送', icon: 'success' })
    seconds.value = 60
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

async function saveEdit() {
  loading.value = true
  try {
    if (editingField.value === 'username') {
      if (!editUsername.value.trim()) {
        uni.showToast({ title: '昵称不能为空', icon: 'none' })
        return
      }
      await changeInfoProfile({ nickname: editUsername.value.trim() })
      username.value = editUsername.value.trim()
      userStore.setUserInfo({ ...userInfo.value, nickname: username.value })
      closeEdit()
      uni.showToast({ title: '修改成功', icon: 'success' })
    }
    else {
      await changeProfilePhone({ phone: newPhone.value, captcha: smsCode.value })
      phone.value = newPhone.value
      userStore.setUserInfo({ ...userInfo.value, phone: phone.value })
      closeEdit()
      uni.showToast({ title: '换绑成功', icon: 'success' })
    }
  }
  catch (error: any) {
    const msg = editingField.value === 'phone'
      ? (error?.data || error?.message || '换绑失败')
      : (error?.data || error?.message || '修改失败')
    uni.showToast({ title: msg, icon: 'none' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-[#f5f7fa]">
    <AppPageHeader title="修改个人信息" background="#ffffff" scrolled-background="#ffffff">
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

    <view class="px-3 pt-4">
      <view class="overflow-hidden rounded-2xl bg-white shadow-[0_4rpx_20rpx_rgba(42,92,178,0.06)]">
        <!-- 用户名 -->
        <view
          class="flex min-h-116rpx cursor-pointer items-center border-b-1rpx border-b-[#f0f4fa] border-b-solid px-4 active:bg-[#f7f9fd]"
          @tap="openEdit('username')"
        >
          <text class="w-160rpx flex-shrink-0 text-sm text-[#6b7a8d]">用户名</text>
          <text class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#1a2640] font-500">
            {{ username || '未设置' }}
          </text>
          <view class="i-carbon-chevron-right ml-2 flex-shrink-0 text-base text-[#bec7d4] leading-none" />
        </view>

        <!-- 手机号 -->
        <view
          class="flex min-h-116rpx cursor-pointer items-center px-4 active:bg-[#f7f9fd]"
          @tap="openEdit('phone')"
        >
          <text class="w-160rpx flex-shrink-0 text-sm text-[#6b7a8d]">手机号</text>
          <text class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#1a2640] font-500">
            {{ phone ? String(phone).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '未绑定' }}
          </text>
          <view class="i-carbon-chevron-right ml-2 flex-shrink-0 text-base text-[#bec7d4] leading-none" />
        </view>
      </view>
    </view>

    <!-- 修改用户名弹窗 -->
    <view
      v-if="editingField === 'username'"
      class="fixed inset-0 z-100 flex items-end justify-center bg-black/45"
      @tap="closeEdit"
    >
      <view class="w-full rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+20rpx)] pt-6" @tap.stop>
        <text class="block text-center text-base text-[#1a2640] font-700">修改用户名</text>
        <view class="mt-5 overflow-hidden rounded-xl bg-[#f5f7fa]">
          <input
            v-model="editUsername"
            class="h-96rpx w-full px-4 text-sm text-[#1a2640]"
            type="text"
            :maxlength="32"
            :focus="usernameFocus"
            placeholder="请输入用户名"
            placeholder-style="color:#c0c7d4"
            @blur="usernameFocus = false"
          />
        </view>
        <view class="mt-4 flex gap-3">
          <view
            class="min-h-88rpx flex flex-1 cursor-pointer items-center justify-center rounded-xl bg-[#f2f4f7] text-sm text-[#6b7a8d] font-600 active:opacity-70"
            @tap="closeEdit"
          >
            取消
          </view>
          <view
            class="min-h-88rpx flex flex-1 cursor-pointer items-center justify-center rounded-xl text-sm text-white font-600"
            :class="loading ? 'bg-[#92b4f5] cursor-not-allowed' : 'bg-brand-blue active:opacity-88'"
            @tap="saveEdit"
          >
            {{ loading ? '保存中...' : '保存' }}
          </view>
        </view>
      </view>
    </view>

    <!-- 修改手机号弹窗 -->
    <view
      v-if="editingField === 'phone'"
      class="fixed inset-0 z-100 flex items-end justify-center bg-black/45"
      @tap="closeEdit"
    >
      <view class="w-full rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+24rpx)] pt-6" @tap.stop>
        <!-- 标题 -->
        <text class="block text-center text-base text-[#1a2640] font-700">修改手机号</text>
        <text class="mt-1.5 block text-center text-xs text-[#9aa5b5]">
          当前绑定：{{ phone ? String(phone).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '未绑定' }}
        </text>

        <!-- 新手机号 -->
        <view class="mt-5">
          <text class="mb-2 block text-xs text-[#6b7a8d]">新手机号</text>
          <view class="overflow-hidden rounded-xl bg-[#f5f7fa]">
            <input
              v-model="newPhone"
              class="h-96rpx w-full px-4 text-sm text-[#1a2640]"
              type="number"
              :maxlength="11"
              :focus="phoneFocus"
              placeholder="请输入新手机号"
              placeholder-style="color:#c0c7d4"
              @blur="phoneFocus = false"
            />
          </view>
          <text v-if="phoneError" class="mt-1.5 block text-xs text-[#df555b]">{{ phoneError }}</text>
        </view>

        <!-- 验证码 -->
        <view class="mt-3">
          <text class="mb-2 block text-xs text-[#6b7a8d]">验证码</text>
          <view class="flex items-center gap-2.5">
            <view class="flex-1 overflow-hidden rounded-xl bg-[#f5f7fa]">
              <input
                v-model="smsCode"
                class="h-96rpx w-full px-4 text-sm text-[#1a2640]"
                type="number"
                :maxlength="6"
                :focus="codeFocus"
                placeholder="请输入验证码"
                placeholder-style="color:#c0c7d4"
                @blur="codeFocus = false"
              />
            </view>
            <view
              class="h-96rpx flex flex-shrink-0 items-center justify-center rounded-xl px-4 text-sm font-600"
              :class="canSendCode
                ? 'bg-brand-blue text-white cursor-pointer active:opacity-85'
                : 'bg-[#e8ecf4] text-[#b0bac8] cursor-not-allowed'"
              @tap="handleSendCode"
            >
              <text>{{ seconds > 0 ? `${seconds}s后重发` : sending ? '发送中' : '发送验证码' }}</text>
            </view>
          </view>
          <text v-if="seconds > 0" class="mt-1.5 block text-xs text-[#9aa5b5]">验证码60秒内有效</text>
        </view>

        <!-- 按钮 -->
        <view class="mt-5 flex gap-3">
          <view
            class="min-h-88rpx flex flex-1 cursor-pointer items-center justify-center rounded-xl bg-[#f2f4f7] text-sm text-[#6b7a8d] font-600 active:opacity-70"
            @tap="closeEdit"
          >
            取消
          </view>
          <view
            class="min-h-88rpx flex flex-1 cursor-pointer items-center justify-center rounded-xl text-sm text-white font-600"
            :class="canSubmitPhone
              ? 'bg-brand-blue active:opacity-88'
              : 'bg-[#c0c7d4] cursor-not-allowed'"
            @tap="saveEdit"
          >
            {{ loading ? '提交中...' : '确认换绑' }}
          </view>
        </view>
      </view>
    </view>
    <!-- 行为验证码弹窗 -->
    <AuthBehaviorCaptchaModal
      v-if="showCaptcha"
      @cancel="showCaptcha = false"
      @success="sendCodeAfterCaptcha"
    />
  </view>
</template>

<style scoped>
.plain-button::after {
  border: 0;
}
</style>
