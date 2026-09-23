<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { getPositionFilterOptions, getPositions } from '@/api/position'
import type { PositionFilterOption, PositionFilterOptions, PositionListItem } from '@/api/position'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { usePositionStore } from '@/store/position'
import { tabbarStore } from '@/tabbar/store'
import { formatPositionSalary } from '@/utils/positionSalary'
import { createMiniProgramShare, createMiniProgramTimelineShare } from '@/utils/miniProgramShare'
import PositionLocationFilter from './components/PositionLocationFilter.vue'
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
    enableShareAppMessage: true,
    enableShareTimeline: true,
  },
})

onShareAppMessage(() => createMiniProgramShare('生生智家 - 职位', '/pages/position/index'))
onShareTimeline(() => createMiniProgramTimelineShare('生生智家 - 职位'))

const POSITION_PATH = '/pages/position/index'
const HEADER_SEARCH_START = uni.upx2px(24)
const HEADER_SEARCH_END = uni.upx2px(128)
const BACK_TO_TOP_ENTER_THRESHOLD = uni.upx2px(760)
const BACK_TO_TOP_EXIT_THRESHOLD = uni.upx2px(32)

type FilterKey = 'educationInfos' | 'workExperiences' | 'locIds'
type ChipFilterKey = Exclude<FilterKey, 'locIds'>

interface FilterSection {
  key: ChipFilterKey
  label: string
  options: PositionFilterOption[]
}

interface FilterSelectionState {
  educationInfos: string[]
  workExperiences: string[]
  locIds: string[]
}

const headerScrolled = ref(false)
const currentScrollTop = ref(0)
const searchMorphProgress = ref(0)
const keywordDraft = ref('')
const appliedKeyword = ref('')
const activeKinds = ref<string[]>([])
const kindScrollLeft = ref(0)
const filterOptions = ref<PositionFilterOptions>({ kinds: [], categories: [], educationInfos: [], workExperiences: [], locations: [] })
const filterOptionsLoading = ref(false)
const filterOptionsFailed = ref(false)
const selectedFilters = reactive<FilterSelectionState>({ educationInfos: [], workExperiences: [], locIds: [] })
const appliedFilters = reactive<FilterSelectionState>({ educationInfos: [], workExperiences: [], locIds: [] })
const jobs = ref<PositionListItem[]>([])
const publisherAvatarErrors = reactive<Record<string, boolean>>({})
const total = ref(0)
const loading = ref(false)
const positionsFailed = ref(false)
const showFilter = ref(false)
const pageNum = ref(0)
const PAGE_SIZE = 20
const kindOptions = computed(() => [{ value: '', label: '全部' }, ...filterOptions.value.kinds])
const filterSections = computed<FilterSection[]>(() => [
  { key: 'educationInfos', label: '学历要求', options: filterOptions.value.educationInfos },
  { key: 'workExperiences', label: '工作经验', options: filterOptions.value.workExperiences },
])

function countFilterSelections(filters: FilterSelectionState) {
  return filters.educationInfos.length
    + filters.workExperiences.length
    + (filters.locIds.length > 0 ? 1 : 0)
}

const hasAppliedFilters = computed(() => countFilterSelections(appliedFilters) > 0)
const draftFilterCount = computed(() => countFilterSelections(selectedFilters))
const hasLocationOptions = computed(() => filterOptions.value.locations.length > 0)
const hasMore = computed(() => jobs.value.length < total.value)
const positionStore = usePositionStore()
const activeCategories = ref<string[]>([])
interface RecruitmentCategory {
  value: string
  label: string
  icon: string
  activeGradient: string
  activeGlow: string
}

