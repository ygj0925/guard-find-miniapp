<script setup lang="ts">
import { computed, ref } from 'vue'
import { getPositionDetail, type PositionDetail as PositionDetailResponse } from '@/api/position'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { usePositionStore } from '@/store/position'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

defineOptions({
  name: 'PositionDetail',
})

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '职位详情',
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F5F7FA',
    backgroundColorTop: '#FFFFFF',
    backgroundColorBottom: '#FFFFFF',
  },
})

const POSITION_LIST_PATH = '/pages/position/index'
const DETAIL_PATH = '/pages/position/detail'
interface PositionDetailView {
  id: string
  title: string
  company: string
  companyIndustry: string
  companyStage: string
  companySize: string
  companyLogo: string
  salary: string
  location: string
  address: string
  longitude: number
  latitude: number
  education: string
  experience: string
  tags: string[]
  recruiter: { name: string, role: string, avatar: string, activeText: string }
  responsibilities: string[]
  requirements: string[]
}

const EMPTY_POSITION: PositionDetailView = {
  id: '', title: '', company: '', companyIndustry: '', companyStage: '', companySize: '', companyLogo: '/static/logo.svg', salary: '', location: '', address: '', longitude: 0, latitude: 0, education: '', experience: '', tags: [], recruiter: { name: '招聘团队', role: '', avatar: '/static/images/default-avatar.png', activeText: '' }, responsibilities: [], requirements: [],
}
const positionStore = usePositionStore()
const tokenStore = useTokenStore()
const position = ref<PositionDetailView>(EMPTY_POSITION)
const isLoading = ref(true)
const isApplying = ref(false)
let applyingTimer: ReturnType<typeof setTimeout> | undefined

const isFavorite = computed(() => positionStore.isFavorite(position.value.id))
const isApplied = computed(() => positionStore.isApplied(position.value.id))
const sharePath = computed(() => `${DETAIL_PATH}?id=${encodeURIComponent(position.value.id)}`)
const shareTitle = computed(() => `${position.value.title}｜${position.value.company}正在招聘`)
const hasLocation = computed(() => position.value.longitude !== 0 && position.value.latitude !== 0)

function normalizeTextList(value?: string[] | string) {
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/(?:\\r?\\n|\r?\n)/) : []
  return entries
    .map(item => item.trim().replace(/^\d+[.、]\s*/, ''))
    .filter(Boolean)
}

function toPositionDetail(source: PositionDetailResponse): PositionDetailView {
  return {
    id: source.positionId,
    title: source.positionName,
    company: source.company || '招聘企业',
    companyIndustry: source.companyIndustry || '',
    companyStage: source.companyStage || '',
    companySize: source.companySize || '',
    companyLogo: source.companyLogo || '/static/logo.svg',
    salary: source.salaryMin != null && source.salaryMax != null ? `${Math.round(source.salaryMin / 1000)}K-${Math.round(source.salaryMax / 1000)}K` : source.salaryUnit || '面议',
    location: source.location,
    address: source.address || source.location || '',
    longitude: Number(source.longitude || 0),
    latitude: Number(source.latitude || 0),
    education: source.edu,
    experience: source.experience,
    tags: source.tags || [],
    recruiter: source.recruiter || { name: '招聘团队', role: '', avatar: '/static/images/default-avatar.png', activeText: '' },
    responsibilities: normalizeTextList(source.responsibilities),
    requirements: normalizeTextList(source.requirements),
  }
}

onLoad(async (options) => {
  if (!options?.id) {
    isLoading.value = false
    return
  }
  try {
    position.value = toPositionDetail(await getPositionDetail(options.id))
  }
  catch {
    uni.showToast({ title: '职位加载失败，请稍后重试', icon: 'none' })
  }
  finally {
    isLoading.value = false
  }
})

onUnload(() => {
  if (applyingTimer)
    clearTimeout(applyingTimer)
})

onShareAppMessage(() => ({
  title: shareTitle.value,
  path: sharePath.value,
}))

onShareTimeline(() => ({
  title: shareTitle.value,
  query: `id=${encodeURIComponent(position.value.id)}`,
}))

function handleBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: POSITION_LIST_PATH })
}

function handleFavorite() {
  const active = positionStore.toggleFavorite(position.value.id)
  uni.showToast({
    title: active ? '已收藏职位' : '已取消收藏',
    icon: 'none',
  })
}

async function handleShare() {
  // #ifdef H5
  const webNavigator = navigator as Navigator & {
    share?: (data: { title: string, text: string, url: string }) => Promise<void>
  }
  if (webNavigator.share) {
    try {
      await webNavigator.share({
        title: shareTitle.value,
        text: `${position.value.salary} · ${position.value.location}`,
        url: window.location.href,
      })
      return
    }
    catch {
      return
    }
  }
  // #endif

  uni.setClipboardData({
    data: `${shareTitle.value} ${sharePath.value}`,
    success: () => uni.showToast({ title: '职位链接已复制', icon: 'none' }),
  })
}

function handleApply() {
  if (isApplied.value) {
    uni.showToast({ title: '该职位已投递', icon: 'none' })
    return
  }

  if (!tokenStore.updateNowTime().hasLogin) {
    toLoginPage({
      queryString: `?redirect=${encodeURIComponent(sharePath.value)}`,
    })
    return
  }

  if (isApplying.value)
    return

  isApplying.value = true
  applyingTimer = setTimeout(() => {
    positionStore.markApplied(position.value.id)
    isApplying.value = false
    uni.showToast({ title: '简历投递成功', icon: 'success' })
  }, 650)
}

