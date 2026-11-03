<script setup lang="ts">
import type { Property } from '@/api/property'
import {
  changePropertyStatus,
  deleteProperty,
  fetchPersonalProperties,
} from '@/api/property'

definePage({ style: { navigationBarTitleText: '我的房源' } })
const kind = ref<'mine' | 'favorites' | 'history'>('mine')
const items = ref<Property[]>([])
const total = ref(0)
const page = ref(0)
const loading = ref(false)
const error = ref(false)
let generation = 0
onLoad((q) => {
  if (q?.kind === 'favorites' || q?.kind === 'history')
    kind.value = q.kind
  uni.setNavigationBarTitle({
    title: { mine: '我的房源', favorites: '我的收藏', history: '浏览记录' }[
      kind.value
    ],
  })
})
async function load(more = false) {
  if (more && loading.value)
    return
  const current = ++generation
  loading.value = true
  error.value = false
  try {
    const next = more ? page.value + 1 : 1
    const res = await fetchPersonalProperties(kind.value, next)
    if (current !== generation)
      return
    items.value = more ? [...items.value, ...res.list] : res.list
    total.value = res.total
    page.value = next
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
onShow(() => load())
onUnload(() => {
  generation++
})
onReachBottom(() => {
  if (items.value.length < total.value)
    void load(true)
})
function detail(item: Property) {
  uni.navigateTo({ url: `/pages/property/detail?id=${item.id}` })
}
function edit(id = '') {
  uni.navigateTo({ url: `/pages/property/edit?id=${id}` })
}
async function status(item: Property) {
  await changePropertyStatus(item.id, item.status === 2 ? 3 : 2)
  await load()
}
function remove(item: Property) {
  uni.showModal({
    title: '删除房源',
    content: '有进行中的预约时需先处理预约，确定删除？',
    success: async (r) => {
      if (r.confirm) {
        await deleteProperty(item.id)
        await load()
      }
    },
  })
}
</script>

<template>
  <view class="min-h-full bg-#F7F8FA p-4">
    <button
      v-if="kind === 'mine'"
      class="mb-4 bg-#1677FF text-white"
      @tap="edit()"
    >
      发布房源
    </button>
    <view
      v-for="item in items"
      :key="item.id"
      class="mb-3 rounded-xl bg-white p-4"
    >
      <view @tap="detail(item)">
        <text class="block font-bold">{{ item.title }}</text><text class="mt-2 block text-sm">
          ¥{{ item.price }}{{ item.priceType === "rent" ? "/月" : "" }} ·
          {{ item.address }}
        </text>
      </view>
      <view v-if="kind === 'mine'" class="mt-3 flex flex-wrap gap-2">
        <text class="text-sm text-gray">
          {{
            { 1: "草稿", 2: "已上架", 3: "已下架" }[item.status]
          }}
        </text>
        <button size="mini" @tap="edit(String(item.id))">
          编辑
        </button><button size="mini" @tap="status(item)">
          {{ item.status === 2 ? "下架" : "上架" }}
        </button><button size="mini" @tap="remove(item)">
          删除
        </button>
      </view>
    </view>
    <view v-if="loading" class="p-5 text-center">
      加载中…
    </view><button v-else-if="error" @tap="load()">
      加载失败，点击重试
    </button><view v-else-if="!items.length" class="p-10 text-center text-gray">
      暂无记录
    </view>
  </view>
</template>