const RECRUITMENT_CATEGORY_VISUALS: Record<string, Omit<RecruitmentCategory, 'value' | 'label'>> = {
  社会招聘: {
    icon: 'https://static1.3sbio.com/assets/%E7%A4%BE%E4%BC%9A%E6%8B%9B%E8%81%98.png',
    activeGradient: 'linear-gradient(135deg, #2f6fe8 0%, #4d9bf6 100%)',
    activeGlow: '0 16rpx 32rpx rgba(47,111,232,0.28)',
  },
  校园招聘: {
    icon: 'https://static1.3sbio.com/assets/%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98.png',
    activeGradient: 'linear-gradient(135deg, #12b3c7 0%, #46d8d0 100%)',
    activeGlow: '0 16rpx 32rpx rgba(18,179,199,0.26)',
  },
  实习生招聘: {
    icon: 'https://static1.3sbio.com/assets/%E5%AE%9E%E4%B9%A0%E7%94%9F-2.png',
    activeGradient: 'linear-gradient(135deg, #7165e8 0%, #9b7eea 100%)',
    activeGlow: '0 16rpx 32rpx rgba(113,101,232,0.26)',
  },
}

const DEFAULT_RECRUITMENT_CATEGORIES: RecruitmentCategory[] = [
  { value: '1', label: '社会招聘', ...RECRUITMENT_CATEGORY_VISUALS['社会招聘'] },
  { value: '2', label: '校园招聘', ...RECRUITMENT_CATEGORY_VISUALS['校园招聘'] },
]

const recruitmentCategories = computed<RecruitmentCategory[]>(() => {
  const categories = filterOptions.value.categories
    .filter(item => item.value && item.label)
    .map(item => item.label === '实习招聘' ? { ...item, label: '实习生招聘' } : item)
  if (!categories.length)
    return DEFAULT_RECRUITMENT_CATEGORIES

  return categories.map((item) => {
    const visual = RECRUITMENT_CATEGORY_VISUALS[item.label]
    if (!visual)
      return null
    return { value: item.value, label: item.label, ...visual }
  }).filter((item): item is RecruitmentCategory => item !== null)
})
let positionRequestVersion = 0

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

function publisherAvatarUrl(job: PositionListItem) {
  const avatar = job.publisherAvatar?.trim()
  return avatar && !publisherAvatarErrors[job.positionId] ? avatar : ''
}

function handlePublisherAvatarError(positionId: string) {
  publisherAvatarErrors[positionId] = true
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
  filterOptionsLoading.value = true
  filterOptionsFailed.value = false
  try {
    filterOptions.value = await getPositionFilterOptions()
  }
  catch {
    filterOptionsFailed.value = true
  }
  finally {
    filterOptionsLoading.value = false
  }
}

function handleKeywordSearch(value: string) {
  const normalizedKeyword = value.trim()
  keywordDraft.value = normalizedKeyword
  appliedKeyword.value = normalizedKeyword
  loadPositions(true)
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
  let contentWidth = 0
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
    .select('#position-kind-scroll-content')
    .boundingClientRect((rect) => {
      const nodeInfo = Array.isArray(rect) ? rect[0] : rect
      contentWidth = Number(nodeInfo?.width || 0)
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
      if (contentWidth <= viewportWidth) {
        kindScrollLeft.value = 0
        return
      }
      const target = currentScrollLeft + optionLeft - viewportLeft - (viewportWidth - optionWidth) / 2
      kindScrollLeft.value = Math.max(0, Math.round(target))
    })
}

