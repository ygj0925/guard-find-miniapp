<script setup lang="ts">
import type { Property } from '@/api/property'
import { computed, ref } from 'vue'
import { propertyPriceSuffix, toggleFavorite } from '@/api/property'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

const props = defineProps<{ item: Property }>()
const emit = defineEmits<{ favorite: [id: Property['id'], favorited: boolean] }>()
const failed = ref(false)
const busy = ref(false)
const cornerLabel = computed(() => {
  if (props.item.recommended)
    return '优选'
  if (props.item.facilities?.some(item => /地铁/.test(item)) || /地铁/.test(props.item.title))
    return '近地铁'
  if (props.item.propertyType === 'apartment')
    return '品质公寓'
  return ''
})

function detail() {
  uni.navigateTo({ url: `/pages/property/detail?id=${encodeURIComponent(String(props.item.id))}` })
}

async function favorite() {
  const store = useTokenStore().updateNowTime()
  if (!store.hasLogin) {
    toLoginPage()
    return
  }
  if (busy.value)
    return
  const token = store.validToken
  busy.value = true
  try {
    const result = await toggleFavorite(props.item.id)
    if (useTokenStore().updateNowTime().validToken === token)
      emit('favorite', props.item.id, result.favorited)
  }
  catch {
    uni.showToast({ title: '收藏操作失败，请重试', icon: 'none' })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="property-card">
    <button class="property-main app-tap" :aria-label="`查看房源：${item.title}`" @tap="detail">
      <view class="property-image">
        <image v-if="item.images?.length && !failed" :src="item.images[0]" mode="aspectFill" class="property-photo h-full w-full" aria-hidden="true" @error="failed = true" />
        <view v-else class="h-full flex flex-col items-center justify-center gap-2 bg-app-soft text-app-muted">
          <view class="i-carbon-image text-7" aria-hidden="true" /><text class="text-10px">暂无图片</text>
        </view>
        <text v-if="cornerLabel" class="preferred">{{ cornerLabel }}</text>
      </view>
      <view class="property-info">
        <text class="property-title">{{ item.title }}</text>
        <view class="location-line">
          <view class="i-carbon-location shrink-0 text-4" aria-hidden="true" />
          <text class="truncate">{{ [item.district || item.city, item.community || item.address].filter(Boolean).join(' · ') }}</text>
        </view>
        <view class="property-tags">
          <text v-if="item.layout" class="property-tag">{{ item.layout }}</text>
          <text v-if="item.areaSqm" class="property-tag">{{ item.areaSqm }}㎡</text>
          <text v-if="item.facilities?.length" class="property-tag">{{ item.facilities[0] }}</text>
        </view>
        <view class="property-price">
          <text class="currency">¥</text><text>{{ item.price }}</text><text class="price-unit">{{ propertyPriceSuffix(item) }}</text>
        </view>
      </view>
    </button>
    <button class="favorite-button app-tap" :class="item.isFavorited ? 'is-favorite' : ''" :disabled="busy" :aria-label="item.isFavorited ? '取消收藏' : '收藏房源'" @tap="favorite">
      <view :class="item.isFavorited ? 'i-carbon-favorite-filled' : 'i-carbon-favorite'" class="text-6" aria-hidden="true" />
    </button>
  </view>
</template>

<style scoped>
.property-card {
  position: relative;
  min-width: 0;
  border: 1px solid #e6ecf7;
  border-radius: 24px;
  background: #fff;
  padding: 12px;
  box-shadow: 0 8px 22px rgba(47, 78, 153, 0.08);
}
.property-main {
  display: flex;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding: 0;
  background: transparent;
  text-align: left;
  line-height: 1.5;
}
.property-image {
  position: relative;
  flex-shrink: 0;
  width: 40%;
  min-height: 144px;
  overflow: hidden;
  border-radius: 18px;
}
.property-photo {
  position: absolute;
  inset: 0;
}
.preferred {
  position: absolute;
  top: 0;
  left: 0;
  padding: 4px 10px;
  border-radius: 0 0 11px 0;
  background: #5366f6;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
.property-info {
  flex: 1;
  min-width: 0;
  padding: 2px 0;
}
.property-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  padding-right: 30px;
  color: #142653;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.42;
}
.location-line {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 8px;
  color: #6e7d99;
  font-size: 13px;
}
.property-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 7px;
  color: #7784a2;
  font-size: 12px;
}
.property-tag {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 3px 7px;
  border-radius: 8px;
  background: #f3f6fc;
}
.property-price {
  display: flex;
  align-items: baseline;
  margin-top: 11px;
  color: #5366f6;
  font-size: 25px;
  font-weight: 750;
  line-height: 1.2;
}
.currency {
  margin-right: 2px;
  font-size: 14px;
}
.price-unit {
  margin-left: 4px;
  color: #7b89a5;
  font-size: 12px;
  font-weight: 400;
}
.favorite-button {
  position: absolute;
  top: 8px;
  right: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  background: transparent;
  color: #8994af;
}
.is-favorite {
  color: #5366f6;
}
@media (min-width: 420px) {
  .property-card {
    padding: 14px;
  }
  .property-title {
    font-size: 18px;
  }
  .property-image {
    min-height: 154px;
  }
  .location-line {
    font-size: 13px;
  }
  .property-tags {
    font-size: 12px;
  }
}
</style>
