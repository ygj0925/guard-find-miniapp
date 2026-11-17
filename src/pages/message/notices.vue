<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { http } from '@/http/http'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({ style: { navigationBarTitleText: '业务通知', enablePullDownRefresh: true } })
interface Notice { id: string | number, businessType: string, businessId: string | number, title: string, content: string, isRead: number }
const tokenStore = useTokenStore()
const authenticated = computed(() => Boolean(tokenStore.validToken))
const items = ref<Notice[]>([])
const page = ref(0)
const total = ref(0)
const loading = ref(false)
const failed = ref(false)
const failedMore = ref(false)
let generation = 0
let visible = false
function invalidate() {
  generation++
  loading.value = false
}
async function load(more = false) {
  const token = tokenStore.updateNowTime().validToken
  if (loading.value || !token || !visible)
    return
  const current = ++generation
  const valid = () => visible && current === generation && tokenStore.validToken === token
  loading.value = true
  failedMore.value = more
  failed.value = false
  try {
    const next = more ? page.value + 1 : 1
    const response = await http.get<{ list: Notice[], total: number }>('/miniapp/notices', { page: next, size: 20 })
    if (!valid())
      return
    items.value = more ? [...new Map([...items.value, ...response.list].map(item => [String(item.id), item])).values()] : response.list
    page.value = next
    total.value = response.total
  }
  catch {
    if (valid())
      failed.value = true
  }
  finally {
    if (valid())
      loading.value = false
  }
}
onShow(() => {
  visible = true
  void load()
})
onHide(() => {
  visible = false
  invalidate()
})
onUnload(() => {
  visible = false
  invalidate()
})
onReachBottom(() => {
  if (items.value.length < total.value)
    void load(true)
})
onPullDownRefresh(() => {
  invalidate()
  load().finally(() => uni.stopPullDownRefresh())
})
watch(() => tokenStore.validToken, () => {
  invalidate()
  items.value = []
  page.value = 0
  total.value = 0
  failed.value = false
  if (visible)
    void load()
}, { flush: 'sync' })
async function open(item: Notice) {
  const token = tokenStore.updateNowTime().validToken
  if (!token) {
    toLoginPage()
    return
  }
  const current = generation
  try {
    await http.post<void>(`/miniapp/notices/${encodeURIComponent(String(item.id))}/read`)
    if (!visible || tokenStore.validToken !== token || current !== generation)
      return
    item.isRead = 1
  }
  catch {
    if (!visible || tokenStore.validToken !== token || current !== generation)
      return
    // 已读标记失败不阻止用户查看业务，列表刷新时可再次尝试。
  }
  const businessId = encodeURIComponent(String(item.businessId))
  if (item.businessType === 'PROPERTY_BOOKING')
    uni.navigateTo({ url: `/pages/property/booking-detail?id=${businessId}` })
  else if (item.businessType === 'PROPERTY_LEASE')
    uni.navigateTo({ url: `/pages/property/lease-detail?id=${businessId}` })
  else uni.switchTab({ url: '/pages/message/index' })
}
</script>

<template>
  <view class="min-h-full bg-#F7F8FA p-4">
    <view v-if="!authenticated" class="app-panel p-5">
      <text>登录后查看业务通知</text><button class="mt-4 app-primary-button" @tap="toLoginPage">
        去登录
      </button>
    </view>
    <template v-else>
      <button v-for="item in items" :key="item.id" class="mb-3 w-full rounded-xl bg-white p-4 text-left" @tap="open(item)">
        <text class="block font-bold">{{ item.isRead ? '' : '• ' }}{{ item.title }}</text><text class="mt-2 block text-sm">{{ item.content }}</text>
      </button>
      <view v-if="failed" class="app-panel p-5">
        <text>通知加载失败，请重试</text><button class="mt-3 app-secondary-button" @tap="load(failedMore)">
          重新加载
        </button>
      </view>
      <view v-if="loading" class="p-8 text-center">
        加载中…
      </view>
      <view v-else-if="!failed && !items.length" class="p-8 text-center text-gray">
        暂无通知
      </view>
      <button v-else-if="!failed && items.length < total" class="app-secondary-button" @tap="load(true)">
        加载更多
      </button>
    </template>
  </view>
</template>
