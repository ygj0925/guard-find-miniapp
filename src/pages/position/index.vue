<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { getPositionFilterOptions, getPositions } from '@/api/position'
import type { PositionFilterOptions, PositionListItem } from '@/api/position'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { usePositionStore } from '@/store/position'
import { tabbarStore } from '@/tabbar/store'
import { formatPositionSalary } from '@/utils/positionSalary'
import PositionSearchBar from './components/PositionSearchBar.vue'

defineOptions({
  name: 'Position',
})

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '职位',
    navigationBarBackgroundColor: '#EDF6FF',
    navigationBarTextStyle: 'black',
    backgroundColor: '#EDF6FF',
    backgroundColorTop: '#EDF6FF',
    backgroundColorBottom: '#EDF6FF',
  },
})

const POSITION_PATH = '/pages/position/index'
const HEADER_SEARCH_START = uni.upx2px(24)
const HEADER_SEARCH_END = uni.upx2px(128)
const BACK_TO_TOP_ENTER_THRESHOLD = uni.upx2px(760)
const BACK_TO_TOP_EXIT_THRESHOLD = uni.upx2px(32)

const headerScrolled = ref(false)
const currentScrollTop = ref(0)
const searchMorphProgress = ref(0)
const activeKind = ref('')
const filterOptions = ref<PositionFilterOptions>({ kinds: [], educationInfos: [], workExperiences: [], locations: [] })
const selectedFilters = reactive({ educationInfos: [] as string[], workExperiences: [] as string[], locIds: [] as string[] })
const jobs = ref<PositionListItem[]>([])
const total = ref(0)
const loading = ref(false)
const showFilter = ref(false)
const pageNum = ref(0)
const PAGE_SIZE = 20
const categories = computed(() => [{ value: '', label: '全部' }, ...filterOptions.value.kinds])
const hasMore = computed(() => jobs.value.length < total.value)
const positionStore = usePositionStore()
const activeCategory = ref('')
const recruitmentCategories = [
  {
    value: '社招',
    label: '社会招聘',
    description: '经验人才 · 全职机会',
    icon: 'https://3sbio-it-video.oss-cn-shanghai.aliyuncs.com/assets/%E7%A4%BE%E4%BC%9A%E6%8B%9B%E8%81%98.png',
    fallbackIcon: '/static/auth/recruit-social.svg',
    activeGradient: 'linear-gradient(135deg, #2f6fe8 0%, #4d9bf6 100%)',
    activeGlow: '0 16rpx 32rpx rgba(47,111,232,0.28)',
  },
  {
    value: '校招',
    label: '校园招聘',
    description: '应届启航 · 培养计划',
    icon: 'https://3sbio-it-video.oss-cn-shanghai.aliyuncs.com/assets/%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98.png',
    fallbackIcon: '/static/auth/recruit-campus.svg',
    activeGradient: 'linear-gradient(135deg, #12b3c7 0%, #46d8d0 100%)',
    activeGlow: '0 16rpx 32rpx rgba(18,179,199,0.26)',
  },
]
const recruitmentIconError = reactive<Record<string, boolean>>({})

function resolveRecruitmentIcon(item: typeof recruitmentCategories[number]) {
  return recruitmentIconError[item.value] ? item.fallbackIcon : item.icon
}

function handleRecruitmentIconError(value: string) {
  recruitmentIconError[value] = true
}

let statusBarHeight = 0
let headerSearchExpandedWidth = 0
let headerSearchCompactWidth = 0
try {
  const windowInfo = uni.getWindowInfo?.() || uni.getSystemInfoSync()
  statusBarHeight = windowInfo.statusBarHeight || 0
  const horizontalInset = uni.upx2px(24)
  headerSearchExpandedWidth = Math.max(0, windowInfo.windowWidth - horizontalInset * 2)
  headerSearchCompactWidth = headerSearchExpandedWidth

  let menuButtonLeft = 0
  // #ifdef MP-WEIXIN
  menuButtonLeft = uni.getMenuButtonBoundingClientRect().left
  // #endif
  if (menuButtonLeft > 0) {
    const capsuleGap = uni.upx2px(16)
    headerSearchCompactWidth = Math.max(
      uni.upx2px(320),
      menuButtonLeft - horizontalInset - capsuleGap,
    )
  }
}
catch {
  statusBarHeight = 0
}

let positionHeaderOffset = `${statusBarHeight + uni.upx2px(96)}px`
// #ifdef H5
positionHeaderOffset = 'calc(env(safe-area-inset-top) + 96rpx)'
// #endif

