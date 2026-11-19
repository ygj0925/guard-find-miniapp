<script setup lang="ts">
import type { LeaseDetail } from '@/api/leases'
import { computed, ref, watch } from 'vue'
import { fetchLeases, leaseStatusLabels } from '@/api/leases'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'
import WeChatPageHeader from '@/components/WeChatPageHeader.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '我的租约', backgroundColor: '#F5F7FF', enablePullDownRefresh: true } })
const tokenStore = useTokenStore()
const authenticated = computed(() => Boolean(tokenStore.validToken))
const items = ref<LeaseDetail[]>([])
const loading = ref(false)
const failed = ref(false)
const failedMore = ref(false)
const status = ref('')
const page = ref(0)
const total = ref(0)
let generation = 0
let visible = false
const filters = [{ value: '', label: '全部' }, { value: 'PENDING_SIGNATURE', label: '待签署' }, { value: 'SIGNED', label: '已签署' }, { value: 'EXPIRED', label: '已到期' }, { value: 'SIGNING_EXPIRED', label: '签署超时' }, { value: 'TERMINATED', label: '已终止' }]
function invalidate() {
  generation++
  loading.value = false
}
async function load(more = false) {
  const token = tokenStore.updateNowTime().validToken
  if (!token || !visible || loading.value || (more && items.value.length >= total.value))
    return
  const current = ++generation
  const next = more ? page.value + 1 : 1
  loading.value = true
  failedMore.value = more
  failed.value = false
  const valid = () => visible && current === generation && tokenStore.validToken === token
  try {
    const response = await fetchLeases({ page: next, size: 10, status: status.value || undefined })
    if (!valid())
      return
    // 草稿仅供后台编辑，即使旧服务错误返回也不在用户端显示。
    const published = response.list.filter(item => item.status !== 'DRAFT')
    items.value = more ? [...new Map([...items.value, ...published].map(item => [item.id, item])).values()] : published
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
function choose(value: string) {
  invalidate()
  status.value = value
  items.value = []
  page.value = 0
  total.value = 0
  void load()
}
function open(id: string) {
  if (tokenStore.updateNowTime().validToken && /^[1-9]\d*$/.test(id))
    uni.navigateTo({ url: `/pages/property/lease-detail?id=${id}` })
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
onReachBottom(() => void load(true))
onPullDownRefresh(() => {
  invalidate()
  load().finally(() => uni.stopPullDownRefresh())
})
watch(() => tokenStore.validToken, () => {
  invalidate()
  items.value = []
  total.value = 0
  page.value = 0
  failed.value = false
  if (visible)
    void load()
}, { flush: 'sync' })
</script>

<template>
  <view class="app-page">
    <WeChatPageHeader title="我的租约" subtitle="合同签署、审阅与续租进度" />
    <view class="app-content py-6">
      <view v-if="!authenticated" class="app-panel p-5">
        <text class="block text-lg font-bold">登录后查看合同与续租进度</text>
        <button class="mt-4 app-primary-button" @tap="toLoginPage">
          去登录
        </button>
      </view>
      <template v-else>
        <view class="mb-4 app-panel p-5">
          <text class="block text-xl font-bold">合同与租期服务</text>
          <text class="mt-2 block text-sm text-app-muted">签署合同、申请续租和查看临期提醒。待签署合同需出租方与承租方分别确认。</text>
        </view>
        <view class="mb-4 flex flex-wrap gap-2">
          <button v-for="filter in filters" :key="filter.value" class="app-secondary-button text-sm" :class="status === filter.value ? 'text-brand-blue' : ''" :aria-label="filter.label" @tap="choose(filter.value)">
            {{ filter.label }}
          </button>
        </view>
        <button v-for="item in items" :key="item.id" class="mb-4 app-panel w-full p-5 text-left" @tap="open(item.id)">
          <text class="block font-bold">{{ item.title }}</text>
          <text class="mt-2 block text-brand-blue">{{ leaseStatusLabels[item.status] }}</text>
          <text class="mt-2 block">{{ item.propertyTitle }}</text>
          <text class="mt-2 block text-sm text-app-muted">{{ item.startDate }} 至 {{ item.endDate }}</text>
          <text class="mt-2 block text-sm">{{ item.isTenant ? '我是承租方' : '我是出租方' }} · 月租 ¥{{ item.monthlyRent }}</text>
          <text v-if="item.status === 'SIGNED' || item.status === 'EXPIRED'" class="mt-2 block text-sm text-brand-blue">{{ item.daysRemaining > 0 ? `距租期结束 ${item.daysRemaining} 天` : item.daysRemaining === 0 ? '今天租期结束' : '租期已结束' }}</text>
        </button>
        <view v-if="failed" class="app-panel p-5">
          <text>合同加载失败，请重试。</text>
          <button class="mt-3 app-secondary-button" @tap="load(failedMore)">
            重新加载
          </button>
        </view>
        <text v-if="loading" class="block p-5 text-center text-app-muted">正在加载合同…</text>
        <view v-else-if="!failed && !items.length" class="app-panel p-5">
          暂无相关合同。合同由管理后台创建并发送给签约双方。
        </view>
        <button v-else-if="!failed && items.length < total" class="app-secondary-button" @tap="load(true)">
          加载更多
        </button>
        <text v-else-if="items.length" class="block p-4 text-center text-sm text-app-muted">已显示全部合同</text>
      </template>
    </view>
  </view>
</template>
