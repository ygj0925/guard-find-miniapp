<script setup lang="ts">
import type { Property } from '@/api/property'
import { onHide, onLoad, onReachBottom, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getUserInfo } from '@/api/login'
import {
  changePropertyStatus,
  deleteProperty,
  fetchPersonalProperties,
  PROPERTY_TYPE_LABEL,
  propertyPriceSuffix,
  RENTAL_MODE_LABEL,
  toggleFavorite,
} from '@/api/property'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'
import WeChatPageHeader from '@/components/WeChatPageHeader.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '我的房源', backgroundColor: '#F5F7FF' } })

type Kind = 'mine' | 'favorites' | 'history'
const TITLES: Record<Kind, string> = { mine: '我的房源', favorites: '我的收藏', history: '浏览记录' }
const EMPTY: Record<Kind, { icon: string, title: string, hint: string }> = {
  mine: { icon: 'i-carbon-building', title: '还没有发布房源', hint: '发布后可在这里编辑、上下架或删除。' },
  favorites: { icon: 'i-carbon-star', title: '还没有收藏房源', hint: '在房源详情点击收藏，方便之后对比查看。' },
  history: { icon: 'i-carbon-time', title: '还没有浏览记录', hint: '看过的房源会按时间显示在这里。' },
}
const STATUS: Record<number, { label: string, cls: string }> = {
  1: { label: '草稿', cls: 'text-app-muted' },
  2: { label: '已上架', cls: 'text-app-success' },
  3: { label: '已下架', cls: 'text-app-warning' },
}

const kind = ref<Kind>('mine')
const items = ref<Property[]>([])
const total = ref(0)
const page = ref(0)
const loading = ref(false)
const error = ref(false)
const busyId = ref<Property['id'] | null>(null)
const failedImages = ref<Property['id'][]>([])
const tokenStore = useTokenStore()
const identity = ref<'checking' | 'guest' | 'denied' | 'error' | 'manager'>('checking')
const verifiedToken = ref('')
const canManage = computed(() => identity.value === 'manager' && !!verifiedToken.value && verifiedToken.value === tokenStore.validToken)
let generation = 0
let busyVersion = 0
let disposed = false
function clearPrivateLists() {
  generation++
  busyVersion++
  verifiedToken.value = ''
  items.value = []
  total.value = 0
  page.value = 0
  loading.value = false
  error.value = false
  busyId.value = null
  failedImages.value = []
  identity.value = tokenStore.updateNowTime().hasLogin ? 'error' : 'guest'
}
watch(() => tokenStore.validToken, clearPrivateLists, { flush: 'sync' })
onHide(() => {
  if (kind.value === 'mine')
    clearPrivateLists()
})
function dispose() {
  disposed = true
  generation++
  busyVersion++
  busyId.value = null
}
onBeforeUnmount(dispose)

onLoad((q) => {
  if (q?.kind === 'favorites' || q?.kind === 'history')
    kind.value = q.kind
  uni.setNavigationBarTitle({ title: TITLES[kind.value] })
})
onShow(() => {
  void load()
})
onUnload(dispose)
onReachBottom(() => {
  if (!error.value && items.value.length < total.value)
    void load(true)
})

function isCurrent(current: number, token: string) {
  return !disposed && current === generation
    && tokenStore.updateNowTime().hasLogin && !!token && token === tokenStore.validToken
}
function canWrite() {
  return !disposed && kind.value === 'mine' && tokenStore.updateNowTime().hasLogin && canManage.value
}
async function load(more = false) {
  if (disposed || (more && (loading.value || (kind.value === 'mine' && !canWrite()))))
    return
  const token = tokenStore.updateNowTime().validToken
  if (!tokenStore.hasLogin || !token) {
    clearPrivateLists()
    return
  }
  const current = ++generation
  loading.value = true
  error.value = false
  if (kind.value !== 'mine')
    identity.value = 'checking'
  if (kind.value === 'mine' && !more) {
    verifiedToken.value = ''
    items.value = []
    total.value = 0
    page.value = 0
    identity.value = 'checking'
    try {
      const me = await getUserInfo({ header: { Authorization: `Bearer ${token}` }, hideErrorToast: true })
      if (!isCurrent(current, token))
        return
      if (me?.isPropertyManager !== true) {
        identity.value = 'denied'
        loading.value = false
        return
      }
      identity.value = 'manager'
      verifiedToken.value = token
    }
    catch {
      if (isCurrent(current, token)) {
        identity.value = 'error'
        loading.value = false
      }
      return
    }
  }
  try {
    const next = more ? page.value + 1 : 1
    const res = await fetchPersonalProperties(kind.value, next)
    if (!isCurrent(current, token))
      return
    items.value = more ? [...items.value, ...res.list] : res.list
    total.value = res.total
    page.value = next
    if (!more)
      failedImages.value = []
  }
  catch {
    if (isCurrent(current, token))
      error.value = true
  }
  finally {
    if (isCurrent(current, token))
      loading.value = false
  }
}

