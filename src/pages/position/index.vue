<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { getPositionFilterOptions, getPositions } from '@/api/position'
import type { PositionFilterOption, PositionFilterOptions, PositionListItem, PositionLocationOption } from '@/api/position'
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

type FilterKey = 'educationInfos' | 'workExperiences' | 'locIds'

interface FilterSection {
  key: FilterKey
  label: string
  options: PositionFilterOption[]
}

const headerScrolled = ref(false)
const currentScrollTop = ref(0)
const searchMorphProgress = ref(0)
const keywordDraft = ref('')
const appliedKeyword = ref('')
const activeKinds = ref<string[]>([])
const kindScrollLeft = ref(0)
const filterOptions = ref<PositionFilterOptions>({ kinds: [], educationInfos: [], workExperiences: [], locations: [] })
const selectedFilters = reactive({ educationInfos: [] as string[], workExperiences: [] as string[], locIds: [] as string[] })
const appliedFilters = reactive({ educationInfos: [] as string[], workExperiences: [] as string[], locIds: [] as string[] })
const jobs = ref<PositionListItem[]>([])
const total = ref(0)
const loading = ref(false)
const positionsFailed = ref(false)
const showFilter = ref(false)
const pageNum = ref(0)
const PAGE_SIZE = 20
const kindOptions = computed(() => [{ value: '', label: '全部' }, ...filterOptions.value.kinds])
const locationOptions = computed(() => flattenLocationOptions(filterOptions.value.locations))
const filterSections = computed<FilterSection[]>(() => [
  { key: 'educationInfos', label: '学历要求', options: filterOptions.value.educationInfos },
  { key: 'workExperiences', label: '工作经验', options: filterOptions.value.workExperiences },
  { key: 'locIds', label: '工作地点', options: locationOptions.value },
])
const selectedFilterCount = computed(() => (
  appliedFilters.educationInfos.length
  + appliedFilters.workExperiences.length
  + appliedFilters.locIds.length
))
const selectedDraftFilterCount = computed(() => (
  selectedFilters.educationInfos.length
  + selectedFilters.workExperiences.length
  + selectedFilters.locIds.length
))
const hasMore = computed(() => jobs.value.length < total.value)
const positionStore = usePositionStore()
const activeCategories = ref<string[]>([])
const recruitmentCategories = [
  {
    value: '社招',
    label: '社会招聘',
    description: '经验人才 · 全职机会',
    icon: 'https://static1.3sbio.com/assets/%E7%A4%BE%E4%BC%9A%E6%8B%9B%E8%81%98.png',
    fallbackIcon: '/static/auth/recruit-social.svg',
    activeGradient: 'linear-gradient(135deg, #2f6fe8 0%, #4d9bf6 100%)',
    activeGlow: '0 16rpx 32rpx rgba(47,111,232,0.28)',
  },
  {
    value: '校招',
    label: '校园招聘',
    description: '应届启航 · 培养计划',
    icon: 'https://static1.3sbio.com/assets/%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98.png',
    fallbackIcon: '/static/auth/recruit-campus.svg',
    activeGradient: 'linear-gradient(135deg, #12b3c7 0%, #46d8d0 100%)',
    activeGlow: '0 16rpx 32rpx rgba(18,179,199,0.26)',
  },
]
const recruitmentIconError = reactive<Record<string, boolean>>({})
let positionRequestVersion = 0

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
    const capsuleGap = uni.upx2px(12)
    const availableWidth = menuButtonLeft - horizontalInset - capsuleGap
    headerSearchCompactWidth = Math.max(0, Math.min(headerSearchExpandedWidth, availableWidth))
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
  if (!reset && (loading.value || !hasMore.value))
    return

  const requestVersion = reset ? ++positionRequestVersion : positionRequestVersion
  if (reset) {
    jobs.value = []
    total.value = 0
    pageNum.value = 0
    positionsFailed.value = false
  }
  loading.value = true
  const nextPageNum = reset ? 1 : pageNum.value + 1
  const kindValues = activeKinds.value.map(Number).filter(Number.isFinite)
  try {
    const page = await getPositions({
      pageNum: nextPageNum,
      pageSize: PAGE_SIZE,
      keyword: appliedKeyword.value || undefined,
      kinds: kindValues.length ? kindValues : undefined,
      educationInfos: appliedFilters.educationInfos.length ? appliedFilters.educationInfos : undefined,
      workExperiences: appliedFilters.workExperiences.length ? appliedFilters.workExperiences : undefined,
      locIds: appliedFilters.locIds.length ? appliedFilters.locIds : undefined,
      categories: activeCategories.value.length ? activeCategories.value : undefined,
    })
    if (requestVersion !== positionRequestVersion)
      return
    jobs.value = reset ? page.list : [...jobs.value, ...page.list]
    total.value = page.total
    pageNum.value = nextPageNum
    positionsFailed.value = false
  }
  catch {
    if (reset && requestVersion === positionRequestVersion)
      positionsFailed.value = true
  }
  finally {
    if (requestVersion === positionRequestVersion)
      loading.value = false
  }
}

