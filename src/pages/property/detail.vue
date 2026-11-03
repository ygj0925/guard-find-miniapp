<script setup lang="ts">
/**
 * 房源详情:图片轮播 + 全字段展示 + 打电话/发私信。
 */
import type { Property } from '@/api/property'
import {
  fetchPropertyDetail,
  PROPERTY_TYPE_LABEL,
  toggleFavorite,
} from '@/api/property'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationBarTitleText: '房源详情',
    backgroundColor: '#F7F8FA',
  },
})

const id = ref('')
const property = ref<Property | null>(null)
const loading = ref(true)
const favoriting = ref(false)
let requestVersion = 0
onUnload(() => {
  requestVersion++
})

onLoad((query) => {
  id.value = String(query?.id ?? '')
  load()
})

async function load() {
  if (!id.value) {
    loading.value = false
    return
  }
  const version = ++requestVersion
  loading.value = true
  try {
    const data = await fetchPropertyDetail(id.value)
    if (version === requestVersion)
      property.value = data
  }
  catch {
  }
  finally {
    if (version === requestVersion)
      loading.value = false
  }
}

function requireLogin() {
  const token = useTokenStore().updateNowTime()
  if (token.hasLogin)
    return true
  toLoginPage()
  return false
}
async function favorite() {
  if (!requireLogin() || !property.value || favoriting.value)
    return
  favoriting.value = true
  try {
    property.value.isFavorited = (await toggleFavorite(id.value)).favorited
  }
  finally {
    favoriting.value = false
  }
}
function book() {
  if (requireLogin())
    uni.navigateTo({ url: `/pages/property/bookings?propertyId=${id.value}` })
}

function callOwner() {
  const phone = property.value?.contactPhone
  if (!phone) {
    uni.showToast({ title: '房东未留电话,可发私信', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: phone })
}

function chatWithOwner() {
  const token = useTokenStore()
  token.updateNowTime()
  if (!token.hasLogin) {
    toLoginPage()
    return
  }
  const name = encodeURIComponent(
    property.value?.contactName || property.value?.ownerNickname || '房东',
  )
  uni.navigateTo({
    url: `/pages/message/chat?peerId=${property.value?.userId}&peerName=${name}`,
  })
}

function infoChips(item: Property) {
  const chips: string[] = []
  if (item.rentalMode)
    chips.push(item.rentalMode === 'whole' ? '整租' : '合租')
  if (item.layout)
    chips.push(item.layout)
  if (item.areaSqm)
    chips.push(`${item.areaSqm}㎡`)
  if (item.orientation)
    chips.push(item.orientation)
  if (item.floorInfo)
    chips.push(`${item.floorInfo}层`)
  if (item.decoration)
    chips.push(item.decoration)
  if (item.availableFrom)
    chips.push(`${String(item.availableFrom).slice(0, 10)} 可入住`)
  return chips
}
</script>

<template>
  <view class="min-h-full bg-#F7F8FA pb-44">
    <template v-if="property">
      <!-- 图片轮播 -->
      <swiper
        v-if="property.images && property.images.length"
        class="h-64 w-full"
        indicator-dots
        circular
      >
        <swiper-item v-for="img in property.images" :key="img">
          <image :src="img" mode="aspectFill" class="h-full w-full" />
        </swiper-item>
      </swiper>
      <view
        v-else
        class="h-48 w-full flex items-center justify-center bg-#EDF6FF text-sm text-#A8ABB2"
      >
        暂无图片
      </view>

      <view class="mx-3 mt-3 rounded-2xl bg-white p-4">
        <view class="flex items-start gap-2">
          <text class="flex-1 text-lg text-#303133 font-bold">
            {{
              property.title
            }}
          </text>
          <text
            v-if="property.ownerIsManager"
            class="mt-1 rounded-full bg-#1677FF px-2 py-0.5 text-10px text-white"
          >
            认证管家
          </text>
        </view>
        <view class="mt-2 flex items-baseline gap-2">
          <text class="text-2xl text-#FA5151 font-bold">
            ¥{{ property.price }}
          </text>
          <text
            v-if="property.priceType === 'rent'"
            class="text-xs text-#909399"
          >
            /月
          </text>
          <text class="text-xs text-#909399">
            {{
              PROPERTY_TYPE_LABEL[property.propertyType]
            }}
          </text>
        </view>
        <view class="mt-2 flex flex-wrap gap-2">
          <text
            v-for="chip in infoChips(property)"
            :key="chip"
            class="rounded-full bg-#EDF6FF px-3 py-1 text-xs text-#1677FF"
          >
            {{ chip }}
          </text>
        </view>
        <view
          v-if="property.community || property.address"
          class="mt-3 flex items-center gap-1 text-xs text-#909399"
        >
          <text class="truncate">
            📍
            {{
              [
                property.city,
                property.district,
                property.community,
                property.address,
              ]
                .filter(Boolean)
                .join(" ")
            }}
          </text>
        </view>
        <view
          v-if="property.description"
          class="mt-3 border-t border-#F0F0F0 border-solid pt-3"
        >
          <text class="text-xs text-#909399 font-semibold">房源描述</text>
          <text class="mt-1 block text-sm text-#303133 leading-6">
            {{
              property.description
            }}
          </text>
        </view>
        <view
          v-if="property.facilities && property.facilities.length"
          class="mt-3 border-t border-#F0F0F0 border-solid pt-3"
        >
          <text class="text-xs text-#909399 font-semibold">配套设施</text>
          <view class="mt-1 flex flex-wrap gap-2">
            <text
              v-for="f in property.facilities"
              :key="f"
              class="rounded-full bg-#F7F8FA px-3 py-1 text-xs text-#606266"
            >
              {{ f }}
            </text>
          </view>
        </view>
      </view>

      <!-- 底部操作 -->
      <view
        class="fixed inset-x-0 bottom-0 grid grid-cols-2 gap-3 border-t border-#F0F0F0 border-solid bg-white px-4 py-3 pb-6"
      >
        <button
          class="m-0 rounded-full text-sm"
          :disabled="favoriting"
          @tap="favorite"
        >
          {{ property.isFavorited ? "取消收藏" : "收藏房源" }}
        </button>
        <button class="m-0 rounded-full text-sm" @tap="book">
          预约看房
        </button>
        <button
          class="m-0 flex-1 border border-#1677FF rounded-full border-solid bg-white text-sm text-#1677FF"
          @tap="callOwner"
        >
          打电话
        </button>
        <button
          class="m-0 flex-1 rounded-full bg-#1677FF text-sm text-white"
          @tap="chatWithOwner"
        >
          发私信聊
        </button>
      </view>
    </template>
    <view v-else-if="loading" class="py-20 text-center text-sm text-#909399">
      加载中…
    </view>
    <view v-else class="py-20 text-center text-sm text-#909399">
      房源不存在
    </view>
  </view>
</template>

<style scoped></style>
