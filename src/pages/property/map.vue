<script setup lang="ts">
import type { CommunitySuggestion, MapFilters, MapProperty } from '@/api/propertyMap'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { fetchCommunities, fetchMapProperties, fetchRegionSource } from '@/api/propertyMap'
import { fetchRegionTree } from '@/api/property'
import { regionCityNames } from '@/utils/regions'

definePage({ style: { navigationBarTitleText: '地图找房', backgroundColor: '#F5F7FA' } })
const city = ref('')
const cityOptions = ref(['不限城市'])
const keyword = ref('')
const exactCommunity = ref<CommunitySuggestion | null>(null)
const priceType = ref('')
const priceUnit = ref('')
const minPrice = ref<string | number>('')
const maxPrice = ref<string | number>('')
const tradeLabels = ['全部租售', '出租', '出售']
const tradeValues = ['', 'rent', 'sale']
const unitLabels = ['全部计价', '月租', '日租']
const unitValues = ['', 'month', 'day']
const sourceVersion = ref('')
const items = ref<MapProperty[]>([])
const suggestions = ref<CommunitySuggestion[]>([])
const loading = ref(false)
const error = ref('')
const truncated = ref(false)
const latitude = ref(31.2304)
const longitude = ref(121.4737)
const selected = ref('')
const mode = ref<'map' | 'list'>('map')
const located = ref(false)
let generation = 0
let suggestGeneration = 0
let disposed = false
let debounce: ReturnType<typeof setTimeout> | undefined
let mapEnabled = true
// #ifdef H5
mapEnabled = !!import.meta.env.VITE_TENCENT_MAP_KEY
// #endif
const markers = computed(() => items.value.map((p, index) => ({
  id: index + 1,
  latitude: Number(p.latitude),
  longitude: Number(p.longitude),
  iconPath: '/static/tabbar/homeHL.png',
  width: 26,
  height: 26,
  callout: { content: `${p.price}元${p.priceType === 'rent' ? p.priceUnit === 'day' ? '/天' : '/月' : ''}`, display: 'ALWAYS', color: '#ffffff', bgColor: selected.value === p.id ? '#0f766e' : '#263d74', padding: 7, borderRadius: 8 },
})))
const visibleItems = computed(() => selected.value ? [...items.value.filter(p => p.id === selected.value), ...items.value.filter(p => p.id !== selected.value)] : items.value)
function filters(): MapFilters {
  const amounts = [String(minPrice.value).trim(), String(maxPrice.value).trim()]
  if (amounts.some(value => value && (!/^\d{1,10}$/.test(value) || Number(value) > 9999999999)))
    throw new Error('价格请输入 0～9999999999 的整数')
  const minimum = amounts[0] ? Number(amounts[0]) : undefined
  const maximum = amounts[1] ? Number(amounts[1]) : undefined
  if (minimum != null && maximum != null && minimum > maximum)
    throw new Error('最低价格不能高于最高价格')
  return { city: city.value || undefined, district: exactCommunity.value?.district || undefined, community: exactCommunity.value?.community, keyword: exactCommunity.value ? undefined : keyword.value.trim() || undefined, priceType: priceType.value || undefined, priceUnit: priceType.value === 'rent' ? priceUnit.value || undefined : undefined, minPrice: minimum, maxPrice: maximum }
}
async function search(bounds: MapFilters = {}, move = true) {
  const version = ++generation
  let query: MapFilters
  try {
    query = filters()
  }
  catch (failure) {
    error.value = failure instanceof Error ? failure.message : '筛选条件无效'
    loading.value = false
    items.value = []
    return
  }
  loading.value = true
  error.value = ''
  selected.value = ''
  suggestions.value = []
  suggestGeneration++
  clearTimeout(debounce)
  items.value = []
  try {
    const result = await fetchMapProperties({ ...query, ...bounds })
    if (disposed || version !== generation)
      return
    items.value = result.list
    truncated.value = result.truncated
    if (move && result.list[0]) {
      latitude.value = Number(result.list[0].latitude)
      longitude.value = Number(result.list[0].longitude)
    }
  }
  catch {
    if (!disposed && version === generation)
      error.value = '房源加载失败，请重试'
  }
  finally {
    if (!disposed && version === generation)
      loading.value = false
  }
}
function searchArea() {
  uni.createMapContext('property-map').getRegion({
    success: ({ southwest, northeast }) => void search({ south: southwest.latitude, west: southwest.longitude, north: northeast.latitude, east: northeast.longitude }, false),
    fail: () => uni.showToast({ title: '地图尚未就绪，请稍后重试', icon: 'none' }),
  })
}
function nearby() {
  uni.getLocation({ type: 'gcj02', success: (point) => {
    if (disposed)
      return
    latitude.value = point.latitude
    longitude.value = point.longitude
    located.value = true
    const latSpan = 0.045
    const lngSpan = 0.045 / Math.max(0.2, Math.cos(point.latitude * Math.PI / 180))
    city.value = ''
    exactCommunity.value = null
    void search({ south: point.latitude - latSpan, north: point.latitude + latSpan, west: point.longitude - lngSpan, east: point.longitude + lngSpan }, false)
  }, fail: () => uni.showToast({ title: '未获得定位，可选择城市或手动移动地图', icon: 'none' }) })
}
function suggest() {
  exactCommunity.value = null
  clearTimeout(debounce)
  const version = ++suggestGeneration
  if (!keyword.value.trim()) {
    suggestions.value = []
    return
  }
  debounce = setTimeout(async () => {
    try {
      const result = await fetchCommunities(filters())
      if (!disposed && version === suggestGeneration)
        suggestions.value = result
    }
    catch {
      if (version === suggestGeneration)
        suggestions.value = []
    }
  }, 300)
}
function chooseCommunity(item: CommunitySuggestion) {
  suggestGeneration++
  city.value = item.city || ''
  keyword.value = item.community
  exactCommunity.value = item
  void search()
}
function selectMarker(event: { detail: { markerId: number } }) {
  selected.value = items.value[event.detail.markerId - 1]?.id || ''
}
function navigate(item: MapProperty) {
  uni.openLocation({ latitude: Number(item.latitude), longitude: Number(item.longitude), name: item.community || item.title, address: item.locationLabel || '', fail: () => uni.showToast({ title: '导航暂不可用，请联系管家确认路线', icon: 'none' }) })
}
function detail(item: MapProperty) {
  uni.navigateTo({ url: `/pages/property/detail?id=${item.id}` })
}
function changeCity(event: { detail: { value: number | string } }) {
  const value = cityOptions.value[Number(event.detail.value)]
  city.value = value === '不限城市' ? '' : value
  exactCommunity.value = null
  void search()
}
onLoad(async (query) => {
  city.value = String(query?.city || '')
  void search()
  try {
    const tree = await fetchRegionTree()
    if (!disposed)
      cityOptions.value = ['不限城市', ...regionCityNames(tree)]
    const source = await fetchRegionSource()
    if (!disposed)
      sourceVersion.value = source.version
  }
  catch { /* Search remains available when region metadata is unavailable. */ }
})
onUnload(() => {
  disposed = true
  generation++
  suggestGeneration++
  clearTimeout(debounce)
})
</script>

