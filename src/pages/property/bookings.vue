<script setup lang="ts">
import type { Booking, Property } from '@/api/property'
import type { HttpError } from '@/http/types'
import {
  changeBookingStatus,
  createBooking,
  fetchBookings,
  fetchPropertyDetail,
} from '@/api/property'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({ style: { navigationBarTitleText: '看房预约', backgroundColor: '#F7F8FA' } })

const propertyId = ref('')
const property = ref<Property | null>(null)
const propertyLoading = ref(false)
const propertyError = ref('')
const coverLoaded = ref(false)
const coverError = ref(false)
const cover = computed(() => property.value?.images?.find(src => src?.trim()) || '')
const propertyLocation = computed(() => [
  property.value?.city,
  property.value?.district,
  property.value?.community,
  property.value?.address,
].filter(Boolean).join(' · '))
const role = ref<'guest' | 'owner'>('guest')
const items = ref<Booking[]>([])
const date = ref('')
const time = ref('')
const today = ref(localDate())
const contactName = ref('')
const contactPhone = ref('')
const remark = ref('')
const busy = ref(false)
const changingId = ref<Booking['id'] | null>(null)
const confirmingCancel = ref(false)
const loading = ref(false)
const error = ref('')
const submitError = ref('')
const loginRequired = ref(false)
const total = ref(0)
const page = ref(0)
const retryMore = ref(false)
let generation = 0
let propertyGeneration = 0
const labels: Record<number, string> = {
  1: '待确认',
  2: '已确认',
  3: '已拒绝',
  4: '已取消',
}
const statusClasses: Record<number, string> = {
  1: 'text-app-warning',
  2: 'text-app-success',
  3: 'text-app-danger',
  4: 'text-app-muted',
}

