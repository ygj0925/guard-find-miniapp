<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type { MiniappBanner } from '@/api/banner'
import { getMiniappBanners } from '@/api/banner'
import type { PositionListItem } from '@/api/position'
import { getHotPositions } from '@/api/position'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { useUserStore } from '@/store'
import { usePositionStore } from '@/store/position'
import { useTokenStore } from '@/store/token'
import { normalizeTrustedBannerUrl } from '@/utils/bannerTarget'
import { clearInternalReferralIntent, consumeInternalReferralIntent, saveInternalReferralIntent } from '@/utils/internalReferralIntent'
import { formatPositionSalary } from '@/utils/positionSalary'
import { createMiniProgramShare, createMiniProgramTimelineShare } from '@/utils/miniProgramShare'
import { navigateToLoginPage } from '@/utils/toLoginPage'
import InternalReferralModal from './components/InternalReferralModal.vue'

defineOptions({
  name: 'Home',
})

definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '首页',
    backgroundColor: '#EDF6FF',
    enableShareAppMessage: true,
    enableShareTimeline: true,
  },
})

onShareAppMessage(() => createMiniProgramShare('生生智家', '/pages/index/index'))
onShareTimeline(() => createMiniProgramTimelineShare('生生智家'))

interface SwiperChangeEvent {
  detail: { current: number }
}

interface HomeBanner {
  id: string
  imageUrl?: string
  hoverText?: string
  targetUrl?: string
  tag: string
  title: string
  description: string
  background: string
}

interface QuickEntry {
  title: string
  iconUrl: string
  pagePath?: string
  action?: 'internalReferral'
  /** 跳转职位页时携带的招聘分类编码（1=社会招聘，2=校园招聘），用于自动选中并过滤。 */
  category?: string
}

const TAB_PAGES = [
  'pages/index/index',
  'pages/position/index',
  'pages/ai-chat/index',
  'pages/notification/index',
  'pages/me/me',
]

const fallbackBanners: HomeBanner[] = [
  {
    id: 'fallback-global-recruitment',
    tag: '2026 全球招聘',
    title: '加入三生 · 共创新生',
    description: '构建你与三生的每一次相遇',
    background: 'linear-gradient(122deg, #1b62e0 0%, #2f7ff2 52%, #46a4f8 100%)',
  },
  {
    id: 'fallback-growth',
    tag: '专业成长',
    title: '遇见更好的职业机会',
    description: '与优秀的人一起，成就专业价值',
    background: 'linear-gradient(122deg, #4a5ce8 0%, #6f63ef 52%, #9576f0 100%)',
  },
  {
    id: 'fallback-campus',
    tag: '校招启航',
    title: '应届生启航计划',
    description: '导师带练 · 双通道晋升 · 全球视野',
    background: 'linear-gradient(122deg, #0f9bb5 0%, #16b1a8 54%, #38ca9c 100%)',
  },
]

const quickEntryPages: QuickEntry[][] = [
  [
    { title: '社会招聘', iconUrl: 'https://static1.3sbio.com/assets/lingcai/shehui_V1.png', pagePath: 'pages/position/index', category: '1' },
    { title: '校园招聘', iconUrl: 'https://static1.3sbio.com/assets/lingcai/xiaoyuan_V1.png', pagePath: 'pages/position/index', category: '2' },
    { title: '求职工作台', iconUrl: 'https://static1.3sbio.com/assets/lingcai/qiuzhi_V1.png', pagePath: 'pages/me/me' },
    { title: '消息通知', iconUrl: 'https://static1.3sbio.com/assets/lingcai/xiaoxi_V1.png', pagePath: 'pages/notification/index' },
    { title: '简历完善', iconUrl: 'https://static1.3sbio.com/assets/lingcai/jianli_V1.png', pagePath: 'pages/me/me' },
    { title: '生生AI', iconUrl: 'https://static1.3sbio.com/assets/lingcai/AI_V1.png', pagePath: 'pages/ai-chat/index' },
    { title: '内部推荐', iconUrl: 'https://static1.3sbio.com/assets/lingcai/neitui_V1.png', action: 'internalReferral' },
  ],
]

const visibleQuickEntryPages = computed(() => quickEntryPages)

