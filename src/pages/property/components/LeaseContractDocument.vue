<script setup lang="ts">
import type { LeaseDetail } from '@/api/leases'
import { leaseStatusLabels } from '@/api/leases'
import PrivateSignatureImage from './PrivateSignatureImage.vue'

defineProps<{
  lease: LeaseDetail
}>()
const parties = [{ role: 'LANDLORD', key: 'landlord', label: '出租方（甲方）' }, { role: 'TENANT', key: 'tenant', label: '承租方（乙方）' }] as const
</script>

<template>
  <view class="contract-paper">
    <text class="contract-kicker">房屋租赁 · 线上签约</text>
    <text class="contract-title">{{ lease.title }}</text>
    <text class="mt-2 block break-all text-center text-xs text-app-muted">合同编号 {{ lease.id }}</text>
    <view class="contract-divider" />
    <view class="contract-facts">
      <text>出租方（甲方）</text><text>{{ lease.landlordName }}</text>
      <text>承租方（乙方）</text><text>{{ lease.tenantName }}</text>
      <text>租赁房源</text><text>{{ lease.propertyTitle }}</text>
      <text>房屋坐落</text><text>{{ lease.propertyAddress }}</text>
      <text>租赁期限</text><text>{{ lease.startDate }} 至 {{ lease.endDate }}</text>
      <text>月租金 / 押金</text><text>¥{{ lease.monthlyRent }} / ¥{{ lease.deposit }}</text>
    </view>
    <view class="contract-divider" />
    <text class="block font-bold">合同条款</text>
    <text class="mt-3 block whitespace-pre-wrap break-words text-sm leading-7" selectable>{{ lease.terms }}</text>
    <view class="contract-divider" />
    <text class="block font-bold">双方签署</text>
    <view v-for="party in parties" :key="party.role" class="signature-record">
      <view class="flex items-center justify-between gap-3">
        <text class="text-sm">{{ party.label }} · {{ lease[`${party.key}Name`] }}</text>
        <text class="text-xs" :class="lease[`${party.key}SignedAt`] ? 'text-brand-blue' : 'text-app-muted'">{{ lease[`${party.key}SignedAt`] ? '已签署' : '待签署' }}</text>
      </view>
      <template v-for="signature in (lease.signatures || []).filter(item => item.signerRole === party.role)" :key="signature.id">
        <view class="mt-2 flex items-center gap-3">
          <PrivateSignatureImage class="min-w-0 flex-1" :base64="signature.imageBase64" :label="`${party.label}手写签名`" />
          <PrivateSignatureImage v-if="signature.sealBase64" class="w-24" :base64="signature.sealBase64" :label="`${party.label}印章`" />
        </view>
        <text class="block text-xs text-app-muted">{{ signature.signedAt }}</text>
      </template>
      <text v-if="lease[`${party.key}SignedAt`] && !(lease.signatures || []).some(item => item.signerRole === party.role)" class="mt-3 block text-xs text-app-muted">历史账号确认签署 · {{ lease[`${party.key}SignedAt`] }}（当时未采集手写签名）</text>
      <text v-if="!lease[`${party.key}SignedAt`]" class="mt-5 block text-sm text-app-muted">由本人登录小程序完成签署</text>
    </view>
    <text class="mt-4 block text-xs text-app-muted">{{ leaseStatusLabels[lease.status] }}</text>
    <text class="mt-2 block break-all text-xs text-app-muted leading-5" selectable>合同内容校验值：{{ lease.contentHash || '草稿未发布' }}</text>
  </view>
</template>

<style scoped>
.contract-paper {
  padding: 24px 20px;
  background: #fff;
  border: 1px solid #e2e7ef;
  border-radius: 12px;
  color: #1c2b40;
}
.contract-kicker {
  display: block;
  text-align: center;
  font-size: 11px;
  letter-spacing: 2px;
  color: #66748a;
}
.contract-title {
  display: block;
  margin-top: 12px;
  text-align: center;
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 23px;
  font-weight: 600;
  line-height: 1.5;
}
.contract-divider {
  margin: 24px 0;
  height: 1px;
  background: #e2e7ef;
}
.contract-facts {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 12px 8px;
  font-size: 13px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.contract-facts > :nth-child(odd) {
  color: #66748a;
}
.signature-record {
  padding: 20px 0;
  border-bottom: 1px solid #edf0f4;
}
</style>
