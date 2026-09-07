<script setup lang="ts">
import CryptoJS from 'crypto-js'
import { computed, onMounted, ref } from 'vue'
import { checkBehaviorCaptcha, getBehaviorCaptcha } from '@/api/login'
import type { BehaviorCaptcha } from '@/api/types/login'

interface CaptchaImageSize {
  width: number
  height: number
}

interface CaptchaImageLoadEvent {
  detail: CaptchaImageSize
}

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
const originalImageSize = ref<CaptchaImageSize>()
const jigsawImageSize = ref<CaptchaImageSize>()
const imageLoadFailed = ref(false)

// 弹层为 620rpx，左右各 32rpx 内边距，实际验证码画布与滑道宽度为 556rpx。
const CAPTCHA_WIDTH_RPX = 556
const SLIDER_SIZE_RPX = 80

const imageSizesLoaded = computed(() => Boolean(originalImageSize.value && jigsawImageSize.value))
const imageSizesValid = computed(() => {
  const original = originalImageSize.value
  const jigsaw = jigsawImageSize.value
  // AJ-Captcha 在高度差为 0 或 1px 时生成的 y 都固定为 5；更大差异会产生随机 y。
  return Boolean(
    original
    && jigsaw
    && original.width > 0
    && original.height > 0
    && jigsaw.width > 0
    && jigsaw.height > 0
    && jigsaw.width < original.width
    && original.height >= jigsaw.height
    && original.height - jigsaw.height <= 1,
  )
})
const jigsawWidthRpx = computed(() => {
  const original = originalImageSize.value
  const jigsaw = jigsawImageSize.value
  return original && jigsaw && original.width > 0
    ? CAPTCHA_WIDTH_RPX * jigsaw.width / original.width
    : 0
})
const maxSliderLeftRpx = computed(() => Math.max(CAPTCHA_WIDTH_RPX - jigsawWidthRpx.value, 0))
const imageSizeError = computed(() => imageSizesLoaded.value && !imageSizesValid.value
  ? '验证码图片尺寸不匹配，请刷新重试。'
  : '')

function toDataUrl(image: string) {
  return image.startsWith('data:image/') ? image : `data:image/png;base64,${image}`
}

function readImageSize(event: CaptchaImageLoadEvent) {
  const width = Number(event.detail.width)
  const height = Number(event.detail.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    imageLoadFailed.value = true
    error.value = '验证码图片尺寸异常，请刷新重试。'
    return undefined
  }
  return { width, height }
}

function handleOriginalImageLoad(event: CaptchaImageLoadEvent) {
  originalImageSize.value = readImageSize(event)
}

function handleJigsawImageLoad(event: CaptchaImageLoadEvent) {
  jigsawImageSize.value = readImageSize(event)
}