onLoad((query) => {
  propertyId.value = String(query?.propertyId || '')
  role.value = query?.role === 'owner' ? 'owner' : 'guest'
  if (propertyId.value) {
    uni.setNavigationBarTitle({ title: '预约看房' })
    void loadProperty()
  }
})
onShow(() => {
  today.value = localDate()
  if (!propertyId.value)
    void load()
})
onUnload(() => {
  generation++
  propertyGeneration++
})
onReachBottom(() => {
  if (!propertyId.value && !error.value && items.value.length < total.value)
    void load(true)
})

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function requireLogin() {
  loginRequired.value = !useTokenStore().updateNowTime().hasLogin
  if (!loginRequired.value)
    return true
  toLoginPage()
  return false
}
async function loadProperty() {
  const current = ++propertyGeneration
  propertyLoading.value = true
  propertyError.value = ''
  coverLoaded.value = false
  coverError.value = false
  try {
    const result = await fetchPropertyDetail(propertyId.value)
    if (current !== propertyGeneration)
      return
    property.value = result || null
    if (!result)
      propertyError.value = '房源不存在或已下架，请返回选择其他房源。'
  }
  catch (failure: unknown) {
    if (current !== propertyGeneration)
      return
    const detail = failure && typeof failure === 'object' ? failure as Partial<HttpError<unknown>> : undefined
    propertyError.value = detail?.message || '房源信息加载失败，请重试。'
  }
  finally {
    if (current === propertyGeneration)
      propertyLoading.value = false
  }
}
function retryCover() {
  if (!coverError.value)
    return
  coverLoaded.value = false
  coverError.value = false
}
function switchRole(next: 'guest' | 'owner') {
  if (next === role.value || busy.value || confirmingCancel.value)
    return
  role.value = next
  items.value = []
  page.value = 0
  total.value = 0
  void load()
}
async function load(more = false) {
  if (propertyId.value || (more && (loading.value || items.value.length >= total.value)))
    return
  if (!requireLogin())
    return
  const current = ++generation
  const currentRole = role.value
  loading.value = true
  error.value = ''
  retryMore.value = more
  try {
    const next = more ? page.value + 1 : 1
    const result = await fetchBookings(currentRole, next)
    if (current !== generation)
      return
    items.value = more ? [...items.value, ...result.list] : result.list
    page.value = next
    total.value = result.total
  }
  catch {
    if (current === generation)
      error.value = more ? '更多预约加载失败，已有记录已保留。' : '预约加载失败，请检查网络后重试。'
  }
  finally {
    if (current === generation)
      loading.value = false
  }
}
function retryLoad() {
  void load(retryMore.value)
}
async function submit() {
  if (busy.value || propertyLoading.value || propertyError.value || !property.value)
    return
  if (!requireLogin())
    return
  const bookingTime = `${date.value} ${time.value}:00`
  const timestamp = new Date(`${date.value}T${time.value}:00`).getTime()
  if (
    !date.value
    || !time.value
    || !contactName.value.trim()
    || !contactPhone.value.trim()
    || !Number.isFinite(timestamp)
    || timestamp <= Date.now()
  ) {
    uni.showToast({ title: '请填写未来看房时间和联系方式', icon: 'none' })
    return
  }
  busy.value = true
  submitError.value = ''
  try {
    await createBooking(propertyId.value, {
      bookingTime,
      contactName: contactName.value,
      contactPhone: contactPhone.value,
      remark: remark.value,
    })
    uni.showToast({ title: '预约已提交，待管家确认', icon: 'none' })
    uni.navigateBack({
      fail: () => uni.redirectTo({ url: '/pages/property/bookings' }),
    })
  }
  catch {
    submitError.value = '提交失败，填写的信息已保留，请重试。'
  }
  finally {
    busy.value = false
  }
}
async function change(item: Booking, status: number) {
  if (busy.value || !requireLogin())
    return
  busy.value = true
  changingId.value = item.id
  try {
    await changeBookingStatus(item.id, status)
    item.status = status
    await load()
  }
  catch {
    uni.showToast({ title: '状态更新失败，请重试', icon: 'none' })
  }
  finally {
    changingId.value = null
    busy.value = false
  }
}
function cancel(item: Booking) {
  if (busy.value || confirmingCancel.value || role.value !== 'guest' || ![1, 2].includes(item.status))
    return
  if (!requireLogin())
    return
  confirmingCancel.value = true
  uni.showModal({
    title: '取消看房预约？',
    content: '取消后如需看房，请重新提交预约。',
    confirmText: '取消预约',
    cancelText: '保留预约',
    success: (result) => {
      if (result.confirm && role.value === 'guest' && [1, 2].includes(item.status))
        void change(item, 4)
    },
    complete: () => {
      confirmingCancel.value = false
    },
  })
}
function formatTime(value: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : ''
}
function returnToProperty() {
  uni.navigateBack({
    fail: () => uni.redirectTo({ url: `/pages/property/detail?id=${encodeURIComponent(propertyId.value)}` }),
  })
}
</script>