const HOT_POSITION_LIMIT = 10
const remoteBanners = ref<MiniappBanner[]>([])
const bannersLoading = ref(false)
const bannersFailed = ref(false)
const bannerImageErrors = reactive<Record<string, boolean>>({})
const hotPositions = ref<PositionListItem[]>([])
const hotPositionsLoading = ref(false)
const hotPositionsFailed = ref(false)
const publisherAvatarErrors = reactive<Record<string, boolean>>({})
const headerScrolled = ref(false)
const bannerIndex = ref(0)
const entryPageIndex = ref(0)
const showInternalReferralModal = ref(false)
const internalReferralOpening = ref(false)

const positionStore = usePositionStore()
const tokenStore = useTokenStore()
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)
const internalReferralEmail = computed(() => {
  const email = userInfo.value?.email
  return typeof email === 'string' ? email.trim() : ''
})

const banners = computed<HomeBanner[]>(() => {
  const normalizedBanners = remoteBanners.value
    .filter(banner => Boolean(banner.imageUrl?.trim()))
    .map((banner, index) => ({
      id: `remote-${banner.id}-${index}`,
      imageUrl: banner.imageUrl?.trim(),
      hoverText: banner.hoverText?.trim(),
      targetUrl: banner.targetUrl?.trim(),
      tag: '三生招聘',
      title: banner.hoverText?.trim() || '发现更多职业机会',
      description: '探索三生制药最新招聘动态',
      background: fallbackBanners[index % fallbackBanners.length].background,
    }))

  return normalizedBanners.length ? normalizedBanners : fallbackBanners
})

