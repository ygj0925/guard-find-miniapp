<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { getPositionFilterOptions, getPositions, type PositionFilterOptions, type PositionListItem } from '@/api/position'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { tabbarStore } from '@/tabbar/store'
import PositionSearchBar from './components/PositionSearchBar.vue'

defineOptions({
  name: 'Position',
})

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '职位',
    navigationBarBackgroundColor: '#2F80ED',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F7FA',
    backgroundColorTop: '#2F80ED',
    backgroundColorBottom: '#F5F7FA',
  },
})

const POSITION_PATH = '/pages/position/index'
const HEADER_SEARCH_THRESHOLD = uni.upx2px(104)
const BACK_TO_TOP_ENTER_THRESHOLD = uni.upx2px(760)
const BACK_TO_TOP_EXIT_THRESHOLD = uni.upx2px(32)

const headerScrolled = ref(false)
const currentScrollTop = ref(0)
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
const quickLinks = [
  { label: '附近机会', description: '发现身边好工作', icon: 'i-carbon-location-company', colorClass: 'text-[#26b8bd]' },
  { label: '热门职位', description: '精选高匹配岗位', icon: 'i-carbon-fire', colorClass: 'text-[#ff805c]' },
]

let statusBarHeight = 0
try {
  statusBarHeight = uni.getWindowInfo?.().statusBarHeight || uni.getSystemInfoSync().statusBarHeight || 0
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

function syncScrollState(scrollTop: number) {
  currentScrollTop.value = scrollTop
  headerScrolled.value = scrollTop >= HEADER_SEARCH_THRESHOLD

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

function formatSalary(job: PositionListItem) {
  if (job.salaryMin == null && job.salaryMax == null) return job.salaryUnit || '面议'
  const toK = (salary?: number) => salary == null ? '' : `${Math.round(salary / 1000)}K`
  return job.salaryMin != null && job.salaryMax != null ? `${toK(job.salaryMin)}-${toK(job.salaryMax)}` : toK(job.salaryMin ?? job.salaryMax)
}

async function loadPositions(reset = false) {
  if (loading.value || (!reset && !hasMore.value)) return
  loading.value = true
  const nextPageNum = reset ? 1 : pageNum.value + 1
  try {
    const page = await getPositions({
      pageNum: nextPageNum,
      pageSize: PAGE_SIZE,
      kinds: activeKind.value ? [Number(activeKind.value)] : undefined,
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
  activeKind.value = kind
  loadPositions(true)
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
})

onLoad(async () => {
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
  <view class="app-tab-page bg-[#f5f7fa] font-[Noto_Sans_SC,Microsoft_YaHei,sans-serif]" :style="pageStyle">
    <view class="relative overflow-hidden bg-position-hero">
      <AppPageHeader
        title="职位"
        light
        transparent
        center-wide
        :scrolled="headerScrolled"
        scrolled-background="var(--app-header-surface, rgba(255,255,255,0.98))"
      >
        <template #center>
          <PositionSearchBar v-if="headerScrolled" compact @tap="showFilter = true" />
          <text v-else class="block text-center text-lg text-white font-700 leading-none tracking-1rpx">职位</text>
        </template>
      </AppPageHeader>

      <view class="relative z-1 px-4 pb-5 pt-3">
        <PositionSearchBar @tap="showFilter = true" />

        <view class="grid grid-cols-2 mt-4 overflow-hidden border-1rpx border-white/60 rounded-3xl border-solid bg-white/72 shadow-[0_12rpx_32rpx_rgba(39,105,180,0.08)] backdrop-blur-8rpx">
          <view
            v-for="(link, index) in quickLinks"
            :key="link.label"
            class="min-h-28 flex cursor-pointer items-center px-4 active:bg-white/72"
            :class="index === 0 ? 'border-r-1rpx border-r-white/76 border-r-solid' : ''"
            role="button"
            @tap="showFilter = true"
          >
            <view class="mr-3 text-3xl leading-none" :class="[link.icon, link.colorClass]" />
            <view class="min-w-0 flex flex-1 flex-col">
              <text class="text-sm text-[#1d2939] font-700">{{ link.label }}</text>
              <text class="mt-1 block text-xs text-[#7d899a]">{{ link.description }}</text>
            </view>
          </view>
        </view>

        <view class="mt-5 flex items-end">
          <text class="text-xl text-[#17233d] font-700 leading-none">{{ total ? `${total} 个职位` : '职位推荐' }}</text>
          <view class="mb-1 ml-2 h-2 w-2 rotate-45 border-b-3rpx border-r-3rpx border-[#4b5c70] border-solid" />
        </view>
      </view>
    </view>

    <scroll-view class="sticky top-[var(--position-header-offset)] z-90 w-full whitespace-nowrap bg-[rgba(255,255,255,0.98)] shadow-[0_8rpx_24rpx_rgba(38,64,105,0.06)]" scroll-x :show-scrollbar="false">
      <view class="inline-flex items-center px-3 py-3">
        <view
          v-for="category in categories"
          :key="category.value || 'recommended'"
          class="relative min-w-120rpx flex flex-col cursor-pointer items-center px-3 pb-2 pt-1 text-sm text-[#667085] font-600 active:opacity-72"
          :class="activeKind === category.value ? 'text-brand-blue' : ''"
          role="button"
          @tap="handleCategoryTap(category.value)"
        >
          <view
            class="mb-2 h-68rpx w-68rpx flex items-center justify-center rounded-2xl text-xl leading-none"
            :class="activeKind === category.value ? 'bg-[#e3f3ff] text-brand-blue' : 'bg-[#f0f2f5] text-[#687386]'"
          >
            <view class="i-carbon-portfolio" />
          </view>
          <text>{{ category.label }}</text>
          <view v-if="activeKind === category.value" class="absolute bottom-0 h-5rpx w-34rpx rounded-full bg-brand-blue" />
        </view>
      </view>
    </scroll-view>

    <view class="px-3 pb-6 pt-3">
      <view class="mb-3 flex items-center justify-between rounded-2xl bg-white px-4 py-4 shadow-[0_8rpx_24rpx_rgba(38,64,105,0.05)]">
        <view class="min-w-0 flex flex-1 items-center">
          <text class="text-base text-[#1d2939] font-700">职位定制</text>
          <text class="ml-2 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#98a2b3]">找工作无需大海捞针</text>
        </view>
        <view class="ml-3 h-68rpx flex cursor-pointer items-center justify-center border-1rpx border-brand-blue rounded-full border-solid px-4 text-sm text-brand-blue font-600 active:opacity-70">
          添加意向
        </view>
      </view>

      <view class="flex flex-col gap-3">
        <view
          v-for="job in jobs"
          :key="job.positionId"
          class="cursor-pointer rounded-2xl bg-white px-4 py-4 shadow-[0_8rpx_24rpx_rgba(38,64,105,0.05)] active:opacity-74"
          role="button"
          @tap="showJobDetail(job.positionId)"
        >
          <view class="flex items-start justify-between gap-3">
            <text class="min-w-0 flex-1 text-base text-[#1d2939] font-700 leading-[1.35]">{{ job.positionName }}</text>
            <text class="flex-none text-sm text-brand-blue font-700">{{ formatSalary(job) }}</text>
          </view>
          <text class="mt-2 block text-xs text-[#667085]">{{ job.location }} · {{ job.edu }} · {{ job.experience }}</text>
          <view class="mt-3 flex flex-wrap gap-2">
            <text v-for="tag in job.tags" :key="tag" class="rounded-lg bg-[#f2f4f7] px-2 py-1 text-xs text-[#667085]">{{ tag }}</text>
          </view>
          <view class="mt-3 flex items-center justify-between border-t-1rpx border-t-[#f1f3f6] border-t-solid pt-3">
            <view class="flex items-center">
              <view class="h-42rpx w-42rpx flex items-center justify-center rounded-full bg-[#e9f3ff] text-sm text-brand-blue leading-none">
                <view class="i-carbon-user-avatar" />
              </view>
              <text class="ml-2 text-xs text-[#475467]">招聘团队 · 简历直投</text>
            </view>
            <text class="ml-3 text-xs text-[#98a2b3]">{{ job.location }}</text>
          </view>
        </view>
      </view>
      <view v-if="!loading && !jobs.length" class="py-16 text-center text-sm text-[#98a2b3]">暂无符合条件的职位</view>
      <view v-if="loading" class="py-8 text-center text-sm text-[#98a2b3]">职位加载中...</view>
      <view v-else-if="jobs.length && !hasMore" class="py-8 text-center text-xs text-[#98a2b3]">没有更多职位了</view>
    </view>

    <view v-if="showFilter" class="fixed inset-0 z-200 flex items-end bg-black/45" @tap.self="showFilter = false">
      <view class="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pt-5 pb-safe">
        <view class="mb-5 flex items-center justify-between"><text class="text-lg text-[#17233d] font-700">筛选职位</text><text class="text-sm text-[#667085]" @tap="showFilter = false">关闭</text></view>
        <view v-for="section in [{ key: 'educationInfos', label: '学历要求', options: filterOptions.educationInfos }, { key: 'workExperiences', label: '工作经验', options: filterOptions.workExperiences }, { key: 'locIds', label: '工作地点', options: filterOptions.locations }]" :key="section.key" class="mb-5">
          <text class="mb-3 block text-sm text-[#344054] font-700">{{ section.label }}</text>
          <view class="flex flex-wrap gap-2"><text v-for="option in section.options" :key="option.value" class="rounded-lg px-3 py-2 text-xs" :class="selectedFilters[section.key as 'educationInfos' | 'workExperiences' | 'locIds'].includes(option.value) ? 'bg-[#e3f3ff] text-brand-blue' : 'bg-[#f2f4f7] text-[#667085]'" @tap="toggleFilter(section.key as 'educationInfos' | 'workExperiences' | 'locIds', option.value)">{{ option.label }}</text></view>
        </view>
        <view class="flex gap-3 border-t-1rpx border-[#edf0f4] border-solid py-3"><button class="flex-1 border-0 bg-[#f2f4f7] text-sm text-[#475467]" @tap="resetFilters">重置</button><button class="flex-1 border-0 bg-brand-blue text-sm text-white" @tap="applyFilters">确定</button></view>
      </view>
    </view>
  </view>
</template>