function location(item: Property) {
  return [item.city, item.community || item.district || item.address].filter(Boolean).join(' · ')
}
function detail(item: Property) {
  uni.navigateTo({ url: `/pages/property/detail?id=${item.id}` })
}
function edit(id = '') {
  if (canWrite())
    uni.navigateTo({ url: `/pages/property/edit?id=${encodeURIComponent(id)}` })
}
function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

async function runBusy(item: Property, task: () => Promise<void>) {
  if (disposed || busyId.value != null)
    return
  const version = ++busyVersion
  busyId.value = item.id
  try {
    await task()
  }
  catch {}
  finally {
    if (!disposed && version === busyVersion)
      busyId.value = null
  }
}

function toggleStatus(item: Property) {
  if (!canWrite())
    return
  const current = generation
  const token = verifiedToken.value
  const next = item.status === 2 ? 3 : 2
  void runBusy(item, async () => {
    await changePropertyStatus(item.id, next)
    if (!isCurrent(current, token))
      return
    uni.showToast({ icon: 'none', title: next === 2 ? '已上架' : '已下架' })
    await load()
  })
}

function remove(item: Property) {
  if (!canWrite())
    return
  const current = generation
  const token = verifiedToken.value
  uni.showModal({
    title: '删除房源',
    content: '有进行中的预约时需先处理预约，确定删除？',
    confirmText: '删除',
    confirmColor: '#D93025',
    success: (r) => {
      if (!r.confirm || !canWrite() || !isCurrent(current, token))
        return
      void runBusy(item, async () => {
        await deleteProperty(item.id)
        if (!isCurrent(current, token))
          return
        uni.showToast({ icon: 'none', title: '已删除' })
        await load()
      })
    },
  })
}

function unfavorite(item: Property) {
  const token = tokenStore.updateNowTime().validToken
  const current = generation
  if (kind.value !== 'favorites' || !items.value.includes(item) || !isCurrent(current, token))
    return
  void runBusy(item, async () => {
    const { favorited } = await toggleFavorite(item.id)
    if (!isCurrent(current, token))
      return
    if (favorited) {
      await load()
      return
    }
    items.value = items.value.filter(entry => entry.id !== item.id)
    total.value = Math.max(0, total.value - 1)
    uni.showToast({ icon: 'none', title: '已取消收藏' })
  })
}
</script>

