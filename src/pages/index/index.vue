<script setup lang="ts">
import type { Property, PropertyType } from '@/api/property'
import { fetchProperties, PROPERTY_TYPE_LABEL } from '@/api/property'

definePage({
  style: {
    navigationBarTitleText: '上海泊之湾公寓',
    backgroundColor: '#F7F8FA',
    enablePullDownRefresh: true,
  },
})

const PAGE_SIZE = 10
const city = ref('')
const filterType = ref<'all' | PropertyType>('all')
const filterPriceType = ref<'all' | 'rent' | 'sale'>('all')
const filterRentalMode = ref<'all' | 'whole' | 'shared'>('all')
const items = ref<Property[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref(false)
const failedImages = ref<(string | number)[]>([])
const TYPE_TABS: { key: 'all' | PropertyType, label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'house', label: '住宅' },
  { key: 'apartment', label: '公寓' },
  { key: 'villa', label: '别墅' },
  { key: 'shop', label: '商铺' },
]
const PRICE_TABS = [
  { key: 'all' as const, label: '全部租售' },
  { key: 'rent' as const, label: '出租' },
  { key: 'sale' as const, label: '出售' },
]
const MODE_TABS = [
  { key: 'all' as const, label: '全部租赁方式' },
  { key: 'whole' as const, label: '整租' },
  { key: 'shared' as const, label: '合租' },
]
const priceIndex = computed(() => PRICE_TABS.findIndex(t => t.key === filterPriceType.value))
const modeIndex = computed(() => MODE_TABS.findIndex(t => t.key === filterRentalMode.value))
const hasFilters = computed(() => Boolean(city.value.trim()) || filterType.value !== 'all' || filterPriceType.value !== 'all')