const pageStyle = {
  '--position-header-offset': positionHeaderOffset,
}
const headerTitleStyle = computed(() => {
  const progress = searchMorphProgress.value
  return {
    opacity: Math.max(0, 1 - progress * 1.4),
    transform: `translate3d(0, ${Math.round(-8 * progress)}rpx, 0) scale(${1 - 0.04 * progress})`,
  }
})
const headerSearchStyle = computed(() => {
  const progress = searchMorphProgress.value
  const width = headerSearchExpandedWidth > 0
    ? headerSearchExpandedWidth - (headerSearchExpandedWidth - headerSearchCompactWidth) * progress
    : 0
  return {
    width: width > 0 ? `${Math.round(width)}px` : '100%',
    opacity: Math.min(1, progress * 1.35),
    transform: `translate3d(0, ${Math.round((1 - progress) * 10)}rpx, 0) scale(${0.96 + 0.04 * progress})`,
    transformOrigin: 'left center',
  }
})
const heroSearchStyle = computed(() => {
  const progress = searchMorphProgress.value
  return {
    opacity: Math.max(0, 1 - progress * 1.15),
    transform: `translate3d(0, ${Math.round(-8 * progress)}rpx, 0) scaleX(${1 - 0.04 * progress})`,
    transformOrigin: 'center top',
  }
})

function syncScrollState(scrollTop: number) {
  currentScrollTop.value = scrollTop
  const progress = Math.min(1, Math.max(0, (scrollTop - HEADER_SEARCH_START) / (HEADER_SEARCH_END - HEADER_SEARCH_START)))
  searchMorphProgress.value = progress
  headerScrolled.value = progress >= 0.55

  if (scrollTop >= BACK_TO_TOP_ENTER_THRESHOLD) {
    tabbarStore.setBackToTopVisible(POSITION_PATH, true)
  }
  else if (scrollTop <= BACK_TO_TOP_EXIT_THRESHOLD) {
    tabbarStore.setBackToTopVisible(POSITION_PATH, false)
  }
}

function showJobDetail(positionId: string) {
  uni.navigateTo({
    url: `/pages/position/detail?id=${encodeURIComponent(positionId)}`,
  })
}

async function loadPositions(reset = false) {
  if (loading.value || (!reset && !hasMore.value))
    return
  loading.value = true
  const nextPageNum = reset ? 1 : pageNum.value + 1
  try {
    const page = await getPositions({
      pageNum: nextPageNum,
      pageSize: PAGE_SIZE,
      kinds: activeKind.value ? [Number(activeKind.value)] : undefined,
      category: activeCategory.value || undefined,
      educationInfos: selectedFilters.educationInfos.length ? selectedFilters.educationInfos : undefined,
      workExperiences: selectedFilters.workExperiences.length ? selectedFilters.workExperiences : undefined,
      locIds: selectedFilters.locIds.length ? selectedFilters.locIds : undefined,
    })
    jobs.value = reset ? page.list : [...jobs.value, ...page.list]
    total.value = page.total
    pageNum.value = nextPageNum
  }
  finally {
    loading.value = false
  }
}

async function loadFilterOptions() {
  filterOptions.value = await getPositionFilterOptions()
}

function handleCategoryTap(kind: string) {
  if (activeKind.value === kind)
    return
  activeKind.value = kind
  loadPositions(true)
}

function toggleRecruitmentCategory(value: string) {
  activeCategory.value = activeCategory.value === value ? '' : value
  loadPositions(true)
}

function applyPendingCategory() {
  const pending = positionStore.consumePendingCategory()
  if (pending && recruitmentCategories.some(item => item.value === pending)) {
    activeCategory.value = pending
    return true
  }
  return false
}

function toggleFilter(type: 'educationInfos' | 'workExperiences' | 'locIds', value: string) {
  const selected = selectedFilters[type]
  selectedFilters[type] = selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]
}

function resetFilters() {
  selectedFilters.educationInfos = []
  selectedFilters.workExperiences = []
  selectedFilters.locIds = []
}

function applyFilters() {
  showFilter.value = false
  loadPositions(true)
}

onPageScroll(({ scrollTop }) => {
  syncScrollState(scrollTop)
})

onShow(() => {
  syncScrollState(currentScrollTop.value)
  // switchTab 复用页面实例时不会重新触发 onLoad，这里消费首页携带的招聘类别并刷新列表。
  if (applyPendingCategory())
    loadPositions(true)
})

onLoad(async () => {
  applyPendingCategory()
  try {
    await loadFilterOptions()
    await loadPositions(true)
  }
  catch {
    // 请求层会在 401 时跳转登录页；此处不再继续发送列表请求，避免跳转期间出现空白页。
  }
})

