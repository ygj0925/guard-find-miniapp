<script setup lang="ts">
import type { Property } from '@/api/property'
import type { HomeBanner, PropertyHome } from '@/api/propertyHome'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { fetchProperties, fetchRegionTree, PROPERTY_TYPE_LABEL } from '@/api/property'
import { fetchPropertyHome } from '@/api/propertyHome'
import PropertyCard from '@/components/PropertyCard.vue'
import { useTokenStore } from '@/store/token'
import { refreshMessageBadge } from '@/utils/messageBadge'
import { buildPropertyFilters, defaultPropertyFilters } from '@/utils/propertyFilters'
import { toLoginPage } from '@/utils/toLoginPage'
import HomeBanners from '@/components/HomeBanners.vue'
import HomeShortcuts from '@/components/HomeShortcuts.vue'
import CityPickerOverlay from '@/components/CityPickerOverlay.vue'
import { regionCityNames } from '@/utils/regions'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '上海泊之湾公寓', backgroundColor: '#F5F7FF', enablePullDownRefresh: true } })
const PAGE_SIZE = 10
const headerScrolled = ref(false)
onPageScroll(({ scrollTop }) => {
  const scrolled = scrollTop > 8
  if (headerScrolled.value !== scrolled)
    headerScrolled.value = scrolled
})
const draft = reactive(defaultPropertyFilters())
const applied = ref(buildPropertyFilters(draft))
const filterOpen = ref(false)
const filterError = ref('')
const items = ref<Property[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref(false)
const home = ref<PropertyHome>({ supportPhone: null, serviceHours: null, banners: [], activities: [] })
const homeError = ref(false)
const cities = ref<string[]>(['不限城市'])
const cityPickerOpen = ref(false)
const cityHistory = ref<string[]>([])
const detectedCity = ref('')
const locationResolved = ref(false)
const locationLoading = ref(false)
const cityLabel = computed(() => {
  const city = draft.city || detectedCity.value || '上海市'
  return `${city.replace(/市$/, '')} · 全市`
})
const cityDisplay = computed(() => draft.city || detectedCity.value || '全国')
type HomeTypeKey = 'whole' | 'room' | 'short' | 'apartment'
const TYPE_TABS: { key: HomeTypeKey, label: string }[] = [
  { key: 'whole', label: '整套' },
  { key: 'room', label: '单间' },
  { key: 'short', label: '民宿' },
  { key: 'apartment', label: '公寓' },
]
const PRICE_TABS = [{ key: 'all' as const, label: '全部租售' }, { key: 'rent' as const, label: '出租' }, { key: 'sale' as const, label: '出售' }]
const MODE_TABS = [
  { key: 'all' as const, label: '全部租赁方式' },
  { key: 'whole' as const, label: '整租' },
  { key: 'shared' as const, label: '合租' },
  { key: 'room' as const, label: '单间' },
  { key: 'short' as const, label: '民宿短租' },
]
const UNIT_TABS = [{ key: 'all' as const, label: '全部计价' }, { key: 'month' as const, label: '月租' }, { key: 'day' as const, label: '日租' }]
const SORT_TABS = [{ key: 'newest' as const, label: '最新发布' }, { key: 'priceAsc' as const, label: '价格从低到高' }, { key: 'priceDesc' as const, label: '价格从高到低' }]
const priceIndex = computed(() => PRICE_TABS.findIndex(t => t.key === draft.priceType))
const modeIndex = computed(() => MODE_TABS.findIndex(t => t.key === draft.rentalMode))
const unitIndex = computed(() => UNIT_TABS.findIndex(t => t.key === draft.priceUnit))
const sortIndex = computed(() => SORT_TABS.findIndex(t => t.key === draft.sort))
const sortButtonLabel = computed(() => draft.sort === 'newest' ? '租金从低到高' : SORT_TABS[sortIndex.value].label)
const hasFilters = computed(() => Object.entries(applied.value).some(([key, value]) => key === 'sort' ? value !== 'newest' : value !== undefined))

function readCityHistory() {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function')
    return
  const stored = uni.getStorageSync('guard-find-city-history')
  if (Array.isArray(stored))
    cityHistory.value = stored.filter((city): city is string => typeof city === 'string').slice(0, 6)
}

function saveCityHistory(city: string) {
  const next = [city, ...cityHistory.value.filter(item => item !== city)].slice(0, 6)
  cityHistory.value = next
  if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function')
    uni.setStorageSync('guard-find-city-history', next)
}

function requestLocation() {
  if (locationLoading.value || typeof uni === 'undefined' || typeof uni.getLocation !== 'function')
    return
  locationLoading.value = true
  uni.getLocation({
    type: 'gcj02',
    isHighAccuracy: true,
    success: () => {
      locationResolved.value = true
      detectedCity.value = draft.city || '上海市'
      uni.showToast({ title: '定位成功', icon: 'success' })
    },
    fail: () => {
      locationResolved.value = false
    },
    complete: () => {
      locationLoading.value = false
    },
  })
}

function openCityPicker() {
  cityPickerOpen.value = true
}

function closeCityPicker() {
  cityPickerOpen.value = false
}

function chooseCity(city: string) {
  draft.city = city
  detectedCity.value = city
  locationResolved.value = false
  saveCityHistory(city)
  cityPickerOpen.value = false
  applyFilters()
}

function selectCityCompat(event: { detail: { value: string | number } }) {
  const city = Number(event.detail.value) === 0 ? '' : cities.value[Number(event.detail.value)]
  if (city)
    chooseCity(city)
}
let generation = 0
let homeVersion = 0
let disposed = false
let firstShow = true
onUnload(() => {
  disposed = true
  generation++
  homeVersion++
})
onShareAppMessage(() => ({ title: `${import.meta.env.VITE_APP_TITLE} · 精选房源`, path: '/pages/index/index' }))
onShareTimeline(() => ({ title: `${import.meta.env.VITE_APP_TITLE} · 精选房源` }))

async function load(targetPage: number, mode: 'initial' | 'more' = 'initial') {
  if (mode === 'more' && (loading.value || loadingMore.value))
    return
  const current = ++generation
  error.value = false
  loadingMore.value = mode === 'more'
  loading.value = mode === 'initial'
  if (mode === 'initial') {
    items.value = []
    total.value = 0
  }
  try {
    const resp = await fetchProperties({ page: targetPage, size: PAGE_SIZE, ...applied.value })
    if (current !== generation)
      return
    items.value = mode === 'more' ? [...items.value, ...resp.list] : resp.list
    total.value = resp.total
    page.value = targetPage
  }
  catch {
    if (current === generation)
      error.value = true
  }
  finally {
    if (current === generation) {
      loading.value = false
      loadingMore.value = false
    }
  }
}
async function loadHome() {
  const current = ++homeVersion
  homeError.value = false
  try {
    const result = await fetchPropertyHome()
    if (current === homeVersion)
      home.value = result
  }
  catch {
    if (current === homeVersion)
      homeError.value = true
  }
}
async function loadCities() {
  try {
    const tree = await fetchRegionTree()
    const names = regionCityNames(tree)
    if (!disposed)
      cities.value = ['不限城市', ...new Set(names)]
  }
  catch {}
}
function applyFilters() {
  try {
    applied.value = buildPropertyFilters(draft)
    filterError.value = ''
    void load(1)
  }
  catch (err) {
    filterError.value = err instanceof Error ? err.message : '筛选条件无效'
    filterOpen.value = true
  }
}
function isTypeActive(key: HomeTypeKey) {
  if (key === 'whole')
    return draft.propertyType === 'all' && draft.rentalMode === 'all'
  if (key === 'apartment')
    return draft.propertyType === 'apartment'
  return draft.propertyType === 'all' && draft.rentalMode === key
}
function selectType(key: HomeTypeKey) {
  const city = draft.city
  Object.assign(draft, defaultPropertyFilters(), { city, priceType: 'rent' })
  if (key === 'apartment') {
    draft.propertyType = 'apartment'
    draft.rentalMode = 'all'
    draft.priceUnit = 'month'
  }
  else {
    draft.rentalMode = key
    draft.priceUnit = key === 'short' ? 'day' : 'month'
  }
  applyFilters()
}
function selectPrice(event: { detail: { value: string | number } }) {
  draft.priceType = PRICE_TABS[Number(event.detail.value)].key
  draft.rentalMode = 'all'
  draft.priceUnit = 'all'
  draft.minPrice = ''
  draft.maxPrice = ''
  applyFilters()
}
function selectMode(event: { detail: { value: string | number } }) {
  draft.rentalMode = MODE_TABS[Number(event.detail.value)].key
  draft.priceUnit = draft.rentalMode === 'short' ? 'day' : draft.rentalMode === 'all' ? 'all' : 'month'
  draft.minPrice = ''
  draft.maxPrice = ''
  applyFilters()
}
function selectUnit(event: { detail: { value: string | number } }) {
  draft.priceUnit = UNIT_TABS[Number(event.detail.value)].key
  draft.rentalMode = 'all'
  draft.minPrice = ''
  draft.maxPrice = ''
  applyFilters()
}
function selectSort(event: { detail: { value: string | number } }) {
  draft.sort = SORT_TABS[Number(event.detail.value)].key
  applyFilters()
}
function clearFilters() {
  Object.assign(draft, defaultPropertyFilters())
  applyFilters()
}
function scrollToProperties() {
  uni.pageScrollTo({ selector: '#property-results', duration: 300 })
}
function openChat() {
  if (!useTokenStore().updateNowTime().hasLogin) {
    toLoginPage()
    return
  }
  uni.navigateTo({ url: '/pages/message/chat?mode=support' })
}
function phone() {
  if (homeError.value) {
    uni.showToast({ title: '咨询信息加载失败，请重试', icon: 'none' })
    void loadHome()
    return
  }
  if (home.value.supportPhone) {
    uni.makePhoneCall({ phoneNumber: home.value.supportPhone })
    return
  }
  uni.showModal({ title: '电话暂未配置', content: '可以通过在线咨询联系公寓管家。', confirmText: '在线咨询', success: (r) => {
    if (r.confirm)
      openChat()
  } })
}
function shortcut(key: string) {
  if (key === 'map') {
    uni.navigateTo({ url: `/pages/property/map?city=${encodeURIComponent(draft.city || '')}` })
    return
  }
  if (key === 'phone') {
    phone()
    return
  }
  if (key === 'chat') {
    openChat()
    return
  }
  if (key === 'support') {
    uni.navigateTo({ url: '/pages/message/support' })
    return
  }
  if (key === 'activities') {
    uni.navigateTo({ url: '/pages/property/activities' })
    return
  }
  const city = draft.city
  Object.assign(draft, defaultPropertyFilters(), { city })
  if (key === 'recommended') {
    draft.recommended = true
  }
  else if (key === 'apartment') {
    draft.propertyType = 'apartment'
    draft.priceType = 'rent'
  }
  else if (key === 'whole' || key === 'room' || key === 'short') {
    draft.priceType = 'rent'
    draft.rentalMode = key
    draft.priceUnit = key === 'short' ? 'day' : 'month'
  }
  applyFilters()
  scrollToProperties()
}
function bannerTarget(banner: HomeBanner) {
  if (banner.targetType === 'property' && banner.targetId)
    uni.navigateTo({ url: `/pages/property/detail?id=${encodeURIComponent(banner.targetId)}` })
  else if (banner.targetType === 'activity' && banner.targetId)
    uni.navigateTo({ url: `/pages/property/activities?id=${encodeURIComponent(banner.targetId)}` })
  else shortcut(banner.targetType)
}
function favoriteChanged(id: Property['id'], favorited: boolean) {
  items.value = items.value.map(item => item.id === id ? { ...item, isFavorited: favorited } : item)
}
onLoad(() => {
  readCityHistory()
  requestLocation()
  void load(1)
  void loadHome()
  void loadCities()
})
onShow(() => {
  void refreshMessageBadge()
  if (firstShow) {
    firstShow = false
    return
  }
  void load(1)
  void loadHome()
})
onPullDownRefresh(() => {
  Promise.all([load(1), loadHome()]).finally(() => uni.stopPullDownRefresh())
})
onReachBottom(() => {
  if (!error.value && items.value.length < total.value && !loadingMore.value)
    void load(page.value + 1, 'more')
})
</script>

<template>
  <view class="home-page app-tab-page">
    <view class="home-header-slot">
      <view class="home-sticky-header" :class="{ 'is-scrolled': headerScrolled }">
        <view class="home-header-content">
          <view class="home-heading">
            <view class="brand-block">
              <text class="brand-name">{{ headerScrolled ? '全部房源' : '泊之湾' }}</text>
              <text v-if="!headerScrolled" class="home-header-slogan">投一处，安心住下。</text>
            </view>
          </view>
          <view class="home-toolbar">
            <view class="heading-actions">
              <picker class="city-picker-compat" :range="cities" :value="Math.max(0, cities.indexOf(draft.city))" @change="selectCityCompat" />
              <button class="city-button app-tap" aria-label="选择城市" @tap="openCityPicker">
                <view class="i-carbon-location text-5" aria-hidden="true" /><text class="city-label">{{ cityDisplay }}</text><view class="i-carbon-chevron-down text-3" aria-hidden="true" />
              </button>
              <button class="heading-chat app-tap" aria-label="在线咨询公寓管家" @tap="openChat">
                <view class="i-carbon-chat text-7" aria-hidden="true" />
              </button>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view class="home-content">
      <view class="search-box">
        <view class="i-carbon-search shrink-0 text-7 text-#6454ff" aria-hidden="true" />
        <input v-model="draft.keyword" class="search-input min-w-0 flex-1" placeholder="搜索小区、地铁、商圈或地址" aria-label="房源关键词" :maxlength="64" confirm-type="search" @confirm="applyFilters">
        <button class="search-button app-tap" :loading="loading" aria-label="搜索房源" @tap="applyFilters">
          <view class="i-carbon-search text-5" aria-hidden="true" /><text class="search-button-label">搜索</text>
        </button>
      </view>
      <view class="secondary-home-content">
        <text class="secondary-title">更多服务</text>
        <HomeShortcuts @select="shortcut" />
        <HomeBanners :banners="home.banners" @select="bannerTarget" />
        <view v-if="homeError" class="home-error">
          <text>运营信息加载失败，不影响浏览房源</text><button class="retry-button app-tap" @tap="loadHome">
            重试
          </button>
        </view>
      </view>
      <view id="property-results" class="type-tabs">
        <button v-for="tab in TYPE_TABS" :key="tab.key" class="type-tab app-tap" :class="isTypeActive(tab.key) ? 'type-active' : ''" :aria-pressed="isTypeActive(tab.key)" @tap="selectType(tab.key)">
          {{ tab.label }}
        </button>
      </view>
      <view class="filter-slot" :class="{ 'is-sticky': headerScrolled }">
        <view class="filter-area" :class="{ 'is-sticky': headerScrolled }">
          <view class="filter-row">
            <button class="filter-compat" aria-hidden="true" @tap="filterOpen = !filterOpen">
              城市 · 价格区间
            </button>
            <button class="filter-button app-tap" :aria-expanded="filterOpen" aria-label="选择城市" @tap="openCityPicker">
              <view class="i-carbon-location text-5" aria-hidden="true" /><text class="filter-city-label">{{ cityLabel }}</text><view :class="filterOpen ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" class="filter-toggle-icon ml-auto shrink-0 text-4" aria-label="展开筛选" @tap.stop="filterOpen = !filterOpen" />
            </button>
            <picker class="min-w-0 flex-1" :range="SORT_TABS" range-key="label" :value="sortIndex" @change="selectSort">
              <view class="filter-button" role="button" aria-label="选择房源排序">
                <view class="i-carbon-grid text-5" aria-hidden="true" /><text class="truncate">{{ sortButtonLabel }}</text><view class="i-carbon-chevron-down ml-auto shrink-0 text-4" />
              </view>
            </picker>
          </view>
          <view v-if="filterOpen" class="filter-panel app-panel p-4">
            <view class="grid grid-cols-2 gap-3">
              <picker :range="PRICE_TABS" range-key="label" :value="priceIndex" @change="selectPrice">
                <view class="panel-picker" role="button" aria-label="选择租售类型">
                  {{ PRICE_TABS[priceIndex].label }}<view class="i-carbon-chevron-down" />
                </view>
              </picker>
              <picker v-if="draft.priceType === 'rent'" :range="MODE_TABS" range-key="label" :value="modeIndex" @change="selectMode">
                <view class="panel-picker" role="button" aria-label="选择租赁方式">
                  {{ MODE_TABS[modeIndex].label }}<view class="i-carbon-chevron-down" />
                </view>
              </picker>
              <picker v-if="draft.priceType === 'rent'" :range="UNIT_TABS" range-key="label" :value="unitIndex" @change="selectUnit">
                <view class="panel-picker" role="button" aria-label="选择计价单位">
                  {{ UNIT_TABS[unitIndex].label }}<view class="i-carbon-chevron-down" />
                </view>
              </picker>
            </view>
            <text class="mt-3 block text-sm font-600">城市</text><input v-model="draft.city" class="panel-input" placeholder="不限城市，如上海市" aria-label="城市筛选" :maxlength="50" confirm-type="search" @confirm="applyFilters">
            <text class="mt-4 block text-sm font-600">价格区间（元）</text><text class="mt-1 block text-xs text-app-muted">按房源标价筛选，可先选择月租或日租；出售为总价。</text>
            <view class="grid grid-cols-2 mt-3 gap-3">
              <view class="min-w-0">
                <text class="text-xs text-app-muted">最低价格</text><input v-model="draft.minPrice" type="digit" class="panel-input" placeholder="不限" aria-label="最低价格" :maxlength="13">
              </view>
              <view class="min-w-0">
                <text class="text-xs text-app-muted">最高价格</text><input v-model="draft.maxPrice" type="digit" class="panel-input" placeholder="不限" aria-label="最高价格" :maxlength="13">
              </view>
            </view>
            <text v-if="filterError" class="mt-3 block text-sm text-app-danger" role="alert">{{ filterError }}</text>
            <view class="mt-4 flex gap-3">
              <button class="app-secondary-button min-w-0 flex-1" @tap="clearFilters">
                重置
              </button><button class="app-primary-button min-w-0 flex-1" :loading="loading" @tap="applyFilters">
                应用筛选
              </button>
            </view>
          </view>
        </view>
      </view>
      <view v-if="hasFilters" class="active-filters">
        <text class="min-w-0 flex-1 break-words">{{ [applied.recommended && '运营推荐', applied.propertyType && PROPERTY_TYPE_LABEL[applied.propertyType], applied.city, applied.keyword, applied.priceUnit === 'day' && '日租', applied.priceUnit === 'month' && '月租'].filter(Boolean).join(' · ') || '已筛选房源' }}</text>
        <button class="reset-filter-button app-tap" @tap="clearFilters">
          重置筛选
        </button>
      </view>
      <view v-if="!loading && !error && items.length" class="result-summary" aria-live="polite">
        <text>为你找到</text><text class="result-count">{{ total }}</text><text>套房源</text>
      </view>
      <view v-if="loading" class="property-list" aria-label="正在加载房源">
        <view v-for="n in 2" :key="n" class="skeleton-card">
          <view class="skeleton-image" /><view class="min-w-0 flex-1">
            <view class="skeleton-line w-4/5" /><view class="skeleton-line mt-4 w-3/5" /><view class="skeleton-line mt-4 w-1/2" />
          </view>
        </view>
      </view>
      <view v-else-if="error && !items.length" class="app-state">
        <view class="i-carbon-cloud-offline text-8" /><text>房源加载失败，请稍后重试</text><button class="app-secondary-button" @tap="load(1)">
          重新加载
        </button>
      </view>
      <template v-else>
        <view v-if="items.length" class="property-list">
          <PropertyCard v-for="item in items" :key="item.id" :item="item" @favorite="favoriteChanged" />
        </view>
        <view v-else class="app-state">
          <view class="i-carbon-home text-8" /><text>{{ hasFilters ? '没有找到符合条件的房源' : '房源还在准备中，稍后再来看看' }}</text><button v-if="hasFilters" class="app-secondary-button" @tap="clearFilters">
            查看全部房源
          </button>
        </view>
        <view v-if="error && items.length" class="app-state !py-4">
          <text>加载失败，已保留当前房源</text><button class="app-secondary-button" @tap="load(page + 1, 'more')">
            重试加载
          </button>
        </view>
        <text v-else-if="loadingMore" class="block py-5 text-center text-xs text-app-muted">正在加载更多…</text>
        <text v-else-if="items.length && items.length >= total" class="block py-5 text-center text-xs text-app-muted">已展示全部房源</text>
      </template>
      <button class="home-map-fab app-tap" aria-label="地图找房" @tap="shortcut('map')">
        <view class="i-carbon-location text-6" aria-hidden="true" /><text>地图找房</text>
      </button>
    </view>
    <CityPickerOverlay
      :open="cityPickerOpen"
      :cities="cities"
      :current-city="draft.city"
      :detected-city="detectedCity"
      :history="cityHistory"
      :location-loading="locationLoading"
      :location-resolved="locationResolved"
      @close="closeCityPicker"
      @select="chooseCity"
      @locate="requestLocation"
    />
  </view>
</template>

<style scoped>
.home-page {
  position: relative;
  box-sizing: border-box;
  overflow-x: hidden;
  min-height: calc(100vh + env(safe-area-inset-bottom));
  min-height: calc(var(--app-viewport-height, 100vh) + env(safe-area-inset-bottom));
  color: var(--app-ink);
  background: var(--app-home-hero-background);
}
.home-content {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 16px calc(126px + env(safe-area-inset-bottom));
}
.home-header-slot {
  height: calc(env(safe-area-inset-top) + 56px);
  min-height: 80px;
}
.home-sticky-header {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  box-sizing: border-box;
  z-index: 1000;
  height: calc(env(safe-area-inset-top) + 56px);
  min-height: 80px;
  padding: calc(var(--status-bar-height, 20px) + 4px) 16px 0;
  background: transparent;
  transition:
    background-color 180ms ease,
    box-shadow 180ms ease,
    backdrop-filter 180ms ease;
}
.home-sticky-header.is-scrolled {
  background: rgba(248, 250, 255, 0.98);
  box-shadow: 0 6px 18px rgba(54, 79, 144, 0.08);
}
.home-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 720px;
  margin: 0 auto;
}
.home-heading {
  min-width: 0;
}
.brand-block {
  max-width: 60%;
}
.brand-name {
  display: block;
  overflow: hidden;
  color: var(--app-ink);
  font-size: 21px;
  font-weight: 800;
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home-header-slogan {
  display: block;
  margin-top: 2px;
  color: var(--app-ink-soft);
  font-size: 12px;
  line-height: 18px;
}
.heading-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  width: auto;
}
.city-picker-compat {
  display: none;
}
.home-toolbar {
  flex-shrink: 0;
  display: block;
}
.city-button {
  display: flex;
  gap: 4px;
  align-items: center;
  min-height: 44px;
  padding: 0;
  border: 0;
  border-radius: 22px;
  background: transparent;
  color: #223967;
  max-width: 118px;
  font-size: 15px;
}
.city-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.heading-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  padding: 0;
  background: transparent;
  border-radius: 24px;
  color: #223967;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  margin-top: 22px;
  padding: 0 15px;
  border: 1px solid #edf1f8;
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 8px 20px rgba(61, 90, 163, 0.1);
}
.search-input {
  height: 52px;
  color: var(--app-ink);
  font-size: 15px;
}
.search-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  min-height: 42px;
  padding: 0;
  background: transparent;
  color: var(--app-brand-blue);
}
.search-button-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
}
.home-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  color: var(--app-muted);
  font-size: 11px;
}
.retry-button {
  min-height: 44px;
  padding: 0 8px;
  background: transparent;
  color: var(--app-brand-blue);
  font-size: 12px;
}
.type-tabs {
  display: flex;
  gap: 6px;
  margin-top: 24px;
  scroll-margin-top: 12px;
}
.type-tab {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 48px;
  padding: 0 4px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  color: #6d7c98;
  font-size: 15px;
  font-weight: 600;
  line-height: 48px;
}
.type-active {
  background: #e0e7ff;
  color: var(--app-brand-blue);
  box-shadow: inset 0 -3px 0 var(--app-brand-blue);
}
.filter-row {
  display: flex;
  gap: 10px;
  margin: 14px 0 16px;
}
.filter-slot {
  position: relative;
  z-index: 20;
}
.filter-slot.is-sticky {
  /* 固定层脱离文档流时保留原筛选行高度，避免滚动位置跳动。 */
  height: 78px;
}
.filter-area {
  position: relative;
  z-index: 20;
}
.filter-area.is-sticky {
  position: fixed;
  top: calc(var(--status-bar-height, 20px) + 56px);
  right: 0;
  left: 0;
  box-sizing: border-box;
  z-index: 90;
  width: 100%;
  padding: 8px 16px;
  border-bottom: 1px solid #e4ebf7;
  background: rgba(248, 250, 255, 0.98);
  box-shadow: 0 8px 18px rgba(54, 79, 144, 0.08);
}
.filter-area.is-sticky .filter-row {
  margin-top: 0;
  margin-bottom: 0;
}
.filter-compat {
  display: none;
}
.filter-button {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 5px;
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1px solid #e6ecf7;
  border-radius: 24px;
  background: #fff;
  color: #223967;
  font-size: 14px;
  line-height: 1.4;
  box-shadow: 0 4px 12px rgba(61, 90, 163, 0.06);
}
.filter-city-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.filter-panel {
  position: absolute;
  top: calc(100% - 4px);
  right: 0;
  left: 0;
  z-index: 30;
  max-height: min(64vh, 480px);
  margin: 0;
  overflow-y: auto;
  border: 1px solid var(--app-border);
  box-shadow: 0 16px 32px rgba(47, 78, 153, 0.14);
}
.panel-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 0 10px;
  border-radius: 12px;
  background: #f3f6fc;
  color: var(--app-ink);
  font-size: 13px;
}
.panel-input {
  box-sizing: border-box;
  width: 100%;
  height: 42px;
  margin-top: 6px;
  padding: 0 10px;
  border: 1px solid #e4ebf7;
  border-radius: 12px;
  background: #f8faff;
  color: var(--app-ink);
  font-size: 14px;
}
.active-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
  padding: 8px 2px;
  color: var(--app-muted);
  font-size: 12px;
}
.reset-filter-button {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 8px;
  background: transparent;
  color: var(--app-brand-blue);
  font-size: 12px;
}
.result-summary {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 6px 2px 10px;
  color: var(--app-muted);
  font-size: 12px;
}
.result-count {
  color: var(--app-ink);
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.property-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.skeleton-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 24px;
  background: #fff;
}
.skeleton-image {
  width: 34%;
  height: 118px;
  border-radius: 13px;
  background: #e8eefb;
}
.skeleton-line {
  height: 15px;
  border-radius: 5px;
  background: #e8eefb;
}
.home-map-fab {
  position: fixed;
  right: 20px;
  bottom: calc(var(--app-tabbar-height, 54px) + env(safe-area-inset-bottom) + 16px);
  z-index: 70;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 54px;
  padding: 0 22px;
  border: 0;
  border-radius: 30px;
  background: #5366f6;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(83, 102, 246, 0.24);
}
.secondary-home-content {
  margin-top: 20px;
  padding-top: 0;
}
.secondary-title {
  display: none;
}
/* 微信胶囊占据右上角，品牌留在左侧，操作按钮放到下一行。 */
/* #ifdef MP-WEIXIN */
.home-sticky-header {
  padding-top: calc(var(--status-bar-height, 20px) + 6px);
}
/* #endif */
@media (min-width: 420px) {
  .search-box {
    height: 58px;
  }
  .filter-button {
    font-size: 15px;
  }
}
</style>