let generation = 0
onUnload(() => {
  generation++
})
async function load(targetPage: number, mode: 'initial' | 'more' = 'initial') {
  if (mode === 'more' && (loading.value || loadingMore.value))
    return
  const current = ++generation
  error.value = false
  mode === 'initial' ? (loading.value = true) : (loadingMore.value = true)
  if (mode === 'initial') {
    items.value = []
    total.value = 0
  }
  try {
    const resp = await fetchProperties({
      page: targetPage,
      size: PAGE_SIZE,
      city: city.value.trim() || undefined,
      propertyType: filterType.value !== 'all' ? filterType.value : undefined,
      priceType: filterPriceType.value !== 'all' ? filterPriceType.value : undefined,
      rentalMode: filterPriceType.value === 'rent' && filterRentalMode.value !== 'all' ? filterRentalMode.value : undefined,
    })
    if (current !== generation)
      return
    items.value = mode === 'more' ? [...items.value, ...resp.list] : resp.list
    total.value = resp.total
    page.value = targetPage
    if (mode === 'initial')
      failedImages.value = []
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

function selectType(key: 'all' | PropertyType) {
  filterType.value = key
  void load(1)
}
function selectPrice(event: { detail: { value: string | number } }) {
  filterPriceType.value = PRICE_TABS[Number(event.detail.value)].key
  filterRentalMode.value = 'all'
  void load(1)
}
function selectMode(event: { detail: { value: string | number } }) {
  filterRentalMode.value = MODE_TABS[Number(event.detail.value)].key
  void load(1)
}
function clearFilters() {
  city.value = ''
  filterType.value = 'all'
  filterPriceType.value = 'all'
  filterRentalMode.value = 'all'
  void load(1)
}
function goDetail(item: Property) {
  uni.navigateTo({ url: `/pages/property/detail?id=${item.id}` })
}

onLoad(() => load(1))
onPullDownRefresh(() => {
  load(1).finally(() => uni.stopPullDownRefresh())
})
onReachBottom(() => {
  if (items.value.length < total.value && !loadingMore.value)
    void load(page.value + 1, 'more')
})
</script>

<template>
  <view class="app-tab-page">
    <view class="app-content pt-24rpx">
      <view class="relative h-380rpx overflow-hidden rounded-32rpx bg-app-soft">
        <image src="/static/images/apartment-atmosphere.jpg" mode="aspectFill" class="h-full w-full" aria-hidden="true" />
        <view class="absolute left-28rpx top-28rpx rounded-16rpx bg-white/90 px-24rpx py-16rpx">
          <text class="block text-52rpx font-700 leading-tight">泊之湾</text>
          <text class="mt-8rpx block text-28rpx text-app-ink-soft">找一处，安心住下。</text>
        </view>
        <text class="absolute bottom-56rpx right-16rpx rounded-8rpx bg-white/90 px-12rpx py-4rpx text-24rpx text-app-ink-soft">品牌氛围示意图</text>
      </view>
      <view class="relative mx-16rpx app-panel flex items-center gap-16rpx px-20rpx py-16rpx -mt-40rpx">
        <view class="i-carbon-search shrink-0 text-40rpx text-app-ink" aria-hidden="true" />
        <input v-model="city" class="h-88rpx min-w-0 flex-1 text-28rpx" placeholder="输入城市筛选" placeholder-class="text-app-placeholder" aria-label="城市筛选" confirm-type="search" @confirm="load(1)">
        <button class="app-primary-button shrink-0 !min-h-88rpx" :loading="loading" @tap="load(1)">
          搜索
        </button>
      </view>
      <view class="mt-24rpx flex gap-8rpx">
        <button v-for="tab in TYPE_TABS" :key="tab.key" class="app-tap min-h-88rpx min-w-0 flex flex-1 items-center justify-center rounded-16rpx px-4rpx text-28rpx" :class="filterType === tab.key ? 'bg-brand-blue text-white font-600' : 'bg-transparent text-app-ink-soft'" :aria-pressed="filterType === tab.key" @tap="selectType(tab.key)">
          {{ tab.label }}
        </button>
      </view>
      <view class="mt-16rpx flex gap-24rpx">
        <picker class="min-w-0 flex-1" :range="PRICE_TABS" range-key="label" :value="priceIndex" @change="selectPrice">
          <view class="app-tap app-panel min-h-88rpx flex items-center justify-between gap-16rpx px-24rpx" role="button" aria-label="选择租售类型">
            <text class="text-28rpx">{{ PRICE_TABS[priceIndex].label }}</text>
            <view class="i-carbon-chevron-down shrink-0 text-28rpx" aria-hidden="true" />
          </view>
        </picker>
        <picker v-if="filterPriceType === 'rent'" class="min-w-0 flex-1" :range="MODE_TABS" range-key="label" :value="modeIndex" @change="selectMode">
          <view class="app-tap app-panel min-h-88rpx flex items-center justify-between gap-12rpx px-24rpx" role="button" aria-label="选择租赁方式">
            <text class="text-28rpx">{{ MODE_TABS[modeIndex].label }}</text>
            <view class="i-carbon-chevron-down shrink-0 text-28rpx" aria-hidden="true" />
          </view>
        </picker>
      </view>
      <view class="mb-24rpx mt-48rpx flex items-center justify-between gap-16rpx">
        <text class="app-section-title">{{ filterType === 'all' ? '精选房源' : `${PROPERTY_TYPE_LABEL[filterType]}房源` }}</text>
        <button v-if="hasFilters" class="app-tap min-h-88rpx shrink-0 bg-transparent px-8rpx text-24rpx text-brand-blue" @tap="clearFilters">
          重置筛选
        </button>
      </view>
      <view v-if="loading" class="grid grid-cols-1 gap-24rpx md:grid-cols-2" aria-label="正在加载房源">
        <view v-for="n in 2" :key="n" class="app-panel overflow-hidden">
          <view class="h-320rpx bg-app-soft" />
          <view class="flex flex-col gap-16rpx p-24rpx">
            <view class="h-32rpx w-3/4 rounded-8rpx bg-app-soft" /><view class="h-24rpx w-1/2 rounded-8rpx bg-app-soft" />
          </view>
        </view>
      </view>
      <view v-else-if="error && !items.length" class="app-state">
        <view class="i-carbon-cloud-offline text-64rpx" aria-hidden="true" />
        <text>房源加载失败，请稍后重试</text>
        <button class="app-secondary-button" @tap="load(1)">
          重新加载
        </button>
      </view>
      <template v-else>
        <view v-if="items.length" class="grid grid-cols-1 gap-24rpx md:grid-cols-2">
          <view v-for="item in items" :key="item.id" class="app-tap app-panel min-w-0 overflow-hidden" role="button" :aria-label="`查看房源：${item.title}`" tabindex="0" @tap="goDetail(item)" @keydown.enter="goDetail(item)">
            <image v-if="item.images?.length && !failedImages.includes(item.id)" :src="item.images[0]" mode="aspectFill" class="block h-320rpx w-full" :aria-label="item.title" @error="failedImages.push(item.id)" />
            <view v-else class="h-320rpx flex flex-col items-center justify-center gap-16rpx bg-app-soft text-app-muted">
              <view class="i-carbon-image text-64rpx" aria-hidden="true" /><text class="text-24rpx">暂无房源图片</text>
            </view>
            <view class="p-24rpx">
              <view class="flex flex-wrap items-center gap-12rpx">
                <text class="min-w-0 flex-1 break-words text-32rpx font-600 leading-snug">{{ item.title }}</text>
                <text v-if="item.ownerIsManager" class="shrink-0 rounded-8rpx bg-app-soft px-12rpx py-4rpx text-22rpx text-brand-blue">认证管家</text>
              </view>
              <view class="mt-12rpx flex flex-wrap gap-12rpx text-24rpx text-app-muted">
                <text>{{ PROPERTY_TYPE_LABEL[item.propertyType] }}</text>
                <text v-if="item.rentalMode">{{ item.rentalMode === 'whole' ? '整租' : '合租' }}</text>
                <text v-if="item.layout">{{ item.layout }}</text><text v-if="item.areaSqm">{{ item.areaSqm }}㎡</text>
                <text v-if="item.orientation">{{ item.orientation }}</text><text v-if="item.floorInfo">{{ item.floorInfo }}层</text>
              </view>
              <view class="mt-16rpx flex flex-wrap items-baseline justify-between gap-8rpx">
                <text class="min-w-0 flex-1 truncate text-24rpx text-app-muted">{{ [item.city, item.community || item.district || item.address].filter(Boolean).join(' · ') }}</text>
                <view class="shrink-0 text-brand-blue">
                  <text class="text-40rpx font-700">¥{{ item.price }}</text><text class="ml-4rpx text-24rpx">{{ item.priceType === 'rent' ? '/月' : '元' }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="app-state">
          <view class="i-carbon-home text-64rpx" aria-hidden="true" /><text>{{ hasFilters ? '没有找到符合条件的房源' : '房源还在准备中，稍后再来看看' }}</text>
          <button v-if="hasFilters" class="app-secondary-button" @tap="clearFilters">
            查看全部房源
          </button>
        </view>
        <view v-if="error && items.length" class="app-state !py-32rpx">
          <text>加载失败，已保留当前房源</text><button class="app-secondary-button" @tap="load(page + 1, 'more')">
            重试加载
          </button>
        </view>
        <text v-else-if="loadingMore" class="block py-32rpx text-center text-24rpx text-app-muted">正在加载更多…</text>
        <text v-else-if="items.length && items.length >= total" class="block py-40rpx text-center text-24rpx text-app-muted">已展示全部房源</text>
      </template>
      <view class="h-24rpx" />
    </view>
  </view>
</template>