<template>
  <view class="bookings-page app-page" :class="propertyId ? 'booking-form-page' : ''">
    <view class="app-content py-4">
      <template v-if="propertyId">
        <view v-if="propertyLoading" class="app-panel app-state gap-2 p-6">
          <view class="i-carbon-circle-dash h-6 w-6 animate-spin text-brand-blue" />
          <text class="text-sm text-app-muted">正在获取预约房源</text>
        </view>
        <view v-else-if="propertyError" class="app-panel app-state gap-3 p-5">
          <view class="i-carbon-warning-alt h-7 w-7 text-app-warning" />
          <text class="text-base text-app-ink font-semibold">暂时无法获取房源信息</text>
          <text class="text-center text-sm text-app-muted leading-6">{{ propertyError }}</text>
          <button class="app-secondary-button w-full" @tap="loadProperty">
            重新加载房源
          </button>
          <button class="app-tap min-h-11 px-4 text-sm text-brand-blue" @tap="returnToProperty">
            返回房源详情
          </button>
        </view>
        <view v-else-if="property" class="app-panel flex items-center gap-3 p-3">
          <view class="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-app-soft">
            <image
              v-if="cover && !coverError"
              :src="cover"
              mode="aspectFill"
              class="h-full w-full"
              @load="coverLoaded = true"
              @error="coverError = true"
            />
            <button
              v-if="!cover || !coverLoaded || coverError"
              class="app-tap absolute inset-0 h-full w-full flex flex-col items-center justify-center gap-2 bg-app-soft p-0 text-app-muted"
              :disabled="!coverError"
              aria-label="重新加载房源图片"
              @tap="retryCover"
            >
              <view class="i-carbon-image h-6 w-6" />
              <text class="text-10px">{{ coverError ? '图片失败 · 重试' : cover ? '图片加载中' : '暂无图片' }}</text>
            </button>
          </view>
          <view class="min-w-0 flex-1">
            <text v-if="property.title" class="block break-words text-base text-app-ink font-semibold leading-6">{{ property.title }}</text>
            <text v-if="propertyLocation" class="mt-1 block break-words text-xs text-app-muted leading-5">{{ propertyLocation }}</text>
            <view v-if="property.price != null" class="mt-2 flex items-baseline gap-1 text-brand-blue">
              <text class="text-22px font-bold">¥{{ property.price }}</text>
              <text v-if="property.priceType === 'rent'" class="text-xs">/月</text>
            </view>
          </view>
        </view>

        <view class="mt-6 flex items-center gap-2">
          <view class="i-carbon-calendar h-5 w-5 text-brand-blue" />
          <text class="app-section-title">看房时间</text>
        </view>
        <view class="mt-3 app-panel overflow-hidden">
          <picker mode="date" :value="date || today" :start="today" :disabled="busy" @change="date = String($event.detail.value)">
            <view class="app-tap min-h-14 flex items-center gap-3 border-0 border-b border-app-border border-solid px-4">
              <text class="shrink-0 text-sm text-app-ink">看房日期</text>
              <text class="min-w-0 flex-1 text-right text-sm" :class="date ? 'text-app-ink-soft' : 'text-app-muted'">{{ date || '请选择日期' }}</text>
              <view class="i-carbon-chevron-right h-4 w-4 shrink-0 text-app-muted" />
            </view>
          </picker>
          <picker mode="time" :value="time" :disabled="busy" @change="time = String($event.detail.value)">
            <view class="app-tap min-h-14 flex items-center gap-3 px-4">
              <text class="shrink-0 text-sm text-app-ink">看房时间</text>
              <text class="min-w-0 flex-1 text-right text-sm" :class="time ? 'text-app-ink-soft' : 'text-app-muted'">{{ time || '请选择时间' }}</text>
              <view class="i-carbon-chevron-right h-4 w-4 shrink-0 text-app-muted" />
            </view>
          </picker>
        </view>

        <view class="mt-6 flex items-center gap-2">
          <view class="i-carbon-user h-5 w-5 text-brand-blue" />
          <text class="app-section-title">联系方式</text>
        </view>
        <view class="mt-3 app-panel overflow-hidden">
          <view class="min-h-14 flex items-center gap-3 border-0 border-b border-app-border border-solid px-4">
            <text class="w-20 shrink-0 text-sm text-app-ink">联系人姓名</text>
            <input
              v-model="contactName"
              :maxlength="50"
              :disabled="busy"
              placeholder="请输入姓名"
              aria-label="联系人姓名"
              placeholder-class="text-app-muted"
              class="h-12 min-w-0 flex-1 text-sm text-app-ink-soft"
            >
          </view>
          <view class="min-h-14 flex items-center gap-3 px-4">
            <text class="w-20 shrink-0 text-sm text-app-ink">联系电话</text>
            <input
              v-model="contactPhone"
              type="text"
              :maxlength="20"
              :disabled="busy"
              placeholder="请输入联系电话"
              aria-label="联系电话"
              placeholder-class="text-app-muted"
              class="h-12 min-w-0 flex-1 text-sm text-app-ink-soft"
            >
          </view>
        </view>

        <view class="mt-6 flex items-baseline gap-2">
          <text class="app-section-title">备注</text>
          <text class="text-sm text-app-muted">（选填）</text>
        </view>
        <view class="mt-3 app-panel p-4">
          <textarea
            v-model="remark"
            :maxlength="500"
            :disabled="busy"
            placeholder="补充您的看房需求"
            aria-label="看房备注（选填）"
            placeholder-class="text-app-muted"
            class="box-border h-26 w-full text-sm text-app-ink-soft leading-6"
          />
          <text class="mt-2 block text-right text-xs text-app-muted">{{ remark.length }} / 500</text>
        </view>
        <view class="mt-4 flex items-start gap-2 text-app-muted">
          <view class="i-carbon-information h-4 w-4 shrink-0 text-brand-blue" />
          <text class="text-xs leading-5">提交后，请等待管家确认看房时间。</text>
        </view>
        <view v-if="submitError" class="mt-4 flex items-start gap-2 text-app-danger">
          <view class="i-carbon-warning-alt h-4 w-4 shrink-0" />
          <text class="text-sm leading-5">{{ submitError }}</text>
        </view>
        <view class="booking-submit-bar fixed inset-x-0 bottom-0 z-20 border-0 border-t border-app-border border-solid bg-white">
          <view class="booking-submit-inner app-content">
            <button
              class="app-primary-button w-full"
              :disabled="busy || propertyLoading || !!propertyError || !property"
              :loading="busy"
              @tap="submit"
            >
              {{ busy ? '正在提交' : '提交预约' }}
            </button>
          </view>
        </view>
      </template>

      <template v-else>
        <view class="mb-4 flex items-end justify-between gap-3">
          <text class="text-24px text-app-ink font-bold">看房预约</text>
          <text v-if="!loading && !error && !loginRequired" class="text-xs text-app-muted">共 {{ total }} 条</text>
        </view>
        <view class="grid grid-cols-2 app-panel gap-1 p-1">
          <button
            class="app-tap min-h-11 rounded-xl text-sm font-semibold"
            :class="role === 'guest' ? 'bg-app-soft text-brand-blue' : 'bg-white text-app-muted'"
            :disabled="busy || confirmingCancel"
            @tap="switchRole('guest')"
          >
            我预约的
          </button>
          <button
            class="app-tap min-h-11 rounded-xl text-sm font-semibold"
            :class="role === 'owner' ? 'bg-app-soft text-brand-blue' : 'bg-white text-app-muted'"
            :disabled="busy || confirmingCancel"
            @tap="switchRole('owner')"
          >
            收到的预约
          </button>
        </view>

        <template v-if="!loginRequired">
          <view v-for="item in items" :key="item.id" class="mt-3 app-panel p-4">
            <view class="flex items-start justify-between gap-3">
              <text class="min-w-0 flex-1 break-words text-base text-app-ink font-semibold leading-6">{{ item.propertyTitle || '房源已删除' }}</text>
              <text class="shrink-0 rounded-md bg-app-soft px-2 py-1 text-xs" :class="statusClasses[item.status] || 'text-app-muted'">{{ labels[item.status] || '状态未知' }}</text>
            </view>
            <view v-if="item.bookingTime" class="mt-4 flex items-center gap-2 text-app-ink-soft">
              <view class="i-carbon-calendar h-4 w-4 shrink-0 text-brand-blue" />
              <text class="break-words text-sm font-medium">{{ formatTime(item.bookingTime) }}</text>
            </view>
            <view v-if="item.contactName" class="mt-3 flex items-start gap-2 text-app-ink-soft">
              <view class="i-carbon-user h-4 w-4 shrink-0 text-app-muted" />
              <text class="break-words text-sm">{{ item.contactName }}</text>
            </view>
            <view v-if="item.contactPhone" class="mt-2 flex items-start gap-2 text-app-ink-soft">
              <view class="i-carbon-phone h-4 w-4 shrink-0 text-app-muted" />
              <text class="break-all text-sm">{{ item.contactPhone }}</text>
            </view>
            <view v-if="item.remark" class="mt-3 rounded-lg bg-app-soft p-3">
              <text class="block text-xs text-app-muted">备注</text>
              <text class="mt-1 block whitespace-pre-wrap break-words text-sm text-app-ink-soft leading-6">{{ item.remark }}</text>
            </view>
            <view v-if="role === 'owner' && item.status === 1" class="grid grid-cols-2 mt-4 gap-3 border-0 border-t border-app-border border-solid pt-4">
              <button class="app-secondary-button w-full" :disabled="busy" @tap="change(item, 3)">
                拒绝预约
              </button>
              <button class="app-primary-button w-full" :disabled="busy" :loading="changingId === item.id" @tap="change(item, 2)">
                确认预约
              </button>
            </view>
            <view v-if="role === 'guest' && [1, 2].includes(item.status)" class="mt-4 border-0 border-t border-app-border border-solid pt-4">
              <button class="app-secondary-button w-full" :disabled="busy || confirmingCancel" :loading="changingId === item.id" @tap="cancel(item)">
                取消预约
              </button>
            </view>
          </view>
        </template>

        <view v-if="loginRequired" class="min-h-70 app-state gap-3 py-12">
          <view class="i-carbon-locked h-9 w-9 text-app-muted" />
          <text class="text-base text-app-ink font-semibold">登录后查看预约</text>
          <text class="text-sm text-app-muted">预约与联系方式仅对登录用户开放</text>
          <button class="mt-2 app-primary-button max-w-60 w-full" @tap="load()">
            去登录
          </button>
        </view>
        <view v-else-if="loading" class="app-state gap-3 py-10">
          <view class="i-carbon-circle-dash h-7 w-7 animate-spin text-brand-blue" />
          <text class="text-sm text-app-muted">{{ items.length ? '正在加载预约记录' : '正在获取预约' }}</text>
        </view>
        <view v-else-if="error" class="app-state gap-3 py-10">
          <view class="i-carbon-warning-alt h-8 w-8 text-app-warning" />
          <text class="text-base text-app-ink font-semibold">预约加载失败</text>
          <text class="text-center text-sm text-app-muted leading-6">{{ error }}</text>
          <button class="mt-2 app-secondary-button max-w-60 w-full" @tap="retryLoad">
            重新加载
          </button>
        </view>
        <view v-else-if="!items.length" class="min-h-70 app-state gap-3 py-12">
          <view class="i-carbon-calendar h-10 w-10 text-app-muted" />
          <text class="text-base text-app-ink font-semibold">{{ role === 'guest' ? '还没有看房预约' : '暂未收到预约' }}</text>
          <text class="text-center text-sm text-app-muted leading-6">{{ role === 'guest' ? '在房源详情中选择预约看房，记录会显示在这里。' : '收到新的看房申请后，可在这里确认或拒绝。' }}</text>
          <button class="mt-2 app-secondary-button max-w-60 w-full" @tap="load()">
            刷新预约
          </button>
        </view>
        <view v-else class="app-state py-6">
          <button v-if="items.length < total" class="app-tap min-h-11 px-6 text-sm text-brand-blue" @tap="load(true)">
            加载更多
          </button>
          <text v-else class="text-xs text-app-muted">已显示全部预约</text>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped>
.bookings-page {
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
}

.booking-form-page {
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
}

.booking-submit-bar {
  padding-bottom: env(safe-area-inset-bottom);
}

.booking-submit-inner {
  box-sizing: border-box;
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: 12px 16px;
}
</style>