function openPage(pagePath: string) {
  const normalizedPath = pagePath.replace(/^\/+/, '')
  const routePath = normalizedPath.split(/[?#]/)[0]
  const url = `/${normalizedPath}`
  if (TAB_PAGES.includes(routePath)) {
    uni.switchTab({ url: `/${routePath}` })
    return
  }
  uni.navigateTo({ url })
}

function openBanner(banner: HomeBanner) {
  const targetUrl = banner.targetUrl?.trim()
  if (!targetUrl)
    return

  const miniappPath = targetUrl.replace(/^\/+/, '')
  if (/^pages\//i.test(miniappPath)) {
    openPage(miniappPath)
    return
  }

  const trustedUrl = normalizeTrustedBannerUrl(targetUrl)
  if (trustedUrl) {
    uni.navigateTo({
      url: `/pages/common/webview?url=${encodeURIComponent(trustedUrl)}`,
    })
    return
  }

  uni.showToast({
    icon: 'none',
    title: '仅支持三生制药官方活动链接',
  })
}

function showInternalReferralError(title: string) {
  uni.showToast({ title, icon: 'none' })
}

function openPositionList() {
  positionStore.setPendingCategory('')
  uni.showLoading({ title: '正在打开职位', mask: true })

  return new Promise<boolean>((resolve) => {
    uni.switchTab({
      url: '/pages/position/index',
      success: () => {
        uni.hideLoading()
        resolve(true)
      },
      fail: () => {
        uni.hideLoading()
        showInternalReferralError('职位页面打开失败，请重试')
        resolve(false)
      },
    })
  })
}

async function openAuthenticatedInternalReferral() {
  try {
    if (userInfo.value?.isInternalEmployee === true) {
      if (await openPositionList())
        clearInternalReferralIntent()
      return
    }

    showInternalReferralModal.value = true
    clearInternalReferralIntent()
  }
  catch {
    showInternalReferralError('暂时无法打开内部推荐，请重试')
  }
}

async function handleInternalReferralEntry() {
  if (internalReferralOpening.value)
    return

  internalReferralOpening.value = true
  try {
    if (!tokenStore.updateNowTime().hasLogin) {
      const intentSaved = saveInternalReferralIntent()
      const navigation = await navigateToLoginPage({
        queryString: `?redirect=${encodeURIComponent('/pages/index/index')}`,
      })

      if (navigation.status === 'failed') {
        showInternalReferralError('登录页打开失败，请重试')
        return
      }
      if (!intentSaved)
        showInternalReferralError('登录后请再次点击内部推荐')
      return
    }

    await openAuthenticatedInternalReferral()
  }
  catch {
    showInternalReferralError('暂时无法打开内部推荐，请重试')
  }
  finally {
    internalReferralOpening.value = false
  }
}

function closeInternalReferralModal() {
  showInternalReferralModal.value = false
  clearInternalReferralIntent()
}

async function continueToPositionList() {
  if (!await openPositionList())
    return

  showInternalReferralModal.value = false
  clearInternalReferralIntent()
}

function openEntry(entry: QuickEntry) {
  if (entry.action === 'internalReferral') {
    void handleInternalReferralEntry()
    return
  }
  if (entry.category)
    positionStore.setPendingCategory(entry.category)
  if (entry.pagePath)
    openPage(entry.pagePath)
}

function showJobDetail(positionId: string) {
  uni.navigateTo({
    url: `/pages/position/detail?id=${encodeURIComponent(positionId)}`,
  })
}

function getJobMeta(job: PositionListItem) {
  const meta = [job.location, job.edu, job.experience, ...job.tags]
    .filter((item): item is string => Boolean(item))
  return meta.filter((item, index) => meta.indexOf(item) === index).slice(0, 3)
}

function publisherAvatarUrl(job: PositionListItem) {
  const avatar = job.publisherAvatar?.trim()
  return avatar && !publisherAvatarErrors[job.positionId] ? avatar : ''
}

function handlePublisherAvatarError(positionId: string) {
  publisherAvatarErrors[positionId] = true
}

function isBannerImageVisible(banner: HomeBanner) {
  return Boolean(banner.imageUrl && !bannerImageErrors[banner.id])
}

function handleBannerImageError(bannerId: string) {
  bannerImageErrors[bannerId] = true
}

async function loadBanners() {
  if (bannersLoading.value)
    return
  bannersLoading.value = true
  bannersFailed.value = false
  try {
    const result = await getMiniappBanners()
    remoteBanners.value = Array.isArray(result) ? result : []
    bannerIndex.value = 0
    Object.keys(bannerImageErrors).forEach(key => delete bannerImageErrors[key])
  }
  catch {
    remoteBanners.value = []
    bannersFailed.value = true
  }
  finally {
    bannersLoading.value = false
  }
}

async function loadHotPositions() {
  if (hotPositionsLoading.value)
    return
  hotPositionsLoading.value = true
  hotPositionsFailed.value = false
  try {
    const page = await getHotPositions({ pageNum: 1, pageSize: HOT_POSITION_LIMIT })
    hotPositions.value = page.list.slice(0, HOT_POSITION_LIMIT)
  }
  catch {
    hotPositions.value = []
    hotPositionsFailed.value = true
  }
  finally {
    hotPositionsLoading.value = false
  }
}

function handleBannerChange(event: SwiperChangeEvent) {
  bannerIndex.value = event.detail.current
}

function handleEntryPageChange(event: SwiperChangeEvent) {
  entryPageIndex.value = event.detail.current
}

onLoad(() => {
  loadBanners()
  loadHotPositions()
})

onShow(() => {
  if (!tokenStore.updateNowTime().hasLogin) {
    clearInternalReferralIntent()
    return
  }
  if (consumeInternalReferralIntent())
    void openAuthenticatedInternalReferral()
})

onPageScroll(({ scrollTop }) => {
  headerScrolled.value = scrollTop > 8
})
</script>

<template>
  <view class="app-tab-page">
    <view class="relative overflow-hidden bg-home-hero">
      <AppPageHeader
        title="生生智家"
        transparent
        :scrolled="headerScrolled"
      />

      <view class="relative z-1 px-3 pb-4 pt-2">
        <view class="mb-3 px-1.5">
          <text class="block text-xl text-app-ink font-800 leading-[1.3] tracking-1rpx">找到属于你的岗位</text>
          <text class="mt-1.5 block text-2xs text-app-muted">三生制药 · 创新驱动的全球化生物制药企业</text>
        </view>

        <view class="relative">
          <view
            v-if="bannersLoading"
            class="h-296rpx center animate-pulse overflow-hidden rounded-36rpx bg-[#dfeaf8] text-app-muted shadow-[0_18rpx_40rpx_rgba(40,88,176,0.12)] motion-reduce:animate-none"
          >
            <view class="flex flex-col items-center">
              <view class="i-carbon-image mb-2 text-2xl text-[#9db5d4] leading-none" />
              <text class="text-xs">轮播内容加载中...</text>
            </view>
          </view>

          <swiper
            v-else
            class="h-296rpx overflow-hidden rounded-36rpx shadow-[0_18rpx_40rpx_rgba(40,88,176,0.18)]"
            :circular="banners.length > 1"
            :autoplay="banners.length > 1"
            :interval="4200"
            :duration="420"
            @change="handleBannerChange"
          >
            <swiper-item v-for="banner in banners" :key="banner.id">
              <view
                class="relative box-border h-full flex flex-col justify-center overflow-hidden rounded-36rpx px-5 pb-4 text-white transition-opacity duration-200"
                :class="banner.targetUrl ? 'cursor-pointer active:opacity-88' : ''"
                :style="{ background: banner.background }"
                :role="banner.targetUrl ? 'button' : undefined"
                :aria-label="banner.hoverText || banner.title"
                @tap="openBanner(banner)"
              >
                <image
                  v-if="isBannerImageVisible(banner)"
                  class="absolute inset-0 h-full w-full"
                  :src="banner.imageUrl"
                  mode="aspectFill"
                  :alt="banner.hoverText || banner.title"
                  @error="handleBannerImageError(banner.id)"
                />

                <template v-else>
                  <view class="pointer-events-none absolute h-260rpx w-260rpx rounded-full bg-white/14 -right-72rpx -top-96rpx" />
                  <view class="pointer-events-none absolute right-72rpx h-180rpx w-180rpx rounded-full bg-white/10 -bottom-88rpx" />
                </template>
              </view>
            </swiper-item>
          </swiper>

          <view v-if="!bannersLoading" class="pointer-events-none absolute inset-x-0 bottom-3 z-2 flex justify-center">
            <view class="flex items-center gap-1.5 rounded-full bg-black/16 px-2 py-1">
              <view
                v-for="(banner, index) in banners"
                :key="banner.id"
                class="h-6rpx rounded-full transition-all duration-260"
                :class="index === bannerIndex ? 'w-28rpx bg-white' : 'w-10rpx bg-white/48'"
              />
            </view>
          </view>

          <view
            v-if="!bannersLoading && bannersFailed"
            class="absolute right-3 top-3 z-3 min-h-64rpx flex cursor-pointer items-center rounded-full bg-black/42 px-3 text-2xs text-white backdrop-blur-6rpx active:opacity-75"
            role="button"
            aria-label="重新加载轮播图"
            @tap.stop="loadBanners"
          >
            <view class="i-carbon-renew mr-1 text-sm leading-none" />
            <text>重新加载</text>
          </view>
        </view>
      </view>
    </view>

    <view class="px-3 pt-1">
      <view
        class="relative cursor-pointer overflow-hidden rounded-32rpx bg-[linear-gradient(102deg,#8dcdf3_0%,#91d9ec_52%,#86dedc_100%)] px-3.5 py-3 shadow-[0_14rpx_30rpx_rgba(62,157,201,0.2)] active:opacity-88"
        role="button"
        aria-label="打开生生智家 AI 助手"
        @tap="openPage('pages/ai-chat/index')"
      >
        <view class="pointer-events-none absolute h-200rpx w-200rpx rounded-full bg-white/18 -right-56rpx -top-72rpx" />
        <view class="pointer-events-none absolute left-160rpx h-140rpx w-140rpx rounded-full bg-white/12 -bottom-72rpx" />

        <view class="relative z-1 flex items-center">
          <image
            class="h-92rpx w-92rpx flex-none"
            src="https://static1.3sbio.com/assets/lingcai/icon_%E6%B1%82%E8%81%8C%E5%B7%A5%E4%BD%9C%E5%8F%B0_V1.png"
            mode="aspectFit"
            aria-hidden="true"
          />

          <view class="ml-2 min-w-0 flex flex-1 flex-col">
            <text class="overflow-hidden text-ellipsis whitespace-nowrap text-32rpx text-[#113d78] font-700 leading-none">生生智家 · AI 助手</text>
            <text class="mt-2 block text-2xs text-[#315d88] font-500">说出期望，AI 帮你匹配岗位并一键投递</text>
          </view>

          <view class="ml-2 h-64rpx flex flex-none items-center rounded-full bg-white px-3 text-28rpx text-[#165caa] font-700 shadow-[0_8rpx_18rpx_rgba(44,122,178,0.18)]">
            <text>聊一聊</text>
            <view class="i-carbon-arrow-right ml-1 text-lg leading-none" />
          </view>
        </view>
      </view>

      <view class="mt-3 app-card px-1.5 pb-3 pt-3">
        <swiper
          class="h-300rpx"
          :duration="300"
          @change="handleEntryPageChange"
        >
          <swiper-item v-for="(entryPage, pageIndex) in visibleQuickEntryPages" :key="pageIndex">
            <view class="grid grid-cols-4 gap-y-2 px-1 pt-2">
              <view
                v-for="entry in entryPage"
                :key="entry.title"
                class="flex flex-col cursor-pointer items-center active:opacity-70"
                role="button"
                tabindex="0"
                :aria-label="entry.title"
                @keydown.enter.prevent="openEntry(entry)"
                @keydown.space.prevent="openEntry(entry)"
                @tap="openEntry(entry)"
              >
                <image
                  class="h-106rpx w-84rpx flex-none"
                  :src="entry.iconUrl"
                  mode="aspectFit"
                  aria-hidden="true"
                />
                <text class="whitespace-nowrap text-2xs text-[#113d78] font-700">
                  {{ entry.title }}
                </text>
              </view>
            </view>
          </swiper-item>
        </swiper>

        <view v-if="visibleQuickEntryPages.length > 1" class="mt-1 flex items-center justify-center gap-1">
          <view
            v-for="(entryPage, pageIndex) in visibleQuickEntryPages"
            :key="pageIndex"
            class="h-6rpx rounded-full transition-all duration-260"
            :class="pageIndex === entryPageIndex ? 'w-28rpx bg-brand-blue' : 'w-12rpx bg-[#dbe4f2]'"
          />
        </view>
      </view>

      <view class="mb-2.5 mt-4 flex items-center justify-between px-1.5">
        <view class="min-w-0 flex flex-1 items-center">
          <view class="mr-2 h-28rpx w-6rpx flex-none rounded-full bg-brand-hero" />
          <text class="text-base text-app-ink font-700">热门岗位</text>
          <text class="ml-2 overflow-hidden text-ellipsis whitespace-nowrap text-2xs text-app-muted">本周高热度在招</text>
        </view>
        <view
          class="ml-3 flex flex-none cursor-pointer items-center text-xs text-app-muted active:opacity-74"
          role="button"
          @tap="openPage('pages/position/index')"
        >
          <text>查看全部</text>
          <view class="i-carbon-chevron-right ml-px text-sm leading-none" />
        </view>
      </view>

      <view v-if="hotPositionsLoading" class="app-card py-8 text-center text-sm text-app-muted">
        热门岗位加载中...
      </view>
      <view
        v-else-if="hotPositionsFailed"
        class="cursor-pointer app-card py-8 text-center active:opacity-74"
        role="button"
        @tap="loadHotPositions"
      >
        <text class="block text-sm text-app-ink-soft">热门岗位加载失败</text>
        <text class="mt-1 block text-xs text-brand-blue">点击重新加载</text>
      </view>
      <view v-else-if="!hotPositions.length" class="app-card py-8 text-center text-sm text-app-muted">
        暂无热门岗位
      </view>
      <view v-else class="flex flex-col gap-2.5">
        <view
          v-for="(job, index) in hotPositions"
          :key="job.positionId"
          class="cursor-pointer app-card px-3.5 py-3.5 active:opacity-80"
          role="button"
          @tap="showJobDetail(job.positionId)"
        >
          <view class="flex items-center gap-2">
            <text class="flex-none rounded-8rpx bg-[#fff1e6] px-1.5 py-0.5 text-3xs text-app-warning font-700">
              TOP{{ index + 1 }}
            </text>
            <text class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-app-ink font-700">
              {{ job.positionName }}
            </text>
            <text class="flex-none text-sm text-brand-blue font-800">{{ formatPositionSalary(job) }}</text>
          </view>

          <view v-if="getJobMeta(job).length" class="mt-2.5 flex flex-wrap gap-1.5">
            <text
              v-for="tag in getJobMeta(job)"
              :key="tag"
              class="rounded-10rpx bg-[#f1f5fb] px-2 py-1 text-2xs text-app-ink-soft"
            >
              {{ tag }}
            </text>
          </view>

          <view class="mt-3 flex items-center justify-between border-t-1rpx border-t-[#eef2f8] border-t-solid pt-2.5">
            <view class="min-w-0 flex items-center">
              <image
                v-if="publisherAvatarUrl(job)"
                class="h-42rpx w-42rpx flex-none rounded-full"
                :src="publisherAvatarUrl(job)"
                mode="aspectFill"
                alt=""
                @error="handlePublisherAvatarError(job.positionId)"
              />
              <view v-else class="h-42rpx w-42rpx flex flex-none items-center justify-center rounded-full bg-[#e9f3ff] text-sm text-brand-blue leading-none">
                <view class="i-carbon-user-avatar" />
              </view>
              <text class="ml-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-2xs text-app-muted">
                {{ job.publisherName || '招聘团队' }}
              </text>
            </view>
            <text class="ml-3 flex-none text-2xs text-brand-blue font-600">立即查看</text>
          </view>
        </view>
      </view>
    </view>

    <InternalReferralModal
      v-if="showInternalReferralModal"
      :initial-email="internalReferralEmail"
      @close="closeInternalReferralModal"
      @skip="continueToPositionList"
      @certified="continueToPositionList"
    />
  </view>
</template>