function handleImageError() {
  imageLoadFailed.value = true
  error.value = '验证码图片加载失败，请刷新重试。'
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
  dragging.value = false
  captcha.value = undefined
  originalImageSize.value = undefined
  jigsawImageSize.value = undefined
  imageLoadFailed.value = false
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
  if (!captcha.value || loading.value || !imageSizesValid.value) {
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
  sliderLeft.value = Math.min(Math.max(dragStartLeft.value + offset, 0), maxSliderLeftRpx.value)
}

async function finishDrag() {
  if (!dragging.value) {
    return
  }
  dragging.value = false
  const currentCaptcha = captcha.value
  const originalSize = originalImageSize.value
  if (!currentCaptcha || !imageSizesValid.value || !originalSize) {
    error.value = imageSizeError.value || '验证码图片尚未准备完成，请稍后重试。'
    return
  }
  const point = JSON.stringify({
    x: Math.round(sliderLeft.value * originalSize.width / CAPTCHA_WIDTH_RPX),
    // AJ-Captcha 1.4.0 在底图与模板高度差不超过 1px 时，纵坐标固定为 5。
    y: 5,
  })
  const pointJson = currentCaptcha.secretKey
    ? CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(point), CryptoJS.enc.Utf8.parse(currentCaptcha.secretKey), {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      }).toString()
    : point

  loading.value = true
  error.value = ''
  try {
    const result = await checkBehaviorCaptcha({ captchaType: 'blockPuzzle', pointJson, token: currentCaptcha.token })
    if (result.repCode !== '0000') {
      throw new Error(result.repMsg || '验证未通过，请重试。')
    }
    // 后端在行为验证码成功后，以 AES(token---明文坐标) 作为二次验证缓存键；
    // /captcha/sms 的 captchaVerification 必须使用该二次凭证。
    const captchaVerification = currentCaptcha.secretKey
      ? CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(`${currentCaptcha.token}---${point}`), CryptoJS.enc.Utf8.parse(currentCaptcha.secretKey), {
          mode: CryptoJS.mode.ECB,
          padding: CryptoJS.pad.Pkcs7,
        }).toString()
      : `${currentCaptcha.token}---${point}`
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
  <view class="fixed inset-0 z-200 flex items-center justify-center bg-[rgba(35,50,82,0.5)] p-6" @tap.self="emit('cancel')">
    <view class="box-border w-620rpx rounded-28rpx bg-white px-4 pb-4 pt-5 shadow-[0_28rpx_70rpx_rgba(31,51,95,0.22)]" role="dialog" aria-label="滑动验证" @tap.stop>
      <text class="block text-center text-base text-app-ink font-700">安全验证</text>
      <text class="mt-1.5 block text-center text-2xs text-#9aa5b8">拖动滑块完成验证后发送短信验证码</text>
      <view v-if="captcha" class="relative mt-4 h-310rpx overflow-hidden rounded-16rpx bg-#eef2f8">
        <image
          class="h-full w-full"
          :src="toDataUrl(captcha.originalImageBase64)"
          mode="scaleToFill"
          @load="handleOriginalImageLoad"
          @error="handleImageError"
        />
        <image
          class="pointer-events-none absolute top-0 h-310rpx"
          :style="{
            left: `${sliderLeft}rpx`,
            width: `${jigsawWidthRpx || CAPTCHA_WIDTH_RPX}rpx`,
            opacity: imageSizesValid ? 1 : 0,
          }"
          :src="toDataUrl(captcha.jigsawImageBase64)"
          mode="scaleToFill"
          @load="handleJigsawImageLoad"
          @error="handleImageError"
        />
        <view v-if="loading || imageLoadFailed || !imageSizesValid" class="absolute inset-0 flex items-center justify-center bg-black/30 text-xs text-white">
          {{ loading ? '验证中...' : imageLoadFailed ? '图片加载失败' : imageSizeError ? '图片尺寸异常' : '验证码图片加载中...' }}
        </view>
      </view>
      <view v-else class="mt-4 h-310rpx flex items-center justify-center rounded-16rpx bg-#eef2f8 text-xs text-#7f8aa0">
        {{ loading ? '加载中...' : '验证码加载失败' }}
      </view>
      <view
        class="relative mt-4 h-80rpx overflow-hidden rounded-14rpx bg-#edf2f8"
        :class="{ 'opacity-60': loading || !imageSizesValid }"
        @touchstart.stop="startDrag"
        @touchmove.stop="moveDrag"
        @touchend.stop="finishDrag"
        @touchcancel.stop="finishDrag"
      >
        <view class="h-full rounded-14rpx bg-#dceafe" :style="{ width: `${sliderLeft + SLIDER_SIZE_RPX}rpx` }" />
        <view class="pointer-events-none absolute top-0 h-80rpx w-80rpx flex items-center justify-center rounded-14rpx bg-white text-#467bff shadow" :style="{ left: `${sliderLeft}rpx` }">
          <text class="text-lg">›</text>
        </view>
        <text class="pointer-events-none absolute inset-0 flex items-center justify-center text-2xs text-#7f8aa0">
          {{ imageSizesValid ? '向右滑动完成验证' : '验证码准备中...' }}
        </text>
      </view>
      <text v-if="error || imageSizeError" class="mt-2 block text-center text-2xs text-#e95d63">{{ error || imageSizeError }}</text>
      <view class="mt-4 flex items-center justify-between">
        <text class="min-h-56rpx text-xs text-#467bff" role="button" @tap="loadCaptcha">刷新验证</text>
        <text class="min-h-56rpx text-xs text-#7f8aa0" role="button" @tap="emit('cancel')">取消</text>
      </view>
    </view>
  </view>
</template>