<template>
  <view class="personal-page app-page">
    <WeChatPageHeader :title="TITLES[kind]" subtitle="管理房源、收藏与浏览记录" />
    <view class="app-content py-4">
      <view class="mb-4 flex items-end justify-between gap-3">
        <text class="text-24px text-app-ink font-bold">{{ TITLES[kind] }}</text>
        <button v-if="kind === 'mine' && canManage" class="app-primary-button shrink-0 !min-h-11 !px-4 !text-sm" @tap="edit()">
          发布房源
        </button>
        <text v-else-if="total" class="text-xs text-app-muted">共 {{ total }} 套</text>
      </view>

      <view v-if="identity === 'guest' || (kind === 'mine' && !canManage)" class="min-h-70 app-state gap-3 py-12">
        <view class="i-carbon-security h-10 w-10 text-brand-blue" />
        <text class="text-center text-base text-app-ink font-semibold">
          {{ identity === 'checking' ? '正在核验管理身份' : identity === 'guest' ? `登录后查看${TITLES[kind]}` : identity === 'denied' ? '房源由公寓管家统一维护' : '管理身份核验失败，请重试' }}
        </text>
        <button v-if="identity === 'guest'" class="app-primary-button max-w-60 w-full" @tap="toLoginPage()">
          去登录
        </button>
        <button v-else-if="identity === 'error'" class="app-secondary-button max-w-60 w-full" @tap="load()">
          重新核验
        </button>
        <button v-if="identity === 'denied'" class="app-secondary-button max-w-60 w-full" @tap="goHome">
          查看房源
        </button>
      </view>
      <template v-if="identity !== 'guest' && (kind !== 'mine' || canManage)">
        <view v-for="item in items" :key="item.id" class="mb-3 app-panel overflow-hidden">
          <view class="flex items-stretch">
            <button
              class="app-tap min-w-0 flex flex-1 items-center gap-3 bg-white p-3 text-left leading-normal"
              :aria-label="`查看房源：${item.title}`"
              @tap="detail(item)"
            >
              <image
                v-if="item.images?.length && !failedImages.includes(item.id)"
                :src="item.images[0]"
                mode="aspectFill"
                class="h-22 w-22 shrink-0 rounded-lg bg-app-soft"
                aria-hidden="true"
                @error="failedImages.push(item.id)"
              />
              <view v-else class="h-22 w-22 flex shrink-0 items-center justify-center rounded-lg bg-app-soft text-app-muted" aria-hidden="true">
                <view class="i-carbon-image h-6 w-6" />
              </view>
              <view class="min-w-0 flex-1">
                <view class="flex items-start gap-2">
                  <text class="line-clamp-2 min-w-0 flex-1 break-words text-base text-app-ink font-semibold leading-6">{{ item.title }}</text>
                  <text
                    v-if="kind === 'mine'"
                    class="shrink-0 rounded-md bg-app-soft px-2 py-0.5 text-xs leading-5"
                    :class="STATUS[item.status]?.cls || 'text-app-muted'"
                  >
                    {{ STATUS[item.status]?.label || '未知' }}
                  </text>
                </view>
                <text class="mt-1 block truncate text-xs text-app-muted leading-5">
                  {{ [PROPERTY_TYPE_LABEL[item.propertyType], item.priceType === 'rent' && item.rentalMode ? RENTAL_MODE_LABEL[item.rentalMode] : '', location(item)].filter(Boolean).join(' · ') }}
                </text>
                <view v-if="item.price != null" class="mt-1 flex items-baseline gap-1 text-brand-blue">
                  <text class="text-18px font-bold">¥{{ item.price }}</text>
                  <text class="text-xs">{{ propertyPriceSuffix(item) }}</text>
                </view>
              </view>
            </button>
            <button
              v-if="kind === 'favorites'"
              class="app-tap w-14 flex shrink-0 items-center justify-center bg-white p-0 text-app-warning"
              :disabled="busyId != null"
              aria-label="取消收藏"
              @tap="unfavorite(item)"
            >
              <view class="i-carbon-star-filled h-6 w-6" :class="busyId === item.id ? 'animate-pulse' : ''" />
            </button>
          </view>
          <view v-if="kind === 'mine'" class="grid grid-cols-3 gap-2 border-0 border-t border-app-border border-solid p-3">
            <button class="app-secondary-button w-full !min-h-11 !text-sm" :disabled="busyId != null" @tap="edit(String(item.id))">
              编辑
            </button>
            <button
              class="app-secondary-button w-full !min-h-11 !text-sm"
              :disabled="busyId != null"
              :loading="busyId === item.id"
              @tap="toggleStatus(item)"
            >
              {{ item.status === 2 ? '下架' : '上架' }}
            </button>
            <button class="app-secondary-button w-full !min-h-11 !text-sm !text-app-danger" :disabled="busyId != null" @tap="remove(item)">
              删除
            </button>
          </view>
        </view>

        <view v-if="loading" class="app-state gap-3 py-10">
          <view class="i-carbon-circle-dash h-7 w-7 animate-spin text-brand-blue" />
          <text class="text-sm text-app-muted">{{ items.length ? '正在加载更多' : '正在加载' }}</text>
        </view>
        <view v-else-if="error" class="app-state gap-3 py-10">
          <view class="i-carbon-warning-alt h-8 w-8 text-app-warning" />
          <text class="text-sm text-app-muted">{{ items.length ? '更多记录加载失败，已有记录已保留' : '加载失败，请检查网络后重试' }}</text>
          <button class="mt-2 app-secondary-button max-w-60 w-full" @tap="load(items.length > 0)">
            重新加载
          </button>
        </view>
        <view v-else-if="!items.length" class="min-h-70 app-state gap-3 py-12">
          <view class="h-10 w-10 text-app-muted" :class="EMPTY[kind].icon" />
          <text class="text-base text-app-ink font-semibold">{{ EMPTY[kind].title }}</text>
          <text class="text-center text-sm text-app-muted leading-6">{{ EMPTY[kind].hint }}</text>
          <button v-if="kind === 'mine'" class="mt-2 app-primary-button max-w-60 w-full" @tap="edit()">
            发布房源
          </button>
          <button v-else class="mt-2 app-secondary-button max-w-60 w-full" @tap="goHome">
            去看看房源
          </button>
        </view>
        <text v-else-if="items.length >= total" class="block py-6 text-center text-xs text-app-muted">已显示全部</text>
      </template>
    </view>
  </view>
</template>

<style scoped>
.personal-page {
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 90% 0, rgba(170, 196, 255, 0.45), transparent 32%),
    #f5f7ff;
}
.personal-page .app-panel {
  box-shadow: 0 12px 28px rgba(70, 104, 184, 0.1);
}
</style>
