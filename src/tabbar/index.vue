<script setup lang="ts">
import { ref } from 'vue'
import { customTabbarEnable, needHideNativeTabbar } from './config'
import { setTabbarItem } from './i18n'
import { isPageTabbar, normalizeRoutePath, tabbarList, tabbarStore } from './store'
import TabbarItem from './TabbarItem.vue'

// #ifdef MP-WEIXIN
defineOptions({
  virtualHost: true,
})
// #endif

const shouldShowTabbar = ref(true)

function syncTabbarVisibility() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const currentPath = normalizeRoutePath(currentPage?.route)
  shouldShowTabbar.value = isPageTabbar(currentPath)
}

function handleClickBulge(index: number) {
  const item = tabbarList.value[index]
  if (!item) {
    return
  }

  uni.switchTab({
    url: item.pagePath,
    success() {
      tabbarStore.setCurIdx(index)
    },
  })
}

function handleClick(index: number) {
  const list = tabbarList.value
  const item = list[index]
  if (!item) {
    return
  }

  if (tabbarStore.isCurrentRouteTabbarItem(index)) {
    if (tabbarStore.isBackToTopPath(item.pagePath)) {
      uni.pageScrollTo({
        scrollTop: 0,
        duration: 300,
      })
    }
    return
  }

  if (item.isBulge) {
    handleClickBulge(index)
    return
  }
  tabbarStore.setCurIdx(index)
  uni.switchTab({ url: item.pagePath })
}

// #ifndef MP-WEIXIN || MP-ALIPAY
onLoad(() => {
  needHideNativeTabbar
  && uni.hideTabBar({
    fail(err) {
      console.log('hideTabBar fail: ', err)
    },
  })
})
// #endif

// #ifdef MP-ALIPAY
onMounted(() => {
  customTabbarEnable
  && uni.hideTabBar({
    fail(err) {
      console.log('hideTabBar fail: ', err)
    },
  })
})
// #endif

const activeColor = '#5366F6'
const inactiveColor = '#7F8BA2'

function getColorByIndex(index: number) {
  return tabbarStore.curIdx === index ? activeColor : inactiveColor
}

onShow(() => {
  syncTabbarVisibility()
  tabbarStore.syncCurIdxByCurrentPageAsync()
  setTabbarItem()
})

onMounted(syncTabbarVisibility)
</script>

<template>
  <view v-if="customTabbarEnable && shouldShowTabbar">
    <view class="app-custom-tabbar fixed inset-x-0 bottom-0 z-1000 box-border border-t-1rpx border-app-border border-t-solid bg-white" @touchmove.stop.prevent>
      <view class="mx-auto h-54px max-w-860px flex items-center">
        <button
          v-for="(item, index) in tabbarList"
          :key="index"
          class="app-tap h-full flex flex-1 flex-col items-center justify-center rounded-none bg-white p-0"
          :style="{ color: getColorByIndex(index) }"
          :aria-label="item.text"
          :aria-selected="tabbarStore.curIdx === index"
          @click="handleClick(index)"
        >
          <view v-if="item.isBulge" class="relative">
            <view class="[transform:translateX(-50%)_scale(0.5)_translateY(-33%)] absolute left-1/2 top--20px h-250rpx w-250rpx flex origin-top items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_#fefefe]">
              <TabbarItem :item="item" :index="index" class="text-center" is-bulge />
            </view>
          </view>
          <TabbarItem v-else :item="item" :index="index" class="relative px-3 text-center" />
        </button>
      </view>

      <view class="pb-safe" />
    </view>
  </view>
</template>

<style scoped>
.app-custom-tabbar {
  border-top-color: #e4ebf7;
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -8px 22px rgba(47, 78, 153, 0.1);
  padding-top: 6px;
  background: rgba(255, 255, 255, 0.98) !important;
}
</style>
