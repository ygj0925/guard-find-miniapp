<script setup lang="ts">
import CryptoJS from 'crypto-js'
import { onMounted, ref } from 'vue'
import { checkBehaviorCaptcha, getBehaviorCaptcha } from '@/api/login'
import type { BehaviorCaptcha } from '@/api/types/login'

const emit = defineEmits<{
  cancel: []
  success: [captchaVerification: string]
}>()

const captcha = ref<BehaviorCaptcha>()
const loading = ref(false)
const error = ref('')
const sliderLeft = ref(0)
const dragging = ref(false)
const dragStartX = ref(0)
const dragStartLeft = ref(0)

// 弹层为 620rpx，左右各 32rpx 内边距，实际验证码画布与滑道宽度为 556rpx。
const CAPTCHA_WIDTH_RPX = 556
const SLIDER_SIZE_RPX = 80
// 后端拼图原始尺寸为 47×155，对应底图 310×155；画布横向缩放后为 84rpx 宽。
const JIGSAW_WIDTH_RPX = 84
const REFERENCE_WIDTH = 310

function toDataUrl(image: string) {
  return image.startsWith('data:image/') ? image : `data:image/png;base64,${image}`
}

function getTouchX(event: { touches?: Array<{ clientX: number }>, changedTouches?: Array<{ clientX: number }> }) {
  return event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX ?? 0
}

function getRpxPerPixel() {
  return 750 / uni.getSystemInfoSync().windowWidth
}

async function loadCaptcha() {
  loading.value = true
  error.value = ''
  sliderLeft.value = 0
  try {
    captcha.value = await getBehaviorCaptcha()
  }
  catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : '行为验证码加载失败，请重试。'
  }
  finally {
    loading.value = false
  }
}

function startDrag(event: { touches?: Array<{ clientX: number }> }) {
  if (!captcha.value || loading.value) {
    return
  }
  dragging.value = true
  dragStartX.value = getTouchX(event)
  dragStartLeft.value = sliderLeft.value
}

function moveDrag(event: { touches?: Array<{ clientX: number }> }) {
  if (!dragging.value) {
    return
  }
  const offset = (getTouchX(event) - dragStartX.value) * getRpxPerPixel()
  sliderLeft.value = Math.min(Math.max(dragStartLeft.value + offset, 0), CAPTCHA_WIDTH_RPX - JIGSAW_WIDTH_RPX)
}

async function finishDrag() {
  if (!dragging.value || !captcha.value) {
    return
  }
  dragging.value = false
  const point = JSON.stringify({
    x: Math.round(sliderLeft.value * REFERENCE_WIDTH / CAPTCHA_WIDTH_RPX),
    // 后端虽从 y=0 裁切整高拼图块，但其校验算法固定要求 y=5。
    y: 5,
  })
  const pointJson = captcha.value.secretKey
    ? CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(point), CryptoJS.enc.Utf8.parse(captcha.value.secretKey), {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      }).toString()
    : point

  loading.value = true
  error.value = ''
  try {
    const result = await checkBehaviorCaptcha({ captchaType: 'blockPuzzle', pointJson, token: captcha.value.token })
    if (result.repCode !== '0000') {
      throw new Error(result.repMsg || '验证未通过，请重试。')
    }
    // 后端在行为验证码成功后，以 AES(token---明文坐标) 作为二次验证缓存键；
    // /captcha/sms 的 captchaVerification 必须使用该二次凭证。
    const captchaVerification = captcha.value.secretKey
      ? CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(`${captcha.value.token}---${point}`), CryptoJS.enc.Utf8.parse(captcha.value.secretKey), {
          mode: CryptoJS.mode.ECB,
          padding: CryptoJS.pad.Pkcs7,
        }).toString()
      : `${captcha.value.token}---${point}`
    emit('success', captchaVerification)
  }
  catch (requestError) {
    const message = requestError instanceof Error ? requestError.message : '验证未通过，请重试。'
    await loadCaptcha()
    error.value = message
  }
  finally {
    loading.value = false
  }
}

onMounted(loadCaptcha)
</script>

<template>
  <view class="fixed inset-0 z-99 flex items-center justify-center bg-[rgba(35,50,82,0.5)] p-6" @tap.self="emit('cancel')">
    <view class="box-border w-620rpx rounded-28rpx bg-white px-4 pb-4 pt-5 shadow-[0_28rpx_70rpx_rgba(31,51,95,0.22)]" role="dialog" aria-label="滑动验证">
      <text class="block text-center text-base text-app-ink font-700">安全验证</text>
      <text class="mt-1.5 block text-center text-2xs text-#9aa5b8">拖动滑块完成验证后发送短信验证码</text>
      <view v-if="captcha" class="relative mt-4 h-310rpx overflow-hidden rounded-16rpx bg-#eef2f8">
        <image class="h-full w-full" :src="toDataUrl(captcha.originalImageBase64)" mode="scaleToFill" />
        <image class="pointer-events-none absolute top-0 h-310rpx w-84rpx" :style="{ left: `${sliderLeft}rpx` }" :src="toDataUrl(captcha.jigsawImageBase64)" mode="scaleToFill" />
        <view v-if="loading" class="absolute inset-0 flex items-center justify-center bg-black/30 text-xs text-white">
          验证中...
        </view>
      </view>
      <view v-else class="mt-4 h-310rpx flex items-center justify-center rounded-16rpx bg-#eef2f8 text-xs text-#7f8aa0">
        {{ loading ? '加载中...' : '验证码加载失败' }}
      </view>
      <view class="relative mt-4 h-80rpx overflow-hidden rounded-14rpx bg-#edf2f8" @touchstart.stop="startDrag" @touchmove.stop="moveDrag" @touchend.stop="finishDrag" @touchcancel.stop="finishDrag">
        <view class="h-full rounded-14rpx bg-#dceafe" :style="{ width: `${sliderLeft + SLIDER_SIZE_RPX}rpx` }" />
        <view class="pointer-events-none absolute top-0 h-80rpx w-80rpx flex items-center justify-center rounded-14rpx bg-white text-#467bff shadow" :style="{ left: `${sliderLeft}rpx` }">
          <text class="text-lg">›</text>
        </view>
        <text class="pointer-events-none absolute inset-0 flex items-center justify-center text-2xs text-#7f8aa0">向右滑动完成验证</text>
      </view>
      <text v-if="error" class="mt-2 block text-center text-2xs text-#e95d63">{{ error }}</text>
      <view class="mt-4 flex items-center justify-between">
        <text class="min-h-56rpx text-xs text-#467bff" role="button" @tap="loadCaptcha">刷新验证</text>
        <text class="min-h-56rpx text-xs text-#7f8aa0" role="button" @tap="emit('cancel')">取消</text>
      </view>
    </view>
  </view>
</template>