async function loadFilterOptions() {
  filterOptions.value = await getPositionFilterOptions()
}

function handleKeywordSearch(value: string) {
  const normalizedKeyword = value.trim()
  keywordDraft.value = normalizedKeyword
  appliedKeyword.value = normalizedKeyword
  loadPositions(true)
}

function flattenLocationOptions(options: PositionLocationOption[], parentLabels: string[] = []): PositionFilterOption[] {
  const flattened: PositionFilterOption[] = []
  for (const option of options) {
    const labelPath = [...parentLabels, option.label].filter(Boolean)
    if (option.children?.length) {
      flattened.push(...flattenLocationOptions(option.children, labelPath))
    }
    else if (option.value) {
      flattened.push({ value: option.value, label: labelPath.join(' · ') })
    }
  }
  return flattened
}

function isKindActive(value: string) {
  return value ? activeKinds.value.includes(value) : activeKinds.value.length === 0
}

function isRecruitmentCategoryActive(value: string) {
  return activeCategories.value.includes(value)
}

async function centerKindOption(index: number) {
  await nextTick()
  let viewportLeft = 0
  let viewportWidth = 0
  let currentScrollLeft = 0
  let optionLeft = 0
  let optionWidth = 0

  uni.createSelectorQuery()
    .select('#position-kind-scroll')
    .boundingClientRect((rect) => {
      const nodeInfo = Array.isArray(rect) ? rect[0] : rect
      viewportLeft = Number(nodeInfo?.left || 0)
      viewportWidth = Number(nodeInfo?.width || 0)
    })
    .select('#position-kind-scroll')
    .scrollOffset((offset) => {
      const nodeInfo = Array.isArray(offset) ? offset[0] : offset
      currentScrollLeft = Number(nodeInfo?.scrollLeft || 0)
    })
    .select(`#position-kind-${index}`)
    .boundingClientRect((rect) => {
      const nodeInfo = Array.isArray(rect) ? rect[0] : rect
      optionLeft = Number(nodeInfo?.left || 0)
      optionWidth = Number(nodeInfo?.width || 0)
    })
    .exec(() => {
      if (viewportWidth <= 0 || optionWidth <= 0)
        return
      const target = currentScrollLeft + optionLeft - viewportLeft - (viewportWidth - optionWidth) / 2
      kindScrollLeft.value = Math.max(0, Math.round(target))
    })
}

function handleCategoryTap(kind: string, index: number) {
  if (!kind) {
    activeKinds.value = []
  }
  else {
    activeKinds.value = activeKinds.value.includes(kind)
      ? activeKinds.value.filter(item => item !== kind)
      : [...activeKinds.value, kind]
  }
  void centerKindOption(index)
  loadPositions(true)
}

function toggleRecruitmentCategory(value: string) {
  activeCategories.value = activeCategories.value.includes(value)
    ? activeCategories.value.filter(item => item !== value)
    : [...activeCategories.value, value]
  loadPositions(true)
}

function applyPendingCategory() {
  const pending = positionStore.consumePendingCategory()
  if (pending && recruitmentCategories.some(item => item.value === pending)) {
    activeCategories.value = [pending]
    return true
  }
  return false
}

