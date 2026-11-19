<script setup lang="ts">
const emit = defineEmits<{ select: [key: string] }>()
const categories = [
  { key: 'whole', label: '整套房源', icon: 'i-carbon-home', image: '/static/images/design-icons/home.png', color: 'purple' },
  { key: 'room', label: '单间', icon: 'i-carbon-home', image: '/static/images/design-icons/room.png', color: 'orange' },
  { key: 'short', label: '民宿短租', icon: 'i-carbon-home', image: '/static/images/design-icons/homestay.png', color: 'green' },
  { key: 'apartment', label: '公寓', icon: 'i-carbon-building', image: '/static/images/design-icons/apartment.png', color: 'blue' },
]
const services = [
  { key: 'map', label: '地图找房', icon: 'i-carbon-map', image: '/static/images/design-icons/map.png', color: 'blue' },
  { key: 'phone', label: '电话咨询', icon: 'i-carbon-phone-filled', image: '/static/images/design-icons/phone.png', color: 'green' },
  { key: 'chat', label: '在线咨询', icon: 'i-carbon-chat', image: '/static/images/design-icons/chat.png', color: 'blue' },
  { key: 'recommended', label: '房源推荐', icon: 'i-carbon-star-filled', image: '/static/images/design-icons/favorite.png', color: 'gold' },
  { key: 'activities', label: '优惠活动', icon: 'i-carbon-gift', image: '/static/images/design-icons/calendar.png', color: 'red' },
  { key: 'support', label: '客服中心', icon: 'i-carbon-headset', image: '/static/images/design-icons/service.png', color: 'purple' },
]
</script>

<template>
  <view class="shortcut-row category-row">
    <button v-for="entry in categories" :key="entry.key" class="shortcut app-tap" @tap="emit('select', entry.key)">
      <view class="shortcut-art" :class="entry.color">
        <image v-if="entry.image" :src="entry.image" mode="aspectFit" class="shortcut-icon" aria-hidden="true" />
        <view v-if="entry.key === 'room'" class="room-art" aria-hidden="true">
          <view class="room-handle" />
        </view>
        <view v-else-if="entry.key === 'short'" class="short-art" aria-hidden="true">
          <view class="short-back" /><view class="short-seat" /><view class="short-arm short-arm-left" /><view class="short-arm short-arm-right" />
        </view>
        <view v-else :class="entry.icon" class="art-icon" aria-hidden="true" />
      </view>
      <text>{{ entry.label }}</text>
    </button>
  </view>
  <view class="shortcut-row service-row">
    <button v-for="entry in services" :key="entry.key" class="shortcut app-tap" @tap="emit('select', entry.key)">
      <view class="shortcut-art" :class="entry.color">
        <image v-if="entry.image" :src="entry.image" mode="aspectFit" class="shortcut-icon" aria-hidden="true" />
        <view :class="entry.icon" class="art-icon" aria-hidden="true" />
        <text v-if="entry.key === 'recommended'" class="hot-label">HOT</text>
      </view>
      <text>{{ entry.label }}</text>
    </button>
  </view>
</template>

<style scoped>
.shortcut-row {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}
.category-row {
  margin-top: 26px;
}
.service-row {
  margin-top: 19px;
}
.shortcut {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0;
  overflow: visible;
  border-radius: 12px;
  background: transparent;
  color: #1e3159;
  font-size: 13px;
  line-height: 1.4;
}
.shortcut-art {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 17px;
  background: linear-gradient(145deg, #ffffffd9, var(--tint));
}
.art-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(140deg, var(--light), var(--deep));
  filter: drop-shadow(0 4px 2px var(--tint));
}
.shortcut-icon {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  border-radius: inherit;
}
.shortcut-art > .art-icon,
.shortcut-art > .room-art,
.shortcut-art > .short-art {
  display: none;
}
.room-art {
  position: relative;
  width: 27px;
  height: 35px;
  border-radius: 5px;
  background: linear-gradient(140deg, var(--light), var(--deep));
  box-shadow: -5px 0 0 -1px #ffb39b;
}
.room-handle {
  position: absolute;
  right: 4px;
  top: 17px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #fff4e8;
}
.short-art {
  position: relative;
  width: 38px;
  height: 32px;
  border-bottom: 3px solid var(--deep);
  border-radius: 7px;
}
.short-back {
  position: absolute;
  top: 0;
  left: 5px;
  width: 28px;
  height: 25px;
  border-radius: 8px;
  background: linear-gradient(140deg, var(--light), var(--deep));
}
.short-seat {
  position: absolute;
  bottom: 1px;
  left: 2px;
  width: 34px;
  height: 10px;
  border-radius: 5px;
  background: var(--deep);
  border-top: 3px solid #72ebc7;
}
.short-arm {
  position: absolute;
  bottom: 5px;
  width: 7px;
  height: 16px;
  border-radius: 5px;
  background: #46d5aa;
}
.short-arm-left {
  left: 0;
}
.short-arm-right {
  right: 0;
}
.service-row .shortcut {
  font-size: 12px;
}
.service-row .shortcut-art {
  width: 43px;
  height: 43px;
  border-radius: 14px;
}
.service-row .art-icon {
  width: 30px;
  height: 30px;
}
.purple {
  --light: #a38aff;
  --deep: #6848ff;
  --tint: #dad2ff;
}
.orange {
  --light: #ffa485;
  --deep: #ff744b;
  --tint: #ffe2dc;
}
.green {
  --light: #5ae0b7;
  --deep: #21bc8d;
  --tint: #d1f3ec;
}
.blue {
  --light: #6fc5ff;
  --deep: #2989ff;
  --tint: #d4e9ff;
}
.gold {
  --light: #ffd058;
  --deep: #ffa518;
  --tint: #fff0d7;
}
.red {
  --light: #ff9291;
  --deep: #ff515d;
  --tint: #ffe1e5;
}
.hot-label {
  position: absolute;
  z-index: 2;
  right: -10px;
  top: -5px;
  padding: 1px 5px;
  border-radius: 8px;
  background: #ff4651;
  color: #fff;
  font-size: 9px;
}
@media (min-width: 420px) {
  .shortcut {
    font-size: 14px;
  }
  .service-row .shortcut {
    font-size: 12px;
  }
  .shortcut-art {
    width: 58px;
    height: 58px;
  }
  .service-row .shortcut-art {
    width: 48px;
    height: 48px;
  }
}
</style>