onReachBottom(() => {
  loadPositions()
})

onHide(() => {
  tabbarStore.setBackToTopVisible(POSITION_PATH, false)
})

onUnload(() => {
  tabbarStore.setBackToTopVisible(POSITION_PATH, false)
})
</script>

<template>
  <view class="app-tab-page bg-app-surface" :style="pageStyle">
    <view class="relative overflow-hidden bg-home-hero">
      <AppPageHeader
        title="职位"
        transparent
        center-wide
        :scrolled="headerScrolled"
        :scroll-progress="searchMorphProgress"
      >
        <template #center>
          <view class="relative h-64rpx w-full">
            <view
              class="pointer-events-none absolute inset-0 flex items-center justify-center text-lg text-app-ink font-700 leading-none tracking-1rpx transition-[opacity,transform] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
              :style="headerTitleStyle"
            >
              <text>职位</text>
            </view>
            <view
              class="absolute inset-y-0 left-0 flex items-center transition-[width,opacity,transform] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
              :class="searchMorphProgress > 0.08 ? 'pointer-events-auto' : 'pointer-events-none'"
              :style="headerSearchStyle"
            >
              <PositionSearchBar compact @tap="showFilter = true" />
            </view>
          </view>
        </template>
      </AppPageHeader>

      <view class="relative z-1 px-4 pb-5 pt-3">
        <view
          class="transition-[opacity,transform] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
          :style="heroSearchStyle"
        >
          <PositionSearchBar @tap="showFilter = true" />
        </view>

        <view class="grid grid-cols-2 mt-4 gap-3">
          <view
            v-for="item in recruitmentCategories"
            :key="item.value"
            class="relative min-h-116rpx flex cursor-pointer items-center overflow-hidden border-1rpx rounded-3xl border-solid px-3.5 transition-all duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] active:opacity-88 motion-reduce:transition-none"
            :class="activeCategory === item.value
              ? 'border-white/60 shadow-[0_18rpx_38rpx_rgba(39,105,180,0.22)]'
              : 'border-white/60 bg-white/72 shadow-[0_12rpx_32rpx_rgba(39,105,180,0.08)] backdrop-blur-8rpx'"
            :style="activeCategory === item.value ? { background: item.activeGradient, boxShadow: item.activeGlow } : {}"
            role="button"
            :aria-pressed="activeCategory === item.value"
            :aria-label="item.label"
            @tap="toggleRecruitmentCategory(item.value)"
          >
            <view
              class="mr-3 h-72rpx w-72rpx flex flex-none items-center justify-center rounded-2xl transition-colors duration-220"
              :class="activeCategory === item.value ? 'bg-white/22' : 'bg-white/70'"
            >
              <image
                class="h-44rpx w-44rpx"
                :src="resolveRecruitmentIcon(item)"
                mode="aspectFit"
                @error="handleRecruitmentIconError(item.value)"
              />
            </view>
            <view class="min-w-0 flex flex-1 flex-col">
              <text class="text-sm font-700" :class="activeCategory === item.value ? 'text-white' : 'text-app-ink'">{{ item.label }}</text>
              <text class="mt-1 block text-2xs" :class="activeCategory === item.value ? 'text-white/82' : 'text-app-muted'">{{ item.description }}</text>
            </view>
            <view
              v-if="activeCategory === item.value"
              class="absolute right-3 top-3 h-32rpx w-32rpx flex items-center justify-center rounded-full bg-white/28"
            >
              <view class="i-carbon-checkmark text-xs text-white leading-none" />
            </view>
          </view>
        </view>

        <view class="mt-5 flex items-end">
          <text class="text-xl text-app-ink font-700 leading-none">{{ total ? `${total} 个职位` : '职位推荐' }}</text>
          <view class="mb-1 ml-2 h-2 w-2 rotate-45 border-b-3rpx border-r-3rpx border-app-ink-soft border-solid" />
        </view>
      </view>
    </view>

    <scroll-view
      class="sticky top-[var(--position-header-offset)] z-90 w-full whitespace-nowrap bg-[rgba(255,255,255,0.98)] shadow-[0_8rpx_24rpx_rgba(38,64,105,0.06)]"
      scroll-x
      scroll-with-animation
      :show-scrollbar="false"
    >
      <view class="h-92rpx min-w-full inline-flex items-stretch px-3">
        <view
          v-for="category in categories"
          :key="category.value || 'recommended'"
          class="relative min-w-120rpx flex cursor-pointer items-center justify-center px-3 text-30rpx text-app-ink-soft font-600 active:opacity-70"
          :class="activeKind === category.value ? 'text-brand-blue' : ''"
          role="button"
          :aria-label="category.label"
          @tap="handleCategoryTap(category.value)"
        >
          <text>{{ category.label }}</text>
          <view
            v-if="activeKind === category.value"
            class="absolute bottom-0 left-1/2 h-5rpx w-36rpx rounded-full bg-brand-blue -translate-x-1/2"
          />
        </view>
      </view>
    </scroll-view>

    <view class="px-3 pb-6 pt-3">
      <view class="flex flex-col gap-3">
        <view
          v-for="job in jobs"
          :key="job.positionId"
          class="cursor-pointer rounded-2xl bg-white px-4 py-4 shadow-[0_8rpx_24rpx_rgba(38,64,105,0.05)] active:opacity-74"
          role="button"
          @tap="showJobDetail(job.positionId)"
        >
          <view class="flex items-start justify-between gap-3">
            <text class="min-w-0 flex-1 text-base text-app-ink font-700 leading-[1.35]">{{ job.positionName }}</text>
            <text class="flex-none text-sm text-brand-blue font-700">{{ formatPositionSalary(job) }}</text>
          </view>
          <view v-if="[job.location, job.edu, job.experience].some(Boolean)" class="mt-2.5 flex flex-wrap gap-1.5">
            <text
              v-for="meta in [job.location, job.edu, job.experience].filter(Boolean)"
              :key="meta"
              class="rounded-10rpx bg-[#f1f5fb] px-2 py-1 text-2xs text-app-ink-soft"
            >
              {{ meta }}
            </text>
          </view>
          <view v-if="job.tags?.some(Boolean)" class="mt-3 flex flex-wrap gap-2">
            <text v-for="tag in job.tags.filter(Boolean)" :key="tag" class="rounded-lg bg-[#f2f4f7] px-2 py-1 text-xs text-app-ink-soft">{{ tag }}</text>
          </view>
          <view class="mt-3 flex items-center justify-between border-t-1rpx border-t-[#f1f3f6] border-t-solid pt-3">
            <view class="flex items-center">
              <view class="h-42rpx w-42rpx flex items-center justify-center rounded-full bg-[#e9f3ff] text-sm text-brand-blue leading-none">
                <view class="i-carbon-user-avatar" />
              </view>
              <text class="ml-2 text-xs text-app-ink-soft">招聘团队 · 简历直投</text>
            </view>
            <text class="ml-3 text-xs text-app-muted">{{ job.location }}</text>
          </view>
        </view>
      </view>
      <view v-if="!loading && !jobs.length" class="py-16 text-center text-sm text-app-muted">
        暂无符合条件的职位
      </view>
      <view v-if="loading" class="py-8 text-center text-sm text-app-muted">
        职位加载中...
      </view>
      <view v-else-if="jobs.length && !hasMore" class="py-8 text-center text-xs text-app-muted">
        没有更多职位了
      </view>
    </view>

    <view v-if="showFilter" class="fixed inset-0 z-200 flex items-end bg-black/45" @tap.self="showFilter = false">
      <view class="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pt-5 pb-safe">
        <view class="mb-5 flex items-center justify-between">
          <text class="text-lg text-app-ink font-700">筛选职位</text><text class="text-sm text-app-ink-soft" @tap="showFilter = false">关闭</text>
        </view>
        <view v-for="section in [{ key: 'educationInfos', label: '学历要求', options: filterOptions.educationInfos }, { key: 'workExperiences', label: '工作经验', options: filterOptions.workExperiences }, { key: 'locIds', label: '工作地点', options: filterOptions.locations }]" :key="section.key" class="mb-5">
          <text class="mb-3 block text-sm text-app-ink font-700">{{ section.label }}</text>
          <view class="flex flex-wrap gap-2">
            <text v-for="option in section.options" :key="option.value" class="rounded-lg px-3 py-2 text-xs" :class="selectedFilters[section.key as 'educationInfos' | 'workExperiences' | 'locIds'].includes(option.value) ? 'bg-[#e3f3ff] text-brand-blue' : 'bg-[#f2f4f7] text-app-ink-soft'" @tap="toggleFilter(section.key as 'educationInfos' | 'workExperiences' | 'locIds', option.value)">{{ option.label }}</text>
          </view>
        </view>
        <view class="flex gap-3 border-t-1rpx border-[#edf0f4] border-solid py-3">
          <button class="flex-1 border-0 bg-[#f2f4f7] text-sm text-app-ink-soft" @tap="resetFilters">
            重置
          </button><button class="flex-1 border-0 bg-brand-blue text-sm text-white" @tap="applyFilters">
            确定
          </button>
        </view>
      </view>
    </view>
  </view>
</template>