function openFilter() {
  selectedFilters.educationInfos = [...appliedFilters.educationInfos]
  selectedFilters.workExperiences = [...appliedFilters.workExperiences]
  selectedFilters.locIds = [...appliedFilters.locIds]
  showFilter.value = true
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
  appliedFilters.educationInfos = [...selectedFilters.educationInfos]
  appliedFilters.workExperiences = [...selectedFilters.workExperiences]
  appliedFilters.locIds = [...selectedFilters.locIds]
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
    // 请求层会在 401 时跳转登录页；其他错误保留页面内重试入口。
    positionsFailed.value = true
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
              <PositionSearchBar
                v-model="keywordDraft"
                compact
                @search="handleKeywordSearch"
              />
            </view>
          </view>
        </template>
      </AppPageHeader>

      <view class="relative z-1 px-4 pb-5 pt-3">
        <view
          class="transition-[opacity,transform] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
          :style="heroSearchStyle"
        >
          <PositionSearchBar
            v-model="keywordDraft"
            @search="handleKeywordSearch"
          />
        </view>

        <view class="grid grid-cols-2 mt-4 gap-3">
          <view
            v-for="item in recruitmentCategories"
            :key="item.value"
            class="relative min-h-116rpx flex cursor-pointer items-center overflow-hidden border-1rpx rounded-2xl border-solid px-3.5 transition-all duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] active:opacity-88 motion-reduce:transition-none"
            :class="isRecruitmentCategoryActive(item.value)
              ? 'border-white/60 shadow-[0_18rpx_38rpx_rgba(39,105,180,0.22)]'
              : 'border-white/60 bg-white/72 shadow-[0_12rpx_32rpx_rgba(39,105,180,0.08)] backdrop-blur-8rpx'"
            :style="isRecruitmentCategoryActive(item.value) ? { background: item.activeGradient, boxShadow: item.activeGlow } : {}"
            role="button"
            :aria-pressed="isRecruitmentCategoryActive(item.value)"
            :aria-label="item.label"
            @tap="toggleRecruitmentCategory(item.value)"
          >
            <view
              class="mr-3 h-72rpx w-72rpx flex flex-none items-center justify-center rounded-xl transition-colors duration-220"
              :class="isRecruitmentCategoryActive(item.value) ? 'bg-white/22' : 'bg-white/70'"
            >
              <image
                class="h-56rpx w-56rpx"
                :src="resolveRecruitmentIcon(item)"
                mode="aspectFit"
                @error="handleRecruitmentIconError(item.value)"
              />
            </view>
            <view class="min-w-0 flex flex-1 flex-col">
              <text class="text-sm font-700" :class="isRecruitmentCategoryActive(item.value) ? 'text-white' : 'text-app-ink'">{{ item.label }}</text>
              <text class="mt-1 block text-2xs" :class="isRecruitmentCategoryActive(item.value) ? 'text-white/82' : 'text-app-muted'">{{ item.description }}</text>
            </view>
            <view
              v-if="isRecruitmentCategoryActive(item.value)"
              class="absolute right-3 top-3 h-32rpx w-32rpx flex items-center justify-center rounded-full bg-white/28"
            >
              <view class="i-carbon-checkmark text-xs text-white leading-none" />
            </view>
          </view>
        </view>

        <view class="mt-5 flex items-center justify-between gap-3">
          <view class="min-w-0 flex flex-1 items-center">
            <text class="overflow-hidden text-ellipsis whitespace-nowrap text-xl text-app-ink font-700 leading-none">{{ total }} 个职位</text>
            <view class="i-carbon-chevron-right ml-1.5 flex-none text-base text-app-ink-soft leading-none" />
          </view>
          <view
            class="min-h-88rpx flex flex-none cursor-pointer items-center border-1rpx border-[#cfe2ff] rounded-full border-solid bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(231,242,255,0.96)_100%)] px-3.5 text-xs text-brand-blue shadow-[0_10rpx_28rpx_rgba(47,111,232,0.14)] transition-transform duration-180 active:scale-98 active:opacity-78 motion-reduce:transition-none"
            role="button"
            :aria-label="`打开其他职位筛选，已选择 ${selectedFilterCount} 项`"
            @tap="openFilter"
          >
            <view class="mr-2 h-48rpx w-48rpx flex items-center justify-center rounded-full bg-white shadow-[0_4rpx_12rpx_rgba(47,111,232,0.12)]">
              <view class="i-carbon-settings-adjust text-base leading-none" />
            </view>
            <text class="font-700">其他筛选</text>
            <text
              v-if="selectedFilterCount"
              class="ml-1.5 min-w-36rpx rounded-full bg-brand-blue px-1.5 py-0.5 text-center text-3xs text-white font-700"
            >
              {{ selectedFilterCount }}
            </text>
            <view class="i-carbon-chevron-right ml-1 text-xs leading-none" />
          </view>
        </view>
      </view>
    </view>

    <scroll-view
      id="position-kind-scroll"
      class="sticky top-[var(--position-header-offset)] z-90 w-full whitespace-nowrap bg-[rgba(255,255,255,0.98)] shadow-[0_8rpx_24rpx_rgba(38,64,105,0.06)]"
      scroll-x
      scroll-with-animation
      :scroll-left="kindScrollLeft"
      :show-scrollbar="false"
    >
      <view class="h-92rpx min-w-full inline-flex items-stretch px-3">
        <view
          v-for="(category, index) in kindOptions"
          :id="`position-kind-${index}`"
          :key="category.value || 'recommended'"
          class="relative min-w-120rpx flex cursor-pointer items-center justify-center px-3 text-30rpx text-app-ink-soft font-600 active:opacity-70"
          :class="isKindActive(category.value) ? 'text-brand-blue' : ''"
          role="button"
          :aria-pressed="isKindActive(category.value)"
          :aria-label="category.label"
          @tap="handleCategoryTap(category.value, index)"
        >
          <text>{{ category.label }}</text>
          <view
            v-if="isKindActive(category.value)"
            class="absolute bottom-0 left-0 right-0 mx-auto h-5rpx w-36rpx rounded-full bg-brand-blue"
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
      <view
        v-if="!loading && positionsFailed"
        class="cursor-pointer py-14 text-center active:opacity-74"
        role="button"
        aria-label="重新加载职位列表"
        @tap="loadPositions(true)"
      >
        <text class="block text-sm text-app-ink-soft">职位加载失败</text>
        <text class="mt-1 block text-xs text-brand-blue">点击重新加载</text>
      </view>
      <view v-else-if="!loading && !jobs.length" class="py-16 text-center text-sm text-app-muted">
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
      <view class="h-[82vh] w-full flex flex-col overflow-hidden rounded-t-[40rpx] bg-[#f7faff] shadow-[0_-20rpx_60rpx_rgba(18,43,82,0.2)]">
        <view class="flex-none px-4 pb-3 pt-3">
          <view class="mx-auto mb-3 h-8rpx w-72rpx rounded-full bg-[#d8e1ee]" />
          <view class="flex items-center justify-between">
            <view class="min-w-0 flex-1">
              <text class="block text-lg text-app-ink font-700">其他筛选</text>
              <text class="mt-1 block text-xs text-app-muted">学历、经验和地点均支持多选</text>
            </view>
            <view
              class="ml-3 h-72rpx w-72rpx flex cursor-pointer items-center justify-center rounded-full bg-white text-app-ink-soft shadow-[0_6rpx_18rpx_rgba(38,64,105,0.1)] active:opacity-70"
              role="button"
              aria-label="关闭筛选面板"
              @tap="showFilter = false"
            >
              <view class="i-carbon-close text-lg leading-none" />
            </view>
          </view>
        </view>

        <scroll-view class="min-h-0 flex-1 px-4" scroll-y :show-scrollbar="false">
          <view class="pb-4">
            <view
              v-for="section in filterSections"
              :key="section.key"
              class="mb-4 rounded-2xl bg-white p-4 shadow-[0_8rpx_28rpx_rgba(38,64,105,0.07)]"
            >
              <view class="mb-3 flex items-center justify-between">
                <text class="text-sm text-app-ink font-700">{{ section.label }}</text>
                <text class="text-2xs text-app-muted">
                  {{ selectedFilters[section.key].length ? `已选 ${selectedFilters[section.key].length} 项` : '可多选' }}
                </text>
              </view>
              <view class="flex flex-wrap gap-2">
                <view
                  v-for="option in section.options"
                  :key="option.value"
                  class="box-border max-w-full min-h-80rpx flex cursor-pointer items-center border-1rpx rounded-xl border-solid px-3 py-2 text-xs transition-colors duration-180 active:opacity-72 motion-reduce:transition-none"
                  :class="selectedFilters[section.key].includes(option.value)
                    ? 'border-[#7cb6ff] bg-[#e8f3ff] text-brand-blue shadow-[0_4rpx_14rpx_rgba(47,111,232,0.1)]'
                    : 'border-[#e5ebf3] bg-[#f7f9fc] text-app-ink-soft'"
                  role="checkbox"
                  :aria-checked="selectedFilters[section.key].includes(option.value)"
                  :aria-label="option.label"
                  @tap="toggleFilter(section.key, option.value)"
                >
                  <text class="min-w-0 break-words">{{ option.label }}</text>
                  <view
                    v-if="selectedFilters[section.key].includes(option.value)"
                    class="i-carbon-checkmark-filled ml-1.5 flex-none text-sm text-brand-blue leading-none"
                  />
                </view>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="flex-none border-t-1rpx border-t-[#e3eaf3] border-t-solid bg-white px-4 pt-3 pb-safe">
          <view class="flex gap-3 pb-3">
            <button
              class="m-0 h-88rpx flex flex-1 items-center justify-center border-1rpx border-[#d9e3ef] rounded-full border-solid bg-[#f5f8fc] p-0 text-sm text-app-ink-soft font-700 leading-none after:border-0 active:opacity-72"
              aria-label="重置其他筛选"
              @tap="resetFilters"
            >
              重置
            </button>
            <button
              class="m-0 h-88rpx flex flex-1 items-center justify-center border-0 rounded-full bg-[linear-gradient(135deg,#2f6fe8_0%,#4d9bf6_100%)] p-0 text-sm text-white font-700 leading-none shadow-[0_10rpx_24rpx_rgba(47,111,232,0.24)] after:border-0 active:opacity-78"
              :aria-label="`应用筛选，当前选择 ${selectedDraftFilterCount} 项`"
              @tap="applyFilters"
            >
              {{ selectedDraftFilterCount ? `筛选（${selectedDraftFilterCount}）` : '筛选' }}
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
