<script setup lang="ts">
import type { Property } from '@/api/property'
import type { HttpError } from '@/http/types'
import {
  fetchPropertyDetail,
  PROPERTY_TYPE_LABEL,
  toggleFavorite,
} from '@/api/property'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationBarTitleText: '房源详情',
    backgroundColor: '#F7F8FA',
  },
})

const id = ref('')
const property = ref<Property | null>(null)
const loading = ref(true)
const loadError = ref('')
const missing = ref(false)
const favoriting = ref(false)
const chatting = ref(false)
const imageIndex = ref(0)
const loadedImages = ref<string[]>([])
const failedImages = ref<string[]>([])
const images = computed(() => (property.value?.images || []).filter(src => src?.trim()))
const highlights = computed(() => {
  const item = property.value
  if (!item)
    return []
  return [
    { label: '户型', value: item.layout },
    { label: '建筑面积', value: item.areaSqm == null ? null : `${item.areaSqm}㎡` },
    { label: '朝向', value: item.orientation },
  ].filter(field => field.value)
})
const metadata = computed(() => {
  const item = property.value
  if (!item)
    return []
  return [
    { label: '房源类型', value: PROPERTY_TYPE_LABEL[item.propertyType] },
    { label: '交易方式', value: item.priceType === 'rent' ? '出租' : item.priceType === 'sale' ? '出售' : null },
    { label: '租赁方式', value: item.rentalMode === 'whole' ? '整租' : item.rentalMode === 'shared' ? '合租' : null },
    { label: '楼层', value: item.floorInfo ? `${item.floorInfo}层` : null },
    { label: '装修', value: item.decoration },
    { label: '可入住日期', value: item.availableFrom ? String(item.availableFrom).slice(0, 10) : null },
  ].filter(field => field.value)
})
const locationSummary = computed(() => [
  property.value?.city,
  property.value?.district,
  property.value?.community,
].filter(Boolean).join(' · '))
const facilities = computed(() => (property.value?.facilities || []).filter(item => item?.trim()))
const facilityIcons: Record<string, string> = {
  空调: 'i-carbon-temperature',
  洗衣机: 'i-carbon-clean',
  冰箱: 'i-carbon-temperature-frigid',
  热水器: 'i-carbon-temperature-hot',
  WiFi: 'i-carbon-wifi',
  宽带: 'i-carbon-wifi',
  网络: 'i-carbon-wifi',
  电梯: 'i-carbon-building',
  停车位: 'i-carbon-car',
  床: 'i-carbon-asleep',
  衣柜: 'i-carbon-archive',
  沙发: 'i-carbon-inventory-management',
  阳台: 'i-carbon-sun',
}
let requestVersion = 0

onLoad((query) => {
  id.value = String(query?.id ?? '')
  void load()
})
onUnload(() => {
  requestVersion++
})

function shareTitle() {
  const item = property.value
  if (!item)
    return import.meta.env.VITE_APP_TITLE
  const price = item.price == null ? '' : ` ¥${item.price}${item.priceType === 'rent' ? '/月' : ''}`
  return `${item.title}${price}`
}
onShareAppMessage(() => ({
  title: shareTitle(),
  path: `/pages/property/detail?id=${encodeURIComponent(id.value)}`,
  imageUrl: images.value[0],
}))
onShareTimeline(() => ({
  title: shareTitle(),
  query: `id=${encodeURIComponent(id.value)}`,
  imageUrl: images.value[0],
}))

async function load() {
  const version = ++requestVersion
  loading.value = true
  loadError.value = ''
  missing.value = false
  property.value = null
  imageIndex.value = 0
  loadedImages.value = []
  failedImages.value = []
  if (!id.value) {
    loadError.value = '缺少房源信息，请返回房源列表重新选择。'
    loading.value = false
    return
  }
  try {
    const data = await fetchPropertyDetail(id.value)
    if (version !== requestVersion)
      return
    property.value = data || null
    missing.value = !data
  }
  catch (error: unknown) {
    if (version !== requestVersion)
      return
    const failure = error && typeof error === 'object' ? error as Partial<HttpError<unknown>> : undefined
    missing.value = failure?.statusCode === 404
      || (failure?.type === 'business' && ['房源不存在', '房源不存在或未上架'].includes(failure.message || ''))
    if (!missing.value)
      loadError.value = failure?.message || '网络或服务暂时不可用，请重试。'
  }
  finally {
    if (version === requestVersion)
      loading.value = false
  }
}

