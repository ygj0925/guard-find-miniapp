<script setup lang="ts">
import { http } from '@/http/http'

definePage({ style: { navigationBarTitleText: '业务通知' } })
interface Notice {
  id: string | number
  businessType: string
  businessId: string | number
  title: string
  content: string
  isRead: number
}
const items = ref<Notice[]>([])
const page = ref(0)
const total = ref(0)
const loading = ref(false)
async function load(more = false) {
  if (loading.value)
    return
  loading.value = true
  try {
    const next = more ? page.value + 1 : 1
    const r = await http.get<{ list: Notice[], total: number }>(
      '/miniapp/notices',
      { page: next, size: 20 },
    )
    items.value = more ? [...items.value, ...r.list] : r.list
    page.value = next
    total.value = r.total
  }
  finally {
    loading.value = false
  }
}
onShow(() => load())
onReachBottom(() => {
  if (items.value.length < total.value)
    void load(true)
})
async function open(item: Notice) {
  await http.post<void>(`/miniapp/notices/${item.id}/read`)
  item.isRead = 1
  if (item.businessType === 'PROPERTY_BOOKING')
    uni.navigateTo({ url: '/pages/property/bookings' })
  else uni.switchTab({ url: '/pages/message/index' })
}
</script>

<template>
  <view class="min-h-full bg-#F7F8FA p-4">
    <view
      v-for="item in items"
      :key="item.id"
      class="mb-3 rounded-xl bg-white p-4"
      @tap="open(item)"
    >
      <text class="block font-bold">
        {{ item.isRead ? "" : "• " }}{{ item.title }}
      </text><text class="mt-2 block text-sm">{{ item.content }}</text>
    </view><view v-if="loading" class="p-8 text-center">
      加载中…
    </view><view v-else-if="!items.length" class="p-8 text-center text-gray">
      暂无通知
    </view>
  </view>
</template>
