<script setup lang="ts">
import type { LeaseDetail } from '@/api/leases'
import { computed, ref, watch } from 'vue'
import { fetchLease } from '@/api/leases'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'
import LeaseSigningFlow from './components/LeaseSigningFlow.vue'

definePage({ style: { navigationBarTitleText: '签署租赁合同' } })
const store = useTokenStore()
const authenticated = computed(() => Boolean(store.validToken))
const id = ref('')
const active = ref(false)
const lease = ref<LeaseDetail | null>(null)
const loading = ref(false)
const error = ref('')
let generation = 0
async function load() {
  const token = store.updateNowTime().validToken
  if (!token || !active.value)
    return
  if (!/^[1-9]\d*$/.test(id.value)) {
    error.value = '合同链接无效'
    return
  }
  const current = ++generation
  const valid = () => active.value && current === generation && token === store.validToken
  loading.value = true
  error.value = ''
  lease.value = null
  try {
    const result = await fetchLease(id.value)
    if (valid())
      lease.value = result
  }
  catch {
    if (valid())
      error.value = '合同加载失败，请重试'
  }
  finally {
    if (valid())
      loading.value = false
  }
}
function detail() {
  uni.redirectTo({ url: `/pages/property/lease-detail?id=${id.value}` })
}
onLoad((query) => {
  id.value = String(query?.id || '')
})
onShow(() => {
  active.value = true
  void load()
})
onHide(() => {
  active.value = false
  generation++
  lease.value = null
})
onUnload(() => {
  active.value = false
  generation++
})
watch(() => store.validToken, () => {
  generation++
  lease.value = null
  void load()
}, { flush: 'sync' })
</script>

<template>
  <view class="app-page">
    <view class="app-content py-5" style="padding-bottom: calc(24px + env(safe-area-inset-bottom))">
      <view v-if="!authenticated" class="app-panel p-5">
        <text>请本人登录后签署合同</text><button class="mt-4 app-primary-button" @tap="toLoginPage">
          去登录
        </button>
      </view>
      <text v-else-if="loading" class="block p-8 text-center text-app-muted">正在读取合同…</text>
      <view v-else-if="error" class="app-panel p-5">
        <text>{{ error }}</text><button class="mt-4 app-secondary-button" @tap="load">
          重新加载
        </button>
      </view>
      <LeaseSigningFlow v-else-if="lease" :lease="lease" :active="active" @signed="detail" @refresh="load" />
    </view>
  </view>
</template>