function openCompanyLocation() {
  if (!hasLocation.value) {
    uni.showToast({ title: '暂未提供工作地点坐标', icon: 'none' })
    return
  }
  uni.openLocation({
    latitude: position.value.latitude,
    longitude: position.value.longitude,
    name: position.value.company,
    address: position.value.address,
    scale: 16,
  })
}
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-[#f5f7fa] text-app-ink font-[Noto_Sans_SC,Microsoft_YaHei,sans-serif]">
    <AppPageHeader title="职位详情" background="#ffffff" scrolled-background="#ffffff">
      <template #left>
        <button
          class="plain-button h-12 w-12 flex cursor-pointer items-center justify-center border-0 rounded-full bg-transparent p-0 text-xl text-[#17233d] leading-none active:bg-[#eef4ff]"
          aria-label="返回职位列表"
          @tap="handleBack"
        >
          <view class="i-carbon-chevron-left" />
        </button>
      </template>
    </AppPageHeader>

    <view v-if="isLoading" class="pb-36">
      <view class="bg-white px-4 pb-5 pt-4">
        <view class="skeleton-block h-10 w-3/5 rounded-xl" />
        <view class="mt-3 flex gap-2">
          <view class="skeleton-block h-6 w-24 rounded-lg" />
          <view class="skeleton-block h-6 w-20 rounded-lg" />
          <view class="skeleton-block h-6 w-20 rounded-lg" />
        </view>
        <view class="mt-5 h-px bg-[#edf0f4]" />
        <view class="mt-4 flex items-center gap-3">
          <view class="skeleton-block h-14 w-14 flex-none rounded-full" />
          <view class="min-w-0 flex-1">
            <view class="skeleton-block h-6 w-1/3 rounded-lg" />
            <view class="skeleton-block mt-2 h-5 w-1/2 rounded-lg" />
          </view>
        </view>
      </view>
      <view class="mt-2 bg-white px-4 py-5">
        <view class="skeleton-block h-7 w-28 rounded-lg" />
        <view class="mt-4 flex flex-col gap-3">
          <view v-for="index in 7" :key="index" class="skeleton-block h-5 rounded-lg" :class="index === 7 ? 'w-3/4' : 'w-full'" />
        </view>
      </view>
      <view class="mt-2 bg-white px-4 py-5">
        <view class="skeleton-block h-16 w-3/4 rounded-xl" />
        <view class="skeleton-block mt-4 h-52 w-full rounded-2xl" />
      </view>
    </view>

    <template v-else>
      <view class="bg-white px-4 pb-5 pt-4">
        <view class="flex items-start justify-between gap-3">
          <text class="min-w-0 flex-1 text-2xl text-[#202938] font-700 leading-[1.3]">{{ position.title }}</text>
          <text class="flex-none pt-1 text-xl text-brand-blue font-700 leading-none">{{ position.salary }}</text>
        </view>
        <view class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#4b5565]">
          <view class="flex items-center gap-1.5">
            <view class="i-carbon-location text-base text-[#667085] leading-none" />
            <text>{{ position.location }}</text>
          </view>
          <view class="flex items-center gap-1.5">
            <view class="i-carbon-portfolio text-base text-[#667085] leading-none" />
            <text>{{ position.experience }}</text>
          </view>
          <view class="flex items-center gap-1.5">
            <view class="i-carbon-education text-base text-[#667085] leading-none" />
            <text>{{ position.education }}</text>
          </view>
        </view>

        <view class="mt-4 h-px bg-[#edf0f4]" />

        <view class="mt-4 flex cursor-pointer items-center active:opacity-75" role="button" aria-label="查看招聘者信息">
          <image class="h-14 w-14 flex-none rounded-full bg-[#eef4ff]" :src="position.recruiter.avatar" mode="aspectFill" />
          <view class="ml-3 min-w-0 flex-1">
            <text class="block text-base text-[#252d3d] font-700">{{ position.recruiter.name }}</text>
            <text class="mt-1 block text-sm text-[#596579]">{{ position.company }} · {{ position.recruiter.role }}</text>
            <text class="mt-0.5 block text-xs text-[#a0a8b5]">{{ position.recruiter.activeText }}</text>
          </view>
          <view class="i-carbon-chevron-right text-lg text-[#a8b1bf] leading-none" />
        </view>
      </view>

      <view class="mt-2 bg-white px-4 py-5">
        <text class="block text-xl text-[#202938] font-700">职位详情</text>
        <view class="mt-3 flex flex-wrap gap-2">
          <text v-for="tag in position.tags" :key="tag" class="rounded-lg bg-[#f2f6fb] px-2.5 py-1.5 text-xs text-[#5f6b7d]">{{ tag }}</text>
        </view>

        <view class="mt-4 flex flex-col gap-2.5 text-base text-[#5b6472] leading-[1.8]">
          <text v-for="(item, index) in position.responsibilities" :key="item" class="block">
            {{ index + 1 }}. {{ item }}
          </text>
        </view>

        <text class="mt-5 block text-lg text-[#202938] font-700">任职要求</text>
        <view class="mt-3 flex flex-col gap-2.5 text-base text-[#5b6472] leading-[1.8]">
          <text v-for="(item, index) in position.requirements" :key="item" class="block">
            {{ index + 1 }}. {{ item }}
          </text>
        </view>
      </view>

      <view class="mt-2 bg-white px-4 py-5">
        <view class="flex cursor-pointer items-center active:opacity-75" role="button" aria-label="查看公司地址" @tap="openCompanyLocation">
          <view class="h-16 w-16 flex flex-none items-center justify-center overflow-hidden rounded-2xl bg-[#edf5ff]">
            <image class="h-12 w-12" :src="position.companyLogo" mode="aspectFit" />
          </view>
          <view class="ml-3 min-w-0 flex-1">
            <text class="block overflow-hidden text-ellipsis whitespace-nowrap text-lg text-[#202938] font-700">{{ position.company }}</text>
            <text class="mt-1 block text-sm text-[#667085]">{{ position.companyIndustry }} · {{ position.companyStage }} · {{ position.companySize }}</text>
          </view>
          <view class="i-carbon-chevron-right text-lg text-[#a8b1bf] leading-none" />
        </view>

        <view v-if="hasLocation" class="relative mt-4 h-64 overflow-hidden rounded-2xl bg-[#e9f2fb]" role="button" aria-label="在地图中查看公司地址" @tap="openCompanyLocation">
          <map class="h-full w-full" :latitude="position.latitude" :longitude="position.longitude" :scale="15" :enable-scroll="false" :enable-zoom="false" />
          <view class="pointer-events-none absolute inset-x-4 top-4 flex justify-center">
            <view class="max-w-full flex items-center rounded-xl bg-white/96 px-3 py-2 text-sm text-[#263249] shadow-[0_8rpx_24rpx_rgba(41,78,132,0.15)]">
              <view class="i-carbon-location-filled mr-1.5 flex-none text-base text-brand-blue leading-none" />
              <text class="overflow-hidden text-ellipsis whitespace-nowrap">{{ position.address }}</text>
            </view>
          </view>
          <view class="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 flex items-center justify-center rounded-full bg-brand-blue text-xl text-white shadow-[0_8rpx_20rpx_rgba(45,111,230,0.28)] -translate-x-1/2 -translate-y-full">
            <view class="i-carbon-location-filled" />
          </view>
        </view>
        <view v-else class="mt-4 rounded-2xl bg-[#f2f4f7] px-4 py-5 text-center text-sm text-[#98a2b3]">暂未提供工作地点坐标</view>
      </view>

      <view class="h-36" />
    </template>

    <view class="fixed inset-x-0 bottom-0 z-100 border-t border-[#e9edf3] bg-white/98 px-3 pt-2 shadow-[0_-8rpx_28rpx_rgba(31,52,89,0.08)] pb-safe">
      <view class="flex items-center gap-2">
        <!-- #ifdef MP-WEIXIN -->
        <button class="plain-button h-14 w-14 flex flex-none flex-col items-center justify-center border-0 bg-transparent p-0 text-xs text-[#586579] leading-none active:opacity-65" open-type="share" aria-label="分享职位">
          <view class="i-carbon-share mb-1 text-xl text-[#202938] leading-none" />
          <text>分享</text>
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <button class="plain-button h-14 w-14 flex flex-none flex-col items-center justify-center border-0 bg-transparent p-0 text-xs text-[#586579] leading-none active:opacity-65" aria-label="分享职位" @tap="handleShare">
          <view class="i-carbon-share mb-1 text-xl text-[#202938] leading-none" />
          <text>分享</text>
        </button>
        <!-- #endif -->

        <button
          class="plain-button h-14 w-14 flex flex-none flex-col items-center justify-center border-0 bg-transparent p-0 text-xs leading-none active:opacity-65"
          :class="isFavorite ? 'text-brand-blue' : 'text-[#586579]'"
          :aria-label="isFavorite ? '取消收藏职位' : '收藏职位'"
          @tap="handleFavorite"
        >
          <view class="mb-1 text-xl leading-none" :class="isFavorite ? 'i-carbon-star-filled text-brand-blue' : 'i-carbon-star text-[#202938]'" />
          <text>{{ isFavorite ? '已收藏' : '收藏' }}</text>
        </button>

        <button
          class="plain-button ml-1 h-14 min-w-0 flex flex-1 items-center justify-center border-0 rounded-xl bg-brand-blue px-4 text-base text-white font-700 shadow-[0_10rpx_24rpx_rgba(45,111,230,0.22)] transition-[opacity,background-color] duration-180 ease-out disabled:cursor-not-allowed disabled:bg-[#8fb4ef] active:opacity-86 motion-reduce:transition-none"
          :disabled="isApplying || isApplied"
          :aria-label="isApplied ? '简历已投递' : '一键投递简历'"
          @tap="handleApply"
        >
          <view v-if="isApplying" class="apply-spinner mr-2 h-5 w-5 border-2 border-white/35 border-t-white rounded-full" />
          <text>{{ isApplying ? '正在投递' : isApplied ? '已投递' : '一键投递简历' }}</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.plain-button::after {
  border: 0;
}

.skeleton-block {
  background: linear-gradient(90deg, #edf1f6 25%, #f7f9fc 42%, #edf1f6 64%);
  background-size: 300% 100%;
  animation: skeleton-shimmer 1.3s ease-in-out infinite;
}

.apply-spinner {
  animation: apply-spin 0.8s linear infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: 0 0;
  }
}

@keyframes apply-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-block,
  .apply-spinner {
    animation: none;
  }
}
</style>
