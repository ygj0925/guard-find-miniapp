<script setup lang="ts">
/**
 * 我的页面:用户信息 + 官方客服入口 + 退出登录。
 */
import type { IUserInfoRes } from '@/api/types/login'
import { getUserInfo, logout } from '@/api/login'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationBarTitleText: '我的',
    backgroundColor: '#F7F8FA',
  },
})

const userStore = useUserStore()
const tokenStore = useTokenStore()
const profile = ref<IUserInfoRes | null>(null)
let version = 0
onHide(() => {
  version++
})
onUnload(() => {
  version++
})
function go(url: string) {
  if (requireLogin())
    uni.navigateTo({ url })
}

onShow(() => {
  const current = ++version
  tokenStore.updateNowTime()
  if (!tokenStore.hasLogin) {
    profile.value = null
    return
  }
  getUserInfo()
    .then((info) => {
      if (current !== version || !tokenStore.updateNowTime().hasLogin)
        return
      profile.value = info
      userStore.setUserInfo(info)
    })
    .catch(() => {})
})

function requireLogin(): boolean {
  tokenStore.updateNowTime()
  if (tokenStore.hasLogin)
    return true
  toLoginPage()
  return false
}

function goSupport() {
  if (!requireLogin())
    return
  uni.navigateTo({
    url: '/pages/message/chat?mode=support&peerName=%E5%AE%98%E6%96%B9%E5%AE%A2%E6%9C%8D',
  })
}

function onLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出当前账号?',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await logout()
      }
      catch {}
      version++
      tokenStore.clearLoginState()
      userStore.clearUserInfo()
      profile.value = null
      uni.showToast({ title: '已退出', icon: 'none' })
    },
  })
}
</script>

<template>
  <view class="min-h-full bg-#F7F8FA pb-10">
    <!-- 用户卡片 -->
    <view class="from-#EDF6FF to-#F7F8FA bg-gradient-to-b px-6 pb-10 pt-10">
      <view class="flex items-center gap-4" @tap="requireLogin">
        <image
          v-if="profile && profile.avatar"
          :src="profile.avatar"
          class="h-16 w-16 rounded-full bg-white"
        />
        <view
          v-else
          class="h-16 w-16 flex items-center justify-center rounded-full bg-white text-xl text-#1677FF"
        >
          人
        </view>
        <view>
          <text class="block text-lg text-#303133 font-bold">
            {{ profile && profile.nickname ? profile.nickname : "未登录" }}
          </text>
          <text class="mt-1 block text-xs text-#909399">
            {{
              profile && profile.phone
                ? profile.phone
                : "点击登录后使用私信与收藏"
            }}
          </text>
        </view>
      </view>
    </view>

    <view v-if="profile" class="px-6 pb-8 text-xs text-gray">
      我的用户 ID：{{ profile.userId }}
    </view>
    <!-- 菜单 -->
    <view class="mx-3 overflow-hidden rounded-2xl bg-white shadow-sm -mt-6">
      <view
        v-for="entry in [
          { label: '发布房源', url: '/pages/property/edit' },
          { label: '我的房源', url: '/pages/property/personal?kind=mine' },
          { label: '我的收藏', url: '/pages/property/personal?kind=favorites' },
          { label: '浏览记录', url: '/pages/property/personal?kind=history' },
          { label: '看房预约', url: '/pages/property/bookings' },
          { label: '业务通知', url: '/pages/message/notices' },
        ]"
        :key="entry.url"
        class="border-b border-#F5F7FA border-solid p-4"
        @tap="go(entry.url)"
      >
        {{ entry.label }} ›
      </view>
      <view
        class="flex items-center border-b border-#F5F7FA border-solid p-4"
        @tap="goSupport"
      >
        <text class="flex-1 text-15px text-#303133">联系客服</text>
        <text class="text-xs text-#C0C4CC">›</text>
      </view>
      <view v-if="profile" class="flex items-center p-4" @tap="onLogout">
        <text class="flex-1 text-15px text-#FA5151">退出登录</text>
      </view>
    </view>

    <view class="mt-6 text-center text-xs text-#C0C4CC">
      生生智家 · 房源管家
    </view>
  </view>
</template>

<style scoped></style>
