<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

declare const wx: {
  getMenuButtonBoundingClientRect: () => { width: number, height: number, top: number, right: number }
}

const props = withDefaults(defineProps<{
  open: boolean
  cities: string[]
  currentCity?: string
  history?: string[]
  locationLoading?: boolean
}>(), {
  currentCity: '',
  history: () => [],
  locationLoading: false,
})
const emit = defineEmits<{
  close: []
  select: [city: string]
  locate: []
}>()
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const INITIAL_MAP: Record<string, string> = {
  北京市: 'B',
  上海市: 'S',
  天津市: 'T',
  重庆市: 'C',
  广州市: 'G',
  深圳市: 'S',
  成都市: 'C',
  杭州市: 'H',
  南京市: 'N',
  苏州市: 'S',
  武汉市: 'W',
  西安市: 'X',
  郑州市: 'Z',
  长沙市: 'C',
  合肥市: 'H',
  南昌市: 'N',
  福州市: 'F',
  厦门市: 'X',
  济南市: 'J',
  青岛市: 'Q',
  沈阳市: 'S',
  大连市: 'D',
  哈尔滨市: 'H',
  昆明市: 'K',
  贵阳市: 'G',
  海口市: 'H',
  太原市: 'T',
  石家庄市: 'S',
  兰州市: 'L',
  南宁市: 'N',
  乌鲁木齐市: 'W',
  呼和浩特市: 'H',
  宁波市: 'N',
  东莞市: 'D',
  佛山市: 'F',
  珠海市: 'Z',
  惠州市: 'H',
  中山市: 'Z',
  嘉兴市: 'J',
  无锡市: 'W',
  常州市: 'C',
  徐州市: 'X',
  温州市: 'W',
  金华市: 'J',
  泉州市: 'Q',
  烟台市: 'Y',
  唐山市: 'T',
  保定市: 'B',
  洛阳市: 'L',
  芜湖市: 'W',
  蚌埠市: 'B',
  绵阳市: 'M',
  宜昌市: 'Y',
  株洲市: 'Z',
  湘潭市: 'X',
  衡阳市: 'H',
  桂林市: 'G',
  三亚市: 'S',
  拉萨市: 'L',
  银川市: 'Y',
  西宁市: 'X',
  海东市: 'H',
  香港特别行政区: 'X',
  澳门特别行政区: 'A',
  台湾省: 'T',
}

const query = ref('')
const scrollTarget = ref('')
const topInset = ref(28)
const normalized = (city: string) => city.replace(/(特别行政区|自治州|地区|市)$/, '')
const initial = (city: string) => INITIAL_MAP[city] || INITIAL_MAP[`${city}市`] || '#'
const entries = computed(() => props.cities
  .filter(city => city && city !== '不限城市')
  .map(city => ({ value: city, label: normalized(city), initial: initial(city) })))
const filteredEntries = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return keyword ? entries.value.filter(item => item.label.toLowerCase().includes(keyword) || item.value.toLowerCase().includes(keyword)) : entries.value
})
const sections = computed(() => {
  const grouped = new Map<string, typeof entries.value>()
  for (const item of filteredEntries.value) {
    const key = item.initial
    const list = grouped.get(key) || []
    list.push(item)
    grouped.set(key, list)
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, list]) => ({ key, list }))
})
const hotCities = computed(() => ['北京市', '上海市', '广州市', '深圳市', '成都市', '杭州市'].filter(city => entries.value.some(item => item.value === city)))
const selectedLabel = computed(() => normalized(props.currentCity || '全国'))

onMounted(() => {
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && typeof wx.getMenuButtonBoundingClientRect === 'function') {
    const menu = wx.getMenuButtonBoundingClientRect()
    if (menu.top > 0 && menu.height > 0)
      topInset.value = Math.ceil(menu.top + menu.height + 8)
  }
  // #endif
})

function resetQuery() {
  query.value = ''
}
function selectCity(city: string) {
  emit('select', city)
}
function jump(initialLetter: string) {
  const exists = sections.value.some(section => section.key === initialLetter)
  if (exists)
    scrollTarget.value = `city-section-${initialLetter}`
}
</script>

