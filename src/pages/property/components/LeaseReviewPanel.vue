<script setup lang="ts">
import type { LeaseDetail, LeaseReview, LeaseReviewInput } from '@/api/leases'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { reviewLease } from '@/api/leases'
import { useTokenStore } from '@/store/token'

const props = defineProps<{ lease: LeaseDetail, active: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const tokenStore = useTokenStore()
const clause = ref('')
const content = ref('')
const expanded = ref(false)
const busy = ref(false)
const error = ref('')
const reopened = ref<LeaseReview>()
let generation = 0
onBeforeUnmount(() => {
  generation++
})
const canCreate = computed(() => props.lease.status === 'PENDING_SIGNATURE' && (props.lease.isTenant ? !props.lease.tenantSignedAt : props.lease.isLandlord && !props.lease.landlordSignedAt))
watch(() => [props.active, props.lease.id, props.lease.publishedVersion, tokenStore.validToken], () => {
  generation++
  clause.value = content.value = error.value = ''
  busy.value = expanded.value = false
  reopened.value = undefined
}, { flush: 'sync' })
async function submit(action: LeaseReviewInput['action'], review?: LeaseReview) {
  const token = tokenStore.updateNowTime().validToken
  if (busy.value || !props.active || !token)
    return
  if (action !== 'CONFIRM' && (!content.value.trim() || (action === 'CREATE' && !clause.value.trim()))) {
    error.value = '请填写条款位置和需要处理的问题'
    return
  }
  const current = generation
  const valid = () => props.active && generation === current && tokenStore.validToken === token
  error.value = ''
  busy.value = true
  try {
    if (action === 'CONFIRM') {
      const result = await uni.showModal({ title: '确认审阅意见已解决', content: '请确认已理解回复且问题确实解决。确认后可继续签署当前合同。', confirmText: '确认已解决' })
      if (!result.confirm || !valid())
        return
    }
    await reviewLease(props.lease.id, { action, publishedVersion: props.lease.publishedVersion, contentHash: props.lease.contentHash, ...(review ? { reviewId: review.id, version: review.version } : {}), ...(action !== 'CONFIRM' ? { content: content.value.trim(), clauseLabel: clause.value.trim() } : {}) })
    if (valid()) {
      content.value = clause.value = ''
      expanded.value = false
      reopened.value = undefined
      emit('changed')
    }
  }
  catch (failure) {
    if (valid())
      error.value = failure instanceof Error ? failure.message : '审阅意见提交失败，请重试'
  }
  finally {
    if (valid())
      busy.value = false
  }
}
function reopen(review: LeaseReview) {
  reopened.value = review
  expanded.value = true
  clause.value = review.clauseLabel
  content.value = ''
}
const statusLabel = { OPEN: '待管理员回复', REPLIED: '待提出人确认', RESOLVED: '已解决' }
</script>

<template>
  <view class="mt-4 app-panel p-5">
    <text class="block text-lg font-bold">合同审阅</text>
    <text class="mt-2 block text-sm text-app-muted leading-6">核对房源、租期费用、付款方式、维修责任和退租约定。发现问题可直接提出意见；未解决的意见会暂停本轮签署。</text>
    <text v-if="lease.unresolvedReviews" class="mt-3 block text-sm text-app-danger">当前还有 {{ lease.unresolvedReviews }} 条意见待处理</text>
    <view v-for="review in lease.reviews || []" :key="review.id" class="mt-4 border-0 border-t border-app-border border-solid pt-4">
      <text class="block text-xs text-app-muted">{{ review.authorRole === 'TENANT' ? '承租方' : '出租方' }} · {{ review.currentRound ? statusLabel[review.status] : '历史签约轮次' }}</text>
      <text class="mt-2 block font-bold">{{ review.clauseLabel }}</text>
      <text class="mt-2 block whitespace-pre-wrap text-sm leading-6">{{ review.content }}</text>
      <view v-if="review.reply" class="mt-3 rounded-lg bg-app-soft p-3">
        <text class="block text-xs text-app-muted">管理员回复</text><text class="mt-1 block whitespace-pre-wrap text-sm leading-6">{{ review.reply }}</text>
      </view>
      <view v-if="review.canConfirm && lease.status === 'PENDING_SIGNATURE'" class="mt-3 flex flex-wrap gap-2">
        <button class="app-primary-button text-sm" :disabled="busy" @tap="submit('CONFIRM', review)">
          确认已解决
        </button>
        <button class="app-secondary-button text-sm" :disabled="busy" @tap="reopen(review)">
          仍有疑问
        </button>
      </view>
    </view>
    <button v-if="canCreate && !expanded" class="mt-4 app-secondary-button" :disabled="busy" @tap="expanded = true">
      提出审阅意见
    </button>
    <view v-if="expanded" class="mt-4">
      <text class="mb-2 block text-sm">条款位置或问题类别</text>
      <input v-model="clause" class="rounded-lg bg-app-soft p-3 text-sm" placeholder="如：第三条押金退还 / 房源地址" :maxlength="120" :disabled="busy || Boolean(reopened)">
      <text class="mb-2 mt-4 block text-sm">问题与修改建议</text>
      <textarea v-model="content" class="box-border w-full rounded-lg bg-app-soft p-3 text-sm" placeholder="请写明需要澄清或修改的内容" :maxlength="800" :disabled="busy" />
      <button class="mt-3 app-primary-button" :disabled="busy" :loading="busy" @tap="submit(reopened ? 'REOPEN' : 'CREATE', reopened)">
        {{ reopened ? '继续反馈' : '提交审阅意见' }}
      </button>
      <button class="mt-2 app-secondary-button" :disabled="busy" @tap="expanded = false; reopened = undefined">
        取消
      </button>
    </view>
    <text v-if="error" class="mt-3 block text-sm text-app-danger">{{ error }}</text>
  </view>
</template>