function handleCategoryTap(kind: string, index: number) {
  if (!kind) {
    activeKinds.value = []
  }
  else {
    activeKinds.value = activeKinds.value[0] === kind ? [] : [kind]
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
  if (pending && recruitmentCategories.value.some(item => item.value === pending)) {
    activeCategories.value = [pending]
    return true
  }
  return false
}

function focusFilterElement(id: string) {
  // #ifdef H5
  void nextTick(() => document.getElementById(id)?.focus())
  // #endif
}

function activateButtonWithKeyboard(event: KeyboardEvent) {
  // #ifdef H5
  if (event.key !== 'Enter' && event.key !== ' ')
    return
  event.preventDefault()
  const element = event.currentTarget as HTMLElement | null
  element?.click()
  // #endif
}

function handleFilterDialogKeydown(event: KeyboardEvent) {
  // #ifdef H5
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeFilter()
    return
  }
  if (event.key !== 'Tab')
    return

  const dialog = event.currentTarget as HTMLElement
  const focusableElements = Array.from(
    dialog.querySelectorAll<HTMLElement>('[tabindex="0"]:not([disabled])'),
  )
  if (!focusableElements.length) {
    event.preventDefault()
    dialog.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  const activeElement = document.activeElement
  if (event.shiftKey && (activeElement === firstElement || activeElement === dialog)) {
    event.preventDefault()
    lastElement.focus()
  }
  else if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
  // #endif
}

function openFilter() {
  selectedFilters.educationInfos = [...appliedFilters.educationInfos]
  selectedFilters.workExperiences = [...appliedFilters.workExperiences]
  selectedFilters.locIds = [...appliedFilters.locIds]
  showFilter.value = true
  focusFilterElement('position-filter-dialog')
}

function closeFilter() {
  showFilter.value = false
  focusFilterElement('position-filter-trigger')
}

function toggleFilter(type: ChipFilterKey, value: string) {
  const selected = selectedFilters[type]
  selectedFilters[type] = selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]
}

function updateSelectedLocations(values: string[]) {
  selectedFilters.locIds = values
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
  closeFilter()
  loadPositions(true)
}

onBackPress(() => {
  if (!showFilter.value)
    return false
  closeFilter()
  return true
})

onPageScroll(({ scrollTop }) => {
  syncScrollState(scrollTop)
})

onShow(() => {
  syncScrollState(currentScrollTop.value)
  // switchTab 复用页面实例时不会重新触发 onLoad，这里消费首页携带的招聘类别并刷新列表。
  if (applyPendingCategory())
    loadPositions(true)
})