<template>
  <view v-if="open" class="city-picker-overlay" @touchmove.stop.prevent>
    <view class="city-picker-safe" :style="{ height: `${topInset}px` }" />
    <view class="city-picker-header">
      <button class="city-picker-close app-tap" aria-label="关闭城市选择" @tap="emit('close')">
        <view class="i-carbon-close text-7" aria-hidden="true" />
      </button>
      <view class="city-picker-search">
        <view class="i-carbon-search text-6" aria-hidden="true" />
        <input v-model="query" class="city-picker-input" placeholder="请输入城市名称" :maxlength="30" confirm-type="search" aria-label="搜索城市">
        <button v-if="query" class="city-picker-clear app-tap" aria-label="清除城市搜索" @tap="resetQuery">
          <view class="i-carbon-close-filled text-5" aria-hidden="true" />
        </button>
      </view>
    </view>

    <view class="city-picker-current">
      <text class="city-current-name">{{ selectedLabel }}</text>
      <text class="city-current-status">当前范围</text>
      <button class="city-picker-locate app-tap" :disabled="locationLoading" @tap="emit('locate')">
        {{ locationLoading ? '定位中…' : '使用定位城市' }}
      </button>
    </view>

    <scroll-view class="city-picker-scroll" scroll-y :scroll-into-view="scrollTarget" scroll-with-animation>
      <button v-if="!query" class="city-picker-row app-tap" @tap="selectCity('')">
        不限城市
      </button>
      <view v-if="history.length && !query" class="city-picker-section">
        <text class="city-picker-section-title">历史</text>
        <view class="city-picker-grid history-grid">
          <button v-for="city in history" :key="`history-${city}`" class="city-picker-city app-tap" @tap="selectCity(city)">
            {{ normalized(city) }}
          </button>
        </view>
      </view>

      <view v-if="hotCities.length && !query" class="city-picker-section">
        <text class="city-picker-section-title">热门城市</text>
        <view class="city-picker-grid hot-grid">
          <button v-for="city in hotCities" :key="`hot-${city}`" class="city-picker-city app-tap" @tap="selectCity(city)">
            {{ normalized(city) }}
          </button>
        </view>
      </view>

      <view v-for="section in sections" :id="`city-section-${section.key}`" :key="section.key" class="city-picker-section city-picker-letter-section">
        <text class="city-picker-section-title">{{ section.key }}</text>
        <button v-for="item in section.list" :key="item.value" class="city-picker-row app-tap" @tap="selectCity(item.value)">
          <text>{{ item.label }}</text>
        </button>
      </view>
      <view v-if="!sections.length" class="city-picker-empty">
        没有找到匹配城市
      </view>
    </scroll-view>

    <view v-if="!query" class="city-picker-index" aria-label="城市字母索引">
      <button v-for="letter in ALPHABET" :key="letter" class="city-picker-index-item app-tap" @tap="jump(letter)">
        {{ letter }}
      </button>
    </view>
  </view>
</template>

<style scoped>
.city-picker-overlay {
  position: fixed;
  z-index: 2000;
  inset: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  background: #fff;
  color: #152039;
}
.city-picker-safe {
  flex: none;
  min-height: 24px;
}
.city-picker-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 16px 10px;
}
.city-picker-close {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin: 0;
  padding: 0;
  background: transparent;
  color: #101828;
}
.city-picker-search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 14px;
  border: 1px solid #e4e6eb;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(16, 24, 40, 0.1);
  color: #8a919c;
}
.city-picker-input {
  min-width: 0;
  flex: 1;
  height: 44px;
  color: #152039;
  font-size: 16px;
}
.city-picker-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: transparent;
  color: #adb3bd;
}
.city-picker-current {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid #e8eaee;
}
.city-current-name {
  color: #121a2b;
  font-size: 16px;
  font-weight: 700;
}
.city-current-status {
  color: #8b9099;
  font-size: 14px;
}
.city-picker-locate {
  min-height: 40px;
  margin-left: auto;
  padding: 0 4px;
  background: transparent;
  color: #4b83d6;
  font-size: 14px;
}
.city-picker-scroll {
  min-height: 0;
  flex: 1;
  background: #fff;
}
.city-picker-section {
  padding: 18px 24px 6px;
}
.city-picker-section-title {
  display: block;
  margin-bottom: 10px;
  color: #a4a7ad;
  font-size: 14px;
}
.city-picker-grid {
  display: grid;
  gap: 10px 12px;
}
.history-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.hot-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.city-picker-city {
  min-width: 0;
  min-height: 42px;
  padding: 0 8px;
  border-radius: 2px;
  background: #fbfbfc;
  color: #151a26;
  font-size: 15px;
  line-height: 42px;
}
.city-picker-letter-section {
  padding-top: 12px;
  padding-bottom: 0;
}
.city-picker-row {
  display: flex;
  align-items: center;
  width: calc(100% - 24px);
  min-height: 48px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid #f0f1f3;
  border-radius: 0;
  background: #fff;
  color: #162035;
  font-size: 16px;
  text-align: left;
}
.city-picker-index {
  position: absolute;
  top: 190px;
  right: 3px;
  bottom: 14px;
  display: flex;
  width: 18px;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}
.city-picker-index-item {
  min-height: 20px;
  padding: 0;
  background: transparent;
  color: #121212;
  font-size: 11px;
  line-height: 18px;
}
.city-picker-empty {
  padding: 60px 24px;
  color: #8d95a3;
  font-size: 14px;
  text-align: center;
}
</style>