<template>
  <view class="map-page">
    <view class="search-panel">
      <view class="flex items-center gap-2">
        <picker :range="cityOptions" :value="Math.max(0, cityOptions.indexOf(city))" @change="changeCity">
          <view class="city-button">
            {{ city || '全国' }} ›
          </view>
        </picker>
        <input v-model="keyword" class="keyword-input min-w-0 flex-1 rounded-lg bg-gray-1" placeholder="搜索小区、房源或位置" :maxlength="64" confirm-type="search" @input="suggest" @confirm="search()">
        <button class="search-button" :loading="loading" @tap="search()">
          搜索
        </button>
      </view>
      <view class="mt-3 flex flex-wrap items-center gap-2">
        <picker :range="tradeLabels" :value="tradeValues.indexOf(priceType)" @change="priceType = tradeValues[Number($event.detail.value)]; search()">
          <view class="small-button">
            {{ tradeLabels[tradeValues.indexOf(priceType)] }} ›
          </view>
        </picker>
        <picker v-if="priceType === 'rent'" :range="unitLabels" :value="unitValues.indexOf(priceUnit)" @change="priceUnit = unitValues[Number($event.detail.value)]; search()">
          <view class="small-button">
            {{ unitLabels[unitValues.indexOf(priceUnit)] }} ›
          </view>
        </picker>
      </view>
      <view class="price-range">
        <input v-model="minPrice" class="price-input" type="number" :maxlength="10" placeholder="最低价（元）" aria-label="最低价格" confirm-type="search" @confirm="search()">
        <text>—</text>
        <input v-model="maxPrice" class="price-input" type="number" :maxlength="10" placeholder="最高价（元）" aria-label="最高价格" confirm-type="search" @confirm="search()">
      </view>
      <view v-if="suggestions.length" class="suggestions">
        <button v-for="item in suggestions" :key="`${item.city}-${item.district}-${item.community}`" class="suggestion" @tap="chooseCommunity(item)">
          <text>{{ item.community }}</text><text class="text-xs text-gray-6">{{ item.city }} · {{ item.district }} · {{ item.propertyCount }} 套</text>
        </button>
      </view>
      <view class="mt-3 flex gap-2">
        <button class="small-button" @tap="nearby">
          我的附近
        </button>
        <button class="small-button" @tap="mode = mode === 'map' ? 'list' : 'map'">
          {{ mode === 'map' ? '列表视图' : '地图视图' }}
        </button>
        <button v-if="mapEnabled && mode === 'map'" class="small-button" @tap="searchArea">
          搜索此区域
        </button>
      </view>
    </view>
    <map v-if="mapEnabled && mode === 'map'" id="property-map" class="property-map" :latitude="latitude" :longitude="longitude" :scale="13" :markers="markers" :show-location="located" @markertap="selectMarker" @callouttap="selectMarker" />
    <view v-else-if="!mapEnabled && mode === 'map'" class="empty-panel">
      当前浏览器地图暂未启用，可继续搜索房源或在微信小程序查看地图。
    </view>
    <view class="results">
      <text class="block text-lg font-bold">{{ loading ? '正在查找房源…' : `${items.length} 套可看房源` }}</text>
      <text class="my-2 block text-xs text-gray-6">仅展示已录入公开位置且正常接待的房源。位置为小区入口，具体房间请预约确认。</text>
      <text v-if="truncated" class="my-2 block text-amber-8">结果超过 200 套，请缩小地图范围或选择小区。</text>
      <view v-if="error" class="empty-panel">
        <text>{{ error }}</text><button class="small-button mt-3" @tap="search()">
          重试
        </button>
      </view>
      <view v-else-if="!loading && !items.length" class="empty-panel">
        未找到匹配房源。试试更换城市、缩短关键词或扩大地图范围。
      </view>
      <view v-for="item in visibleItems" :key="item.id" class="property-result" :class="{ selected: selected === item.id }">
        <view class="flex justify-between gap-3">
          <text class="font-bold">{{ item.community || item.title }}</text><text class="shrink-0 text-blue-8 font-bold">{{ item.price }}元{{ item.priceType === 'rent' ? item.priceUnit === 'day' ? '/天' : '/月' : '' }}</text>
        </view>
        <text class="my-2 block text-sm text-gray-6">{{ item.title }}</text>
        <text class="block text-xs text-gray-6">{{ item.city }} · {{ item.district }} · {{ item.locationLabel }}</text>
        <view class="mt-3 flex gap-2">
          <button class="small-button" @tap="detail(item)">
            查看房源
          </button><button class="small-button" @tap="navigate(item)">
            导航到这里
          </button>
        </view>
      </view>
      <text v-if="sourceVersion" class="my-4 block text-xs text-gray-5">城市名称采用民政部行政区划 · {{ sourceVersion }} 版</text>
    </view>
  </view>
