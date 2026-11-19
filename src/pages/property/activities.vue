<script setup lang="ts">
import type { Property } from '@/api/property'
import type { PropertyActivity } from '@/api/propertyHome'
import { onLoad, onPullDownRefresh, onReachBottom, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { fetchProperties } from '@/api/property'
import { fetchPropertyHome } from '@/api/propertyHome'
import PropertyCard from '@/components/PropertyCard.vue'
import WeChatPageHeader from '@/components/WeChatPageHeader.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '优惠活动', backgroundColor: '#F5F7FF', enablePullDownRefresh: true } })
const id = ref('')
const activities = ref<PropertyActivity[]>([])
const items = ref<Property[]>([])
const active = computed(() => activities.value.find(item => item.id === id.value))
const total = ref(0)
const page = ref(0)
const loading = ref(false)
const error = ref(false)
const moreError = ref(false)
const failedImages = ref<string[]>([])
let generation = 0
onLoad((q) => {
  id.value = String(q?.id || '')
  void load()
})
onUnload(() => {
  generation++
})
onPullDownRefresh(() => {
  load().finally(() => uni.stopPullDownRefresh())
})
onReachBottom(() => {
  if (!loading.value && items.value.length < total.value && !moreError.value)
    void loadMore()
})

async function load() {
  const current = ++generation
  loading.value = true
  error.value = false
  moreError.value = false
  items.value = []
  total.value = 0
  page.value = 0
  try {
    const home = await fetchPropertyHome()
    if (current !== generation)
      return
    activities.value = home.activities
    if (id.value && active.value) {
      const result = await fetchProperties({ page: 1, size: 10, activityId: id.value, sort: 'newest' })
      if (current !== generation)
        return
      items.value = result.list
      total.value = result.total
      page.value = 1
    }
  }
  catch {
    if (current === generation)
      error.value = true
  }
  finally {
    if (current === generation)
      loading.value = false
  }
}
async function loadMore() {
  if (loading.value || !active.value)
    return
  const current = generation
  loading.value = true
  moreError.value = false
  try {
    const result = await fetchProperties({ page: page.value + 1, size: 10, activityId: id.value, sort: 'newest' })
    if (current !== generation)
      return
    items.value = [...items.value, ...result.list]
    total.value = result.total
    page.value++
  }
  catch {
    if (current === generation)
      moreError.value = true
  }
  finally {
    if (current === generation)
      loading.value = false
  }
}
function select(activity: PropertyActivity) {
  uni.navigateTo({ url: `/pages/property/activities?id=${encodeURIComponent(activity.id)}` })
}
function favoriteChanged(propertyId: Property['id'], favorited: boolean) {
  items.value = items.value.map(item => item.id === propertyId ? { ...item, isFavorited: favorited } : item)
}
function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="app-page bg-#F5F7FF">
    <WeChatPageHeader title="优惠活动" subtitle="精选福利与限时房源" :show-back="false" />
    <view class="app-content py-4">
      <view v-if="error" class="app-state">
        <view class="i-carbon-cloud-offline text-8" /><text>活动加载失败，请重试</text><button class="app-secondary-button" @tap="load">
          重新加载
        </button>
      </view>
      <view v-else-if="id && active" class="mb-4 app-panel p-5">
        <text class="mb-2 inline-block rounded-full bg-#fff0da px-3 py-1 text-xs text-#875a13">公寓官方活动</text>
        <text class="block break-words text-xl font-bold">{{ active.title }}</text>
        <image v-if="active.imageUrl && !failedImages.includes(active.id)" :src="active.imageUrl" mode="widthFix" class="mt-4 w-full rounded-xl" @error="failedImages.push(active.id)" />
        <text v-if="active.description" class="mt-3 block whitespace-pre-wrap break-words text-sm text-app-ink-soft leading-6">{{ active.description }}</text>
        <text v-if="active.startsAt || active.endsAt" class="mt-3 block text-xs text-app-muted">活动时间：{{ active.startsAt?.slice(0, 16) || '即日起' }} — {{ active.endsAt?.slice(0, 16) || '长期有效' }}</text>
      </view>
      <template v-if="!error && id && active">
        <text class="mb-3 block text-base font-semibold">参与活动的房源</text>
        <view class="flex flex-col gap-3">
          <PropertyCard v-for="item in items" :key="item.id" :item="item" @favorite="favoriteChanged" />
        </view>
        <view v-if="!loading && !items.length" class="app-state">
          <text>暂无可展示的活动房源</text><button class="app-secondary-button" @tap="goHome">
            查看其他房源
          </button>
        </view>
        <view v-if="moreError" class="app-state">
          <text>更多房源加载失败，已有房源已保留</text><button class="app-secondary-button" @tap="loadMore">
            重试加载
          </button>
        </view>
      </template>
      <view v-else-if="!error && !id" class="flex flex-col gap-4">
        <button v-for="activity in activities" :key="activity.id" class="app-tap app-panel overflow-hidden p-0 text-left" @tap="select(activity)">
          <image v-if="activity.imageUrl && !failedImages.includes(activity.id)" :src="activity.imageUrl" mode="aspectFill" class="h-36 w-full" @error="failedImages.push(activity.id)" />
          <view class="p-5">
            <view class="i-carbon-gift mb-2 text-7 text-brand-blue" /><text class="block break-words text-lg text-app-ink font-bold">{{ activity.title }}</text><text v-if="activity.description" class="line-clamp-2 mt-2 block break-words text-sm text-app-muted leading-6">{{ activity.description }}</text><text class="mt-3 block text-sm text-brand-blue">查看活动房源 ›</text>
          </view>
        </button>
        <view v-if="!loading && !activities.length" class="app-state">
          <view class="i-carbon-gift text-10" /><text>暂无正在进行的优惠活动</text><button class="app-secondary-button" @tap="goHome">
            去看看房源
          </button>
        </view>
      </view>
      <view v-else-if="!loading && !error" class="app-state">
        <view class="i-carbon-time text-10" /><text>活动不存在或已结束</text><button class="app-secondary-button" @tap="goHome">
          查看其他房源
        </button>
      </view>
      <view v-if="loading" class="app-state">
        <view class="i-carbon-circle-dash animate-spin text-8" /><text>正在加载…</text>
      </view>
    </view>
  </view>
</template>
