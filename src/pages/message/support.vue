<script setup lang="ts">
import type { PropertyHome } from '@/api/propertyHome'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { fetchPropertyHome } from '@/api/propertyHome'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({ style: { navigationBarTitleText: '客服中心', backgroundColor: '#F5F7FF' } })
const home = ref<PropertyHome | null>(null)
const loading = ref(false)
const error = ref(false)
let generation = 0
onShow(() => {
  void load()
})
onUnload(() => {
  generation++
})
async function load() {
  const current = ++generation
  loading.value = true
  error.value = false
  try {
    const result = await fetchPropertyHome()
    if (current === generation)
      home.value = result
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
function chat() {
  if (!useTokenStore().updateNowTime().hasLogin) {
    toLoginPage()
    return
  }
  uni.navigateTo({ url: '/pages/message/chat?mode=support' })
}
function phone() {
  if (home.value?.supportPhone)
    uni.makePhoneCall({ phoneNumber: home.value.supportPhone })
}
</script>

<template>
  <view class="app-page bg-#F5F7FF">
    <view class="app-content py-6">
      <view class="app-panel p-6 text-center">
        <view class="mx-auto h-18 w-18 flex items-center justify-center rounded-2xl bg-#e8eaff">
          <view class="i-carbon-headset text-10 text-#7961ff" />
        </view>
        <text class="mt-4 block text-2xl text-app-ink font-bold">泊之湾客服中心</text>
        <text class="mt-2 block text-sm text-app-muted leading-6">选房、预约与入住咨询，由公寓管家为您解答。</text>
      </view>
      <view class="mt-4 app-panel p-5">
        <text class="block text-lg font-semibold">在线咨询</text><text class="mb-4 mt-2 block text-sm text-app-muted">登录后即可发送消息，并在「消息」中查看回复。</text><button class="app-primary-button" @tap="chat">
          联系公寓管家
        </button>
      </view>
      <view class="mt-4 app-panel p-5">
        <text class="block text-lg font-semibold">电话咨询</text>
        <text v-if="loading" class="mt-3 block text-sm text-app-muted">咨询信息加载中…</text>
        <view v-else-if="error">
          <text class="mt-3 block text-sm text-app-muted">咨询信息加载失败</text><button class="mt-3 app-secondary-button" @tap="load">
            重新加载
          </button>
        </view>
        <template v-else>
          <text v-if="home?.serviceHours" class="mt-2 block break-words text-sm text-app-muted">服务时间：{{ home.serviceHours }}</text>
          <template v-if="home?.supportPhone">
            <text class="my-3 block text-xl text-brand-blue">{{ home.supportPhone }}</text><button class="app-secondary-button" @tap="phone">
              拨打咨询电话
            </button>
          </template>
          <text v-else class="mt-3 block text-sm text-app-muted leading-6">电话暂未配置，请通过在线咨询联系管家。</text>
        </template>
      </view>
    </view>
  </view>
</template>
