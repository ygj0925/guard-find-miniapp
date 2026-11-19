<script setup lang="ts">
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getUserInfo } from '@/api/login'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'
import WeChatPageHeader from '@/components/WeChatPageHeader.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '房源管理', backgroundColor: '#F5F7FF' } })

type Identity = 'checking' | 'guest' | 'resident' | 'manager' | 'error'
const tokenStore = useTokenStore()
const identity = ref<Identity>('checking')
const verifiedToken = ref('')
const canManage = computed(() => identity.value === 'manager' && !!verifiedToken.value && verifiedToken.value === tokenStore.validToken)
const entries = [
  { title: '我的房源', hint: '编辑房源、管理上下架状态', icon: 'i-carbon-building', url: '/pages/property/personal?kind=mine' },
  { title: '发布房源', hint: '完善房源信息，让好房被看见', icon: 'i-carbon-add-alt', url: '/pages/property/edit' },
  { title: '业主预约', hint: '查看并处理收到的看房预约', icon: 'i-carbon-calendar', url: '/pages/property/bookings?role=owner' },
]
let version = 0
let active = false
let disposed = false

function invalidate() {
  version++
  verifiedToken.value = ''
  identity.value = tokenStore.updateNowTime().hasLogin ? 'error' : 'guest'
}
watch(() => tokenStore.validToken, invalidate, { flush: 'sync' })
onShow(() => {
  active = true
  void checkIdentity()
})
onHide(() => {
  active = false
  invalidate()
})
function dispose() {
  disposed = true
  active = false
  version++
}
onUnload(dispose)
onBeforeUnmount(dispose)

function isCurrent(current: number, token: string) {
  return !disposed && active && current === version
    && tokenStore.updateNowTime().hasLogin && token === tokenStore.validToken
}
async function checkIdentity() {
  if (disposed || !active)
    return
  const current = ++version
  verifiedToken.value = ''
  if (!tokenStore.updateNowTime().hasLogin) {
    identity.value = 'guest'
    return
  }
  const token = tokenStore.validToken
  identity.value = 'checking'
  try {
    const user = await getUserInfo({ header: { Authorization: `Bearer ${token}` }, hideErrorToast: true })
    if (!isCurrent(current, token))
      return
    verifiedToken.value = token
    identity.value = user?.isPropertyManager === true ? 'manager' : 'resident'
  }
  catch {
    if (isCurrent(current, token))
      identity.value = 'error'
  }
}
function openManagerEntry(url: string) {
  if (!tokenStore.updateNowTime().hasLogin) {
    identity.value = 'guest'
    toLoginPage()
    return
  }
  if (canManage.value && active && !disposed)
    uni.navigateTo({ url })
}
function support() {
  if (!tokenStore.updateNowTime().hasLogin) {
    toLoginPage()
    return
  }
  uni.navigateTo({ url: '/pages/message/chat?mode=support' })
}
function viewProperties() {
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="app-tab-page">
    <WeChatPageHeader title="房源管理" subtitle="发布、维护与处理看房预约" />
    <view class="app-content py-6">
      <text class="block text-26px text-app-ink font-bold">房源管理</text>
      <text class="mt-2 block text-sm text-app-muted leading-6">公寓管家统一维护，房源信息安心可靠</text>

      <view v-if="identity === 'checking'" class="mt-6 app-panel app-state gap-3 px-5 py-12">
        <view class="i-carbon-circle-dash h-8 w-8 animate-spin text-brand-blue" />
        <text class="text-sm text-app-muted">正在核验管理身份</text>
      </view>
      <view v-else-if="identity === 'guest'" class="mt-6 app-panel app-state gap-3 px-5 py-10">
        <view class="i-carbon-locked h-10 w-10 text-brand-blue" />
        <text class="text-lg text-app-ink font-semibold">登录后使用房源服务</text>
        <text class="text-center text-sm text-app-muted leading-6">管家登录后可维护房源与看房预约</text>
        <button class="mt-3 app-primary-button w-full" @tap="toLoginPage()">
          去登录
        </button>
      </view>
      <view v-else-if="identity === 'error'" class="mt-6 app-panel app-state gap-3 px-5 py-10">
        <view class="i-carbon-warning-alt h-9 w-9 text-app-warning" />
        <text class="text-lg text-app-ink font-semibold">管理身份核验失败</text>
        <text class="text-center text-sm text-app-muted leading-6">暂时无法确认身份，请重试。核验前不开放房源维护。</text>
        <button class="mt-3 app-secondary-button w-full" @tap="checkIdentity">
          重新核验
        </button>
      </view>
      <view v-else-if="canManage" class="mt-6">
        <view class="mb-3 flex items-center gap-2 text-brand-blue">
          <view class="i-carbon-security h-5 w-5" />
          <text class="text-sm font-semibold">公寓管家工作台</text>
        </view>
        <button
          v-for="entry in entries"
          :key="entry.url"
          class="manager-entry app-tap mb-3 app-panel w-full flex items-center gap-3 p-4 text-left"
          :aria-label="entry.title"
          @tap="openManagerEntry(entry.url)"
        >
          <view class="h-12 w-12 flex shrink-0 items-center justify-center rounded-xl bg-app-soft text-brand-blue">
            <view :class="entry.icon" class="h-6 w-6" />
          </view>
          <view class="min-w-0 flex-1">
            <text class="block text-base text-app-ink font-semibold">{{ entry.title }}</text>
            <text class="mt-1 block text-xs text-app-muted leading-5">{{ entry.hint }}</text>
          </view>
          <view class="i-carbon-chevron-right h-5 w-5 shrink-0 text-app-muted" />
        </button>
      </view>
      <view v-else class="mt-6 app-panel app-state gap-3 px-5 py-10">
        <view class="i-carbon-home h-10 w-10 text-brand-blue" />
        <text class="text-center text-lg text-app-ink font-semibold leading-7">房源由公寓管家统一维护</text>
        <text class="text-center text-sm text-app-muted leading-6">想找房、了解房源或预约看房？欢迎在线咨询管家。</text>
      </view>

      <view class="grid grid-cols-2 mt-6 gap-3">
        <button class="app-secondary-button w-full" @tap="support">
          在线咨询
        </button>
        <button class="app-secondary-button w-full" @tap="viewProperties">
          查看房源
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.manager-entry {
  min-height: 88px;
}
</style>