onLoad((options?: { category?: string }) => {
  if (options?.category === '1' || options?.category === '2')
    positionStore.setPendingCategory(options.category)
  applyPendingCategory()
  void loadFilterOptions()
  void loadPositions(true)
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

        <view class="grid grid-cols-3 mt-4 gap-2">
          <view
            v-for="item in recruitmentCategories"
            :key="item.value"
            class="min-w-0 h-112rpx flex cursor-pointer items-center justify-center gap-1 overflow-hidden border-1rpx rounded-xl border-solid px-1 text-center transition-all duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] active:opacity-88 motion-reduce:transition-none"
            :class="[
              isRecruitmentCategoryActive(item.value)
                ? 'border-white/60 shadow-[0_18rpx_38rpx_rgba(39,105,180,0.22)]'
                : 'border-white/60 bg-white/72 shadow-[0_12rpx_32rpx_rgba(39,105,180,0.08)] backdrop-blur-8rpx',
            ]"
            :style="isRecruitmentCategoryActive(item.value) ? { background: item.activeGradient, boxShadow: item.activeGlow } : {}"
            role="button"
            :aria-pressed="isRecruitmentCategoryActive(item.value)"
            :aria-label="item.label"
            @tap="toggleRecruitmentCategory(item.value)"
          >
            <view
              class="h-58rpx w-58rpx flex flex-none items-center justify-center rounded-lg transition-colors duration-220"
              :class="isRecruitmentCategoryActive(item.value) ? 'bg-white/22' : 'bg-white/70'"
            >
              <image class="h-48rpx w-48rpx" :src="item.icon" mode="aspectFit" />
            </view>
            <text class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-700 leading-none" :class="isRecruitmentCategoryActive(item.value) ? 'text-white' : 'text-app-ink'">{{ item.label }}</text>
          </view>
        </view>

        <view class="mt-5">
          <view class="flex items-center justify-between gap-3">
            <view class="min-w-0 flex flex-1 items-center">
              <text class="overflow-hidden text-ellipsis whitespace-nowrap text-xl text-app-ink font-700 leading-none">{{ total }} 个职位</text>
              <view class="i-carbon-chevron-right ml-1.5 flex-none text-base text-app-ink-soft leading-none" />
            </view>
            <button
              id="position-filter-trigger"
              tabindex="0"
              class="m-0 h-72rpx flex flex-none cursor-pointer items-center border-2rpx rounded-xl border-solid px-3.5 py-0 text-sm font-650 leading-none transition-[transform,background-color,border-color,color] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-98 after:border-0 motion-reduce:transition-none"
              :class="hasAppliedFilters
                ? 'border-[#9ec5f5] bg-[#eaf3ff] text-brand-blue shadow-[0_8rpx_24rpx_rgba(47,111,232,0.14)] active:bg-[#dfeeff]'
                : 'border-transparent bg-white/92 text-app-ink shadow-[0_8rpx_24rpx_rgba(47,111,232,0.1)] active:bg-[#edf5ff]'"
              :aria-label="hasAppliedFilters ? '打开职位筛选，当前已有筛选条件' : '打开职位筛选'"
              @keydown="activateButtonWithKeyboard"
              @tap="openFilter"
            >
              <view class="i-carbon-filter mr-1.5 text-sm leading-none" aria-hidden="true" />
              <text>筛选</text>
              <view class="i-carbon-chevron-down ml-1 text-xs leading-none opacity-65" aria-hidden="true" />
            </button>
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
      <view id="position-kind-scroll-content" class="box-border h-92rpx min-w-full grid grid-flow-col auto-cols-[minmax(120rpx,max-content)] justify-start px-3">
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
              <text class="ml-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-app-ink-soft">
                {{ job.publisherName || '招聘团队' }}
              </text>
            </view>
            <text class="ml-3 flex-none text-xs text-app-muted">{{ job.location }}</text>
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

    <!-- #ifdef MP-WEIXIN -->
    <page-container
      :show="showFilter"
      :duration="0"
      :overlay="false"
      @beforeleave="closeFilter"
    />
    <!-- #endif -->

    <view
      v-if="showFilter"
      id="position-filter-dialog"
      class="fixed inset-0 z-[1100] flex flex-col overflow-hidden bg-[#f4f8fd]"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="position-filter-title"
      @keydown="handleFilterDialogKeydown"
    >
      <view class="flex-none bg-white/96 shadow-[0_8rpx_24rpx_rgba(39,74,125,0.07)]" :style="{ paddingTop: `${statusBarHeight}px` }">
        <view class="grid grid-cols-[88rpx_1fr_88rpx] h-96rpx items-center px-2">
          <button
            tabindex="0"
            class="m-0 h-80rpx w-80rpx flex cursor-pointer items-center justify-center rounded-full bg-transparent p-0 text-app-ink leading-none transition-colors duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] after:border-0 active:bg-[#edf3fa] motion-reduce:transition-none"
            aria-label="关闭筛选面板"
            @keydown="activateButtonWithKeyboard"
            @tap="closeFilter"
          >
            <view class="i-carbon-close text-xl leading-none" aria-hidden="true" />
          </button>
          <text id="position-filter-title" class="text-center text-lg text-app-ink font-700 tracking-1rpx">筛选职位</text>
          <text v-if="draftFilterCount" class="text-center text-xs text-brand-blue font-650">{{ draftFilterCount }} 项</text>
          <view v-else />
        </view>
      </view>

      <scroll-view class="box-border min-h-0 w-full flex-1" scroll-y :show-scrollbar="false">
        <view class="px-4 pb-8 pt-5">
          <view>
            <view
              v-for="section in filterSections"
              :key="section.key"
              class="mb-7"
            >
              <text class="mb-3 block text-sm text-app-ink font-650">{{ section.label }}</text>
              <view v-if="section.options.length" class="grid grid-cols-3 gap-2">
                <button
                  v-for="option in section.options"
                  :key="option.value"
                  tabindex="0"
                  class="m-0 box-border min-h-84rpx min-w-0 flex cursor-pointer items-center justify-center rounded-xl px-2 py-2 text-center text-xs leading-none transition-[transform,background-color,color] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-98 after:border-0 motion-reduce:transition-none"
                  :class="selectedFilters[section.key].includes(option.value)
                    ? 'bg-[#e5f1ff] text-brand-blue font-650 shadow-[inset_0_0_0_2rpx_rgba(47,111,232,0.42)]'
                    : 'bg-white text-app-ink-soft shadow-[0_6rpx_20rpx_rgba(39,74,125,0.055)]'"
                  role="checkbox"
                  :aria-checked="selectedFilters[section.key].includes(option.value)"
                  :aria-label="option.label"
                  @keydown="activateButtonWithKeyboard"
                  @tap="toggleFilter(section.key, option.value)"
                >
                  <text class="max-w-full break-words leading-snug">{{ option.label }}</text>
                </button>
              </view>
              <text v-else class="block rounded-xl bg-white px-3 py-4 text-xs text-app-muted">暂无可选条件</text>
            </view>
          </view>

          <view class="mb-8">
            <view class="mb-3">
              <text class="block text-base text-app-ink font-700">工作地点</text>
            </view>

            <view v-if="filterOptionsLoading" class="flex flex-col gap-2" aria-label="工作地点加载中">
              <view v-for="index in 3" :key="index" class="h-92rpx animate-pulse rounded-2xl bg-[#e7edf5] motion-reduce:animate-none" />
            </view>
            <button
              v-else-if="filterOptionsFailed"
              tabindex="0"
              class="m-0 min-h-176rpx w-full flex flex-col cursor-pointer items-center justify-center rounded-2xl bg-white px-4 py-0 text-center leading-none shadow-[0_8rpx_26rpx_rgba(39,74,125,0.06)] after:border-0 active:opacity-72"
              aria-label="重新加载工作地点"
              @keydown="activateButtonWithKeyboard"
              @tap="loadFilterOptions"
            >
              <text class="text-sm text-app-ink-soft">工作地点加载失败</text>
              <text class="mt-1.5 text-xs text-brand-blue font-650">点击重新加载</text>
            </button>
            <view v-else-if="!hasLocationOptions" class="min-h-176rpx flex items-center justify-center rounded-2xl bg-white px-4 text-sm text-app-muted">
              暂无可选工作地点
            </view>
            <PositionLocationFilter
              v-else
              :options="filterOptions.locations"
              :model-value="selectedFilters.locIds"
              @update:model-value="updateSelectedLocations"
            />
          </view>
        </view>
      </scroll-view>

      <view class="flex-none bg-white px-4 pt-3 shadow-[0_-10rpx_30rpx_rgba(31,63,108,0.08)] pb-safe">
        <view class="flex gap-3 pb-3">
          <button
            tabindex="0"
            class="m-0 h-96rpx min-w-0 flex flex-[0.72] items-center justify-center rounded-2xl bg-white p-0 text-sm text-app-ink-soft font-700 leading-none shadow-[inset_0_0_0_1rpx_#d9e3ef] active:scale-98 after:border-0 active:bg-[#f3f6fa]"
            aria-label="重置筛选条件"
            @keydown="activateButtonWithKeyboard"
            @tap="resetFilters"
          >
            重置
          </button>
          <button
            tabindex="0"
            class="m-0 h-96rpx min-w-0 flex flex-[1.45] items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2f6fe8_0%,#438fea_100%)] p-0 text-sm text-white font-700 leading-none shadow-[0_12rpx_28rpx_rgba(47,111,232,0.24)] transition-transform duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-98 after:border-0 motion-reduce:transition-none"
            :aria-label="`确定筛选，已选择 ${draftFilterCount} 项`"
            @keydown="activateButtonWithKeyboard"
            @tap="applyFilters"
          >
            <text>确定</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>
