<script setup lang="ts">
import type { IUserInfoRes } from '@/api/types/login'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import EmployeeCertificationForm from '@/components/EmployeeCertificationForm.vue'

withDefaults(defineProps<{
  initialEmail?: string
}>(), {
  initialEmail: '',
})

const emit = defineEmits<{
  close: []
  skip: []
  certified: [userInfo: IUserInfoRes]
}>()

const busy = ref(false)
const dialogRef = ref<HTMLElement | null>(null)
// #ifdef H5
let previouslyFocusedElement: HTMLElement | null = null
// #endif

function getDialogElement() {
  const value = dialogRef.value as (HTMLElement & { $el?: HTMLElement }) | null
  return value?.$el || value
}

onMounted(() => {
  // #ifdef H5
  previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
  nextTick(() => {
    const dialog = getDialogElement()
    const firstInput = dialog?.querySelector<HTMLElement>('input:not([disabled])')
    ;(firstInput || dialog)?.focus()
  })
  // #endif
})

onUnmounted(() => {
  // #ifdef H5
  const elementToRestore = previouslyFocusedElement
  window.setTimeout(() => {
    if (elementToRestore?.isConnected)
      elementToRestore.focus()
  }, 0)
  // #endif
})

function requestClose() {
  if (busy.value) {
    uni.showToast({ title: '正在处理认证，请稍候', icon: 'none' })
    return
  }
  emit('close')
}

function skipCertification() {
  if (busy.value)
    return
  emit('skip')
}

function handleDialogKeydown(event: KeyboardEvent) {
  // #ifdef H5
  if (event.key === 'Escape') {
    event.preventDefault()
    requestClose()
    return
  }
  if (event.key !== 'Tab')
    return

  const dialog = getDialogElement()
  const focusableElements = dialog
    ? Array.from(dialog.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    : []
  if (!focusableElements.length) {
    event.preventDefault()
    dialog?.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
  }
  else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
  // #endif
}
</script>

<template>
  <view
    ref="dialogRef"
    class="fixed inset-0 z-200 flex items-end justify-center bg-[rgba(9,24,52,0.56)] px-3 backdrop-blur-4rpx pt-safe"
    role="dialog"
    aria-modal="true"
    aria-label="员工内推认证"
    tabindex="-1"
    @keydown="handleDialogKeydown"
    @tap="requestClose"
    @touchmove.stop.prevent
  >
    <view
      class="box-border max-h-[88vh] max-w-720rpx w-full overflow-y-auto rounded-t-40rpx bg-white shadow-[0_-18rpx_64rpx_rgba(20,50,104,0.2)] pb-safe"
      @tap.stop
      @touchmove.stop
    >
      <view class="relative overflow-hidden rounded-t-40rpx bg-[linear-gradient(130deg,#e9f2ff_0%,#f0f7ff_52%,#e9fbf5_100%)] px-5 pb-4 pt-4.5">
        <view class="pointer-events-none absolute h-180rpx w-180rpx rounded-full bg-white/52 -right-48rpx -top-72rpx" />
        <view class="relative z-1 flex items-start">
          <view class="h-80rpx w-80rpx center flex-none rounded-24rpx shadow-[0_10rpx_24rpx_rgba(45,111,230,0.22)] bg-brand-hero">
            <view class="i-carbon-share-knowledge text-2xl text-white leading-none" aria-hidden="true" />
          </view>
          <view class="ml-3 min-w-0 flex-1 pt-0.5">
            <view class="flex flex-wrap items-center gap-2">
              <text class="text-xl text-app-ink font-800 leading-tight">员工内推</text>
              <text class="rounded-full bg-[#daf6eb] px-2 py-0.5 text-3xs text-[#108761] font-700">员工专属</text>
            </view>
            <text class="mt-1.5 block text-xs text-app-ink-soft leading-[1.55]">完成员工认证后，内推身份将同步到账号；暂时不方便认证，也可以先浏览在招岗位。</text>
          </view>
          <button
            class="close-button ml-2 h-64rpx w-64rpx center flex-none border-0 rounded-full bg-white/72 p-0 text-lg text-app-muted active:bg-white"
            aria-label="关闭员工认证弹窗"
            @tap="requestClose"
          >
            <view class="i-carbon-close leading-none" aria-hidden="true" />
          </button>
        </view>
      </view>

      <view class="px-5 pb-5 pt-4.5">
        <EmployeeCertificationForm
          :initial-email="initialEmail"
          submit-label="认证并查看职位"
          @busy-change="busy = $event"
          @success="emit('certified', $event)"
        />

        <button
          class="skip-button mt-3 h-84rpx w-full flex items-center justify-center border-0 rounded-42rpx bg-[#f3f6fa] p-0 text-sm text-app-ink-soft font-600"
          :class="busy ? 'opacity-48' : 'active:bg-[#e9eef5]'"
          :disabled="busy"
          aria-label="暂不认证，直接查看职位"
          @tap="skipCertification"
        >
          <text>暂不认证，直接看职位</text>
          <view class="i-carbon-arrow-right ml-1.5 text-sm leading-none" aria-hidden="true" />
        </button>

        <text class="mt-3 block text-center text-3xs text-app-muted leading-[1.5]">员工认证仅用于核验内部身份，不影响你浏览和投递公开职位。</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.close-button::after,
.skip-button::after {
  border: 0;
}
</style>
