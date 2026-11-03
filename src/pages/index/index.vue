<script setup lang="ts">
/**
 * 房源列表首页:类型/租售/租赁方式筛选 + 分页列表。
 */
import type { Property, PropertyType } from '@/api/property'
import { fetchProperties, PROPERTY_TYPE_LABEL } from '@/api/property'

definePage({
  style: {
    navigationBarTitleText: '房源广场',
    backgroundColor: '#F7F8FA',
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

const TYPE_TABS: { key: 'all' | PropertyType, label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'house', label: '住宅' },
  { key: 'apartment', label: '公寓' },
  { key: 'villa', label: '别墅' },
  { key: 'shop', label: '商铺' },
]
const PRICE_TABS: { key: 'all' | 'rent' | 'sale', label: string }[] = [
  { key: 'all', label: '租售' },
  { key: 'rent', label: '租' },
  { key: 'sale', label: '售' },
]
const MODE_TABS: { key: 'all' | 'whole' | 'shared', label: string }[] = [
  { key: 'all', label: '方式' },
  { key: 'whole', label: '整租' },
  { key: 'shared', label: '合租' },
]

let generation = 0
onUnload(() => {
  generation++
})
async function load(targetPage: number, mode: 'initial' | 'more' = 'initial') {
  if (mode === 'more' && (loading.value || loadingMore.value))
    return
  const current = ++generation
  mode === 'initial' ? (loading.value = true) : (loadingMore.value = true)
  try {
    const resp = await fetchProperties({
      page: targetPage,
      size: PAGE_SIZE,
      city: city.value.trim() || undefined,
      propertyType: filterType.value !== 'all' ? filterType.value : undefined,
      priceType:
        filterPriceType.value !== 'all' ? filterPriceType.value : undefined,
      rentalMode:
        filterPriceType.value === 'rent' && filterRentalMode.value !== 'all'
          ? filterRentalMode.value
          : undefined,
    })
    if (current !== generation)
      return
    items.value = mode === 'more' ? [...items.value, ...resp.list] : resp.list
    total.value = resp.total
    page.value = targetPage
  }
  catch {
  }
  finally {
    if (current === generation) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function onFilterChange() {
  load(1)
}

function goDetail(item: Property) {
  uni.navigateTo({ url: `/pages/property/detail?id=${item.id}` })
}

function priceText(item: Property) {
  return item.priceType === 'rent' ? `${item.price}/月` : `${item.price}元`
}

onLoad(() => load(1))
onPullDownRefresh(() => {
  load(1).finally(() => uni.stopPullDownRefresh())
})
onReachBottom(() => {
  if (items.value.length < total.value && !loadingMore.value)
    load(page.value + 1, 'more')
})
</script>

<template>
  <view class="min-h-full bg-#F7F8FA pb-4">
    <view class="flex items-center gap-2 bg-white px-4 py-2">
      <input
        v-model="city"
        class="flex-1 text-sm"
        placeholder="输入城市筛选"
        confirm-type="search"
        @confirm="onFilterChange"
      ><button size="mini" @tap="onFilterChange">
        搜索
      </button>
    </view>
    <!-- 筛选行 -->
    <view class="sticky top-0 z-10 bg-#EDF6FF px-3 py-2">
      <scroll-view scroll-x class="whitespace-nowrap">
        <view class="inline-flex gap-2">
          <view
            v-for="t in TYPE_TABS"
            :key="t.key"
            class="border rounded-full border-solid px-3 py-1 text-xs"
            :class="
              filterType === t.key
                ? 'border-#1677FF bg-#1677FF text-white'
                : 'border-#DCDFE6 bg-white text-#606266'
            "
            @tap="
              filterType = t.key;
              onFilterChange();
            "
          >
            {{ t.label }}
          </view>
          <view
            v-for="t in PRICE_TABS"
            :key="t.key"
            class="border rounded-full border-solid px-3 py-1 text-xs"
            :class="
              filterPriceType === t.key
                ? 'border-#1677FF bg-#1677FF text-white'
                : 'border-#DCDFE6 bg-white text-#606266'
            "
            @tap="
              filterPriceType = t.key;
              onFilterChange();
            "
          >
            {{ t.label }}
          </view>
          <template v-if="filterPriceType === 'rent'">
            <view
              v-for="t in MODE_TABS"
              :key="t.key"
              class="border rounded-full border-solid px-3 py-1 text-xs"
              :class="
                filterRentalMode === t.key
                  ? 'border-#1677FF bg-#1677FF text-white'
                  : 'border-#DCDFE6 bg-white text-#606266'
              "
              @tap="
                filterRentalMode = t.key;
                onFilterChange();
              "
            >
              {{ t.label }}
            </view>
          </template>
        </view>
      </scroll-view>
    </view>

    <!-- 房源列表 -->
    <view v-if="items.length" class="px-3">
      <view
        v-for="item in items"
        :key="item.id"
        class="mb-3 overflow-hidden rounded-2xl bg-white shadow-sm"
        @tap="goDetail(item)"
      >
        <image
          v-if="item.images && item.images.length"
          :src="item.images[0]"
          mode="aspectFill"
          class="h-44 w-full"
        />
        <view
          v-else
          class="h-32 w-full flex items-center justify-center bg-#EDF6FF text-sm text-#A8ABB2"
        >
          暂无图片
        </view>
        <view class="p-3">
          <view class="flex items-center gap-2">
            <text
              class="flex-1 truncate text-15px text-#303133 font-semibold"
            >
              {{ item.title }}
            </text>
            <text
              v-if="item.ownerIsManager"
              class="rounded-full bg-#1677FF px-2 py-0.5 text-10px text-white"
            >
              认证管家
            </text>
          </view>
          <view
            class="mt-1 flex flex-wrap items-center gap-2 text-xs text-#909399"
          >
            <text>{{ PROPERTY_TYPE_LABEL[item.propertyType] }}</text>
            <text v-if="item.rentalMode">
              {{
                item.rentalMode === "whole" ? "整租" : "合租"
              }}
            </text>
            <text v-if="item.layout">{{ item.layout }}</text>
            <text v-if="item.areaSqm">{{ item.areaSqm }}㎡</text>
            <text v-if="item.orientation">{{ item.orientation }}</text>
            <text v-if="item.floorInfo">{{ item.floorInfo }}层</text>
          </view>
          <view class="mt-2 flex items-center justify-between">
            <view
              class="min-w-0 flex flex-1 items-center gap-1 text-xs text-#909399"
            >
              <text class="truncate">
                {{
                  item.community || item.district || item.address
                }}
              </text>
            </view>
            <text class="text-lg text-#FA5151 font-bold">
              ¥{{ priceText(item) }}
            </text>
          </view>
        </view>
      </view>
      <view
        v-if="items.length >= total"
        class="py-4 text-center text-xs text-#C0C4CC"
      >
        没有更多了
      </view>
    </view>
    <view v-else-if="loading" class="py-20 text-center text-sm text-#909399">
      加载中…
    </view>
    <view v-else class="py-20 text-center text-sm text-#909399">
      暂无房源,稍后再来看看
    </view>
    <view v-if="loadingMore" class="py-2 text-center text-xs text-#C0C4CC">
      加载更多…
    </view>
  </view>
</template>

<style scoped></style>