</template>

<style scoped>
.keyword-input {
  height: 44px;
  padding: 0 12px;
  font-size: 14px;
}
.map-page .text-lg { font-size: 18px; }
.map-page .text-sm { font-size: 14px; }
.map-page .text-xs { font-size: 12px; }
.price-range {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.price-input {
  min-width: 0;
  flex: 1;
  width: 0;
  min-height: 44px;
  padding: 0 8px;
  background: #f2f4f8;
  border-radius: 8px;
  font-size: 13px;
}
.map-page {
  color: #1e3159;
  padding-bottom: env(safe-area-inset-bottom);
  background: #f5f7fa;
  min-height: 100vh;
}
.search-panel {
  padding: 14px 12px;
  background: #fff;
}
.city-button {
  max-width: 90px;
  font-size: 14px;
  min-height: 44px;
  display: flex;
  align-items: center;
}
.search-button {
  background: #263d74;
  color: white;
  margin: 0;
  padding: 0 12px;
  line-height: 44px;
  font-size: 14px;
}
.small-button {
  margin: 0;
  padding: 0 12px;
  line-height: 44px;
  font-size: 13px;
  border: 1px solid #dae1ed;
  border-radius: 8px;
  background: #fff;
  color: #263d74;
}
.property-map {
  width: 100%;
  height: 44vh;
  min-height: 260px;
}
.results {
  padding: 16px;
}
.property-result {
  border-bottom: 1px solid #e1e5ed;
  padding: 18px 0;
}
.property-result.selected {
  border-left: 3px solid #0f766e;
  padding-left: 10px;
}
.empty-panel {
  padding: 24px 16px;
  color: #56647b;
  line-height: 1.7;
}
.suggestion {
  display: flex;
  flex-direction: column;
  text-align: left;
  margin: 0;
  padding: 12px;
  font-size: 14px;
  background: #fff;
  border-bottom: 1px solid #e1e5ed;
}
</style>