function imageLoaded(src: string) {
  if (!loadedImages.value.includes(src))
    loadedImages.value.push(src)
}
function imageFailed(src: string) {
  if (!failedImages.value.includes(src))
    failedImages.value.push(src)
}
function retryImage(src: string) {
  loadedImages.value = loadedImages.value.filter(item => item !== src)
  failedImages.value = failedImages.value.filter(item => item !== src)
}
function previewImage(src: string) {
  const urls = images.value.filter(item => !failedImages.value.includes(item))
  if (urls.includes(src))
    uni.previewImage({ urls, current: src })
}
function requireLogin() {
  if (useTokenStore().updateNowTime().hasLogin)
    return true
  toLoginPage()
  return false
}
async function favorite() {
  if (!requireLogin() || !property.value || favoriting.value)
    return
  const item = property.value
  favoriting.value = true
  try {
    item.isFavorited = (await toggleFavorite(item.id)).favorited
  }
  catch {
    uni.showToast({ title: '收藏操作失败，请重试', icon: 'none' })
  }
  finally {
    favoriting.value = false
  }
}
function book() {
  if (property.value && requireLogin())
    uni.navigateTo({ url: `/pages/property/bookings?propertyId=${encodeURIComponent(String(property.value.id))}` })
}
function callOwner() {
  const phone = property.value?.contactPhone?.trim()
  if (!phone) {
    uni.showToast({ title: property.value?.userId ? '房东未留电话,可发私信' : '暂未填写电话，可联系公寓管家', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: phone })
}
async function chatWithOwner() {
  if (chatting.value || !property.value || !requireLogin())
    return
  const item = property.value
  if (!item.userId) {
    uni.navigateTo({ url: '/pages/message/chat?mode=support' })
    return
  }
  chatting.value = true
  const version = requestVersion
  const accessToken = useTokenStore().validToken
  try {
    const user = await useUserStore().fetchUserInfo({ commit: false })
    if (version !== requestVersion || !requireLogin() || accessToken !== useTokenStore().validToken)
      return
    if (!user.userId || String(user.userId) === '-1') {
      uni.showToast({ title: '无法确认登录信息，请重新登录', icon: 'none' })
      return
    }
    if (String(user.userId) === String(item.userId)) {
      uni.showToast({ title: '这是您发布的房源，不能与自己私信', icon: 'none' })
      return
    }
    const name = encodeURIComponent(item.contactName || item.ownerNickname || '房东')
    uni.navigateTo({
      url: `/pages/message/chat?peerId=${encodeURIComponent(String(item.userId))}&peerName=${name}`,
    })
  }
  catch {
    uni.showToast({ title: '咨询暂不可用，请重试', icon: 'none' })
  }
  finally {
    chatting.value = false
  }
}
function returnToProperties() {
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="detail-page app-page">
    <view class="app-content">
      <view v-if="loading" class="min-h-90 app-state gap-3 py-16">
        <view class="i-carbon-circle-dash h-8 w-8 animate-spin text-brand-blue" />
        <text class="text-base text-app-ink font-semibold">正在加载房源</text>
        <text class="text-sm text-app-muted">请稍候，真实房源信息即将呈现</text>
      </view>
      <view v-else-if="loadError" class="min-h-90 app-state gap-3 py-16">
        <view class="i-carbon-warning-alt h-9 w-9 text-app-warning" />
        <text class="text-base text-app-ink font-semibold">房源加载失败</text>
        <text class="text-center text-sm text-app-muted leading-6">{{ loadError }}</text>
        <button class="mt-3 app-secondary-button max-w-60 w-full" @tap="load">
          重新加载
        </button>
        <button class="app-tap min-h-11 px-4 text-sm text-brand-blue" @tap="returnToProperties">
          返回房源列表
        </button>
      </view>
      <view v-else-if="missing" class="min-h-90 app-state gap-3 py-16">
        <view class="i-carbon-home h-9 w-9 text-app-muted" />
        <text class="text-base text-app-ink font-semibold">房源不存在或已下架</text>
        <text class="text-sm text-app-muted">可重新加载，或返回列表查看其他房源</text>
        <button class="mt-3 app-secondary-button max-w-60 w-full" @tap="load">
          重新加载
        </button>
        <button class="app-tap min-h-11 px-4 text-sm text-brand-blue" @tap="returnToProperties">
          返回房源列表
        </button>
      </view>
      <template v-else-if="property">
        <view class="detail-media relative bg-app-soft">
          <swiper
            v-if="images.length"
            class="h-full w-full"
            circular
            @change="imageIndex = $event.detail.current"
          >
            <swiper-item v-for="(src, index) in images" :key="`${index}-${src}`">
              <view class="relative h-full w-full">
                <image
                  v-if="!failedImages.includes(src)"
                  :src="src"
                  mode="aspectFill"
                  class="h-full w-full"
                  @tap="previewImage(src)"
                  @load="imageLoaded(src)"
                  @error="imageFailed(src)"
                />
                <view
                  v-if="!loadedImages.includes(src) || failedImages.includes(src)"
                  class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-app-soft text-app-muted"
                >
                  <view class="i-carbon-image h-10 w-10" />
                  <text class="text-sm">{{ failedImages.includes(src) ? '图片加载失败' : '图片加载中' }}</text>
                  <button
                    v-if="failedImages.includes(src)"
                    class="app-tap min-h-11 px-5 text-sm text-brand-blue"
                    @tap.stop="retryImage(src)"
                  >
                    重新加载图片
                  </button>
                </view>
              </view>
            </swiper-item>
          </swiper>
          <view v-else class="h-full flex flex-col items-center justify-center gap-3 text-app-muted">
            <view class="i-carbon-image h-10 w-10" />
            <text class="text-sm">暂无房源图片</text>
          </view>
          <view v-if="images.length" class="absolute bottom-4 right-4 rounded-full bg-black/55 px-3 py-1 text-xs text-white">
            {{ imageIndex + 1 }} / {{ images.length }}
          </view>
        </view>

        <view class="mt-4 app-panel p-4">
          <view class="flex flex-wrap items-center gap-2">
            <text v-if="property.title" class="min-w-0 flex-1 break-words text-22px text-app-ink font-bold leading-8">{{ property.title }}</text>
            <view v-if="property.ownerIsManager === true" class="flex shrink-0 items-center gap-1 rounded-md bg-app-soft px-2 py-1 text-xs text-brand-blue">
              <view class="i-carbon-security h-4 w-4" />
              <text>认证管家</text>
            </view>
          </view>
          <view v-if="property.price != null" class="mt-2 flex items-baseline gap-1 text-brand-blue">
            <text class="text-28px font-bold">¥{{ property.price }}</text>
            <text v-if="property.priceType === 'rent'" class="text-sm">/月</text>
          </view>
          <view v-if="highlights.length" class="grid grid-cols-3 mt-4 gap-3 border-0 border-t border-app-border border-solid pt-4 text-center">
            <view v-for="field in highlights" :key="field.label" class="min-w-0">
              <text class="block break-words text-base text-app-ink font-semibold">{{ field.value }}</text>
              <text class="mt-1 block text-xs text-app-muted">{{ field.label }}</text>
            </view>
          </view>
        </view>

        <view v-if="metadata.length" class="mt-3 app-panel p-4">
          <text class="app-section-title">房源信息</text>
          <view class="grid grid-cols-2 mt-4 gap-x-4 gap-y-4">
            <view v-for="field in metadata" :key="field.label" class="min-w-0">
              <text class="block text-xs text-app-muted">{{ field.label }}</text>
              <text class="mt-1 block break-words text-sm text-app-ink-soft">{{ field.value }}</text>
            </view>
          </view>
        </view>

        <view v-if="locationSummary || property.address" class="mt-3 app-panel p-4">
          <view class="flex items-center gap-2">
            <view class="i-carbon-location h-5 w-5 text-app-ink" />
            <text class="app-section-title">位置</text>
          </view>
          <text v-if="locationSummary" class="mt-3 block break-words text-sm text-app-ink-soft leading-6">{{ locationSummary }}</text>
          <text v-if="property.address" class="mt-1 block break-words text-sm text-app-muted leading-6">{{ property.address }}</text>
        </view>

        <view v-if="facilities.length" class="mt-3 app-panel p-4">
          <view class="flex items-center gap-2">
            <view class="i-carbon-cube h-5 w-5 text-app-ink" />
            <text class="app-section-title">配套设施</text>
          </view>
          <view class="grid grid-cols-4 mt-4 gap-2">
            <view v-for="(facility, index) in facilities" :key="`${index}-${facility}`" class="min-w-0 flex flex-col items-center gap-2 rounded-lg bg-app-soft px-1 py-3">
              <view :class="facilityIcons[facility] || 'i-carbon-checkmark-outline'" class="h-6 w-6 text-app-ink" />
              <text class="break-words text-center text-xs text-app-ink-soft leading-5">{{ facility }}</text>
            </view>
          </view>
        </view>

        <view v-if="property.description" class="mt-3 app-panel p-4">
          <view class="flex items-center gap-2">
            <view class="i-carbon-document h-5 w-5 text-app-ink" />
            <text class="app-section-title">房源介绍</text>
          </view>
          <text class="mt-3 block whitespace-pre-wrap break-words text-sm text-app-ink-soft leading-7">{{ property.description }}</text>
        </view>

        <view class="mt-3 app-panel p-4">
          <view class="flex items-center gap-2">
            <view class="i-carbon-user h-5 w-5 text-app-ink" />
            <text class="app-section-title">{{ property.userId ? '联系房东' : '联系管家' }}</text>
          </view>
          <text v-if="property.contactName || property.ownerNickname" class="mt-3 block break-words text-sm text-app-ink-soft">{{ property.contactName || property.ownerNickname }}</text>
          <text v-if="property.contactPhone?.trim()" class="mt-2 block break-all text-sm text-app-ink-soft">{{ property.contactPhone }}</text>
          <text v-else class="mt-3 block text-sm text-app-muted leading-6">{{ property.userId ? '房东未留电话,可发私信' : '暂未填写电话，可联系公寓管家' }}</text>
        </view>

        <view class="detail-action-bar fixed inset-x-0 bottom-0 z-20 border-0 border-t border-app-border border-solid bg-white">
          <view class="detail-actions app-content">
            <button
              class="app-tap flex flex-col items-center justify-center gap-1 text-app-ink-soft"
              :class="property.isFavorited ? 'text-brand-blue' : ''"
              :disabled="favoriting"
              :aria-label="property.isFavorited ? '取消收藏' : '收藏房源'"
              @tap="favorite"
            >
              <view class="i-carbon-star h-6 w-6" />
              <text class="text-10px">{{ property.isFavorited ? '已收藏' : '收藏' }}</text>
            </button>
            <button class="app-tap flex flex-col items-center justify-center gap-1 text-app-ink-soft" aria-label="拨打联系电话" @tap="callOwner">
              <view class="i-carbon-phone h-6 w-6" />
              <text class="text-10px">电话</text>
            </button>
            <button class="app-secondary-button" :disabled="chatting" :loading="chatting" @tap="chatWithOwner">
              {{ property.userId ? '咨询房东' : '咨询管家' }}
            </button>
            <button class="app-primary-button" @tap="book">
              预约看房
            </button>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped>
.detail-page {
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
}

.detail-media {
  height: 280px;
  margin: 0 -16px;
  overflow: hidden;
}

.detail-action-bar {
  padding-bottom: env(safe-area-inset-bottom);
}

.detail-actions {
  display: grid;
  grid-template-columns: 44px 44px minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 8px;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: 12px 16px;
}

.detail-actions > button {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 48px;
  height: 48px;
  padding-right: 0;
  padding-left: 0;
  font-size: 14px;
  white-space: nowrap;
}
</style>
