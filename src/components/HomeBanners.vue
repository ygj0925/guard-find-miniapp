<script setup lang="ts">
import type { HomeBanner } from '@/api/propertyHome'
import { computed, ref } from 'vue'

const props = defineProps<{ banners: HomeBanner[] }>()
const emit = defineEmits<{ select: [banner: HomeBanner] }>()
const failed = ref<string[]>([])
const displayed = computed<HomeBanner[]>(() => props.banners.length
  ? props.banners
  : [{
      id: 'brand',
      title: '品质公寓 · 安心入住',
      subtitle: '精选房源 · 专业服务 · 品质生活',
      imageUrl: null,
      targetType: 'all',
      targetId: null,
      enabled: true,
    }])
</script>

<template>
  <swiper class="banner-swiper" :indicator-dots="displayed.length > 1" indicator-color="#ffffff70" indicator-active-color="#ffffff" :circular="displayed.length > 1" :autoplay="displayed.length > 1" :interval="6000">
    <swiper-item v-for="banner in displayed" :key="banner.id">
      <button class="home-banner app-tap" :aria-label="banner.title" @tap="emit('select', banner)">
        <image :src="banner.imageUrl && !failed.includes(banner.id) ? banner.imageUrl : '/static/images/home-banner.jpg'" mode="aspectFill" class="banner-image" aria-hidden="true" @error="failed.push(banner.id)" />
        <view class="banner-shade" />
        <view class="banner-copy">
          <text class="banner-title">{{ banner.title }}</text>
          <text v-if="banner.subtitle" class="banner-subtitle">{{ banner.subtitle }}</text>
          <view class="banner-cta">
            立即查看<view class="i-carbon-chevron-right text-4" aria-hidden="true" />
          </view>
        </view>
        <text v-if="!banner.imageUrl || failed.includes(banner.id)" class="illustration-label">品牌氛围示意</text>
      </button>
    </swiper-item>
  </swiper>
</template>

<style scoped>
.banner-swiper {
  height: 132px;
  margin-top: 25px;
  border-radius: 20px;
  overflow: hidden;
}
.home-banner {
  position: relative;
  height: 100%;
  width: 100%;
  padding: 0;
  background: #6377ff;
  border-radius: 20px;
  text-align: left;
}
.banner-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.banner-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #4948fbf2 0%, #4e5bede0 38%, #497fff00 100%);
}
.banner-copy {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  max-width: 80%;
  padding: 20px 18px;
  color: #fff;
}
.banner-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
}
.banner-subtitle {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.5;
}
.banner-cta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  padding: 5px 12px;
  border-radius: 18px;
  background: #fff0b0;
  color: #243158;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.2;
}
.illustration-label {
  position: absolute;
  right: 8px;
  bottom: 7px;
  padding: 1px 5px;
  border-radius: 4px;
  background: #26345880;
  color: white;
  font-size: 8px;
  line-height: 1.4;
}
@media (min-width: 420px) {
  .banner-swiper {
    height: 148px;
  }
  .banner-title {
    font-size: 23px;
  }
  .banner-subtitle {
    font-size: 12px;
  }
  .banner-copy {
    padding: 24px 20px;
  }
}
</style>
