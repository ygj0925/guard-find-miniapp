<script setup lang="ts">
import type { OpsSettings } from '@/api/operations'
import { fetchOpsSettings } from '@/api/operations'
definePage({style:{navigationBarTitleText:'服务协议'}})
const type=ref('user')
const data=ref<OpsSettings|null>(null)
const loading=ref(false)
const error=ref(false)
let generation=0
onLoad(query=>{type.value=query?.type==='privacy'?'privacy':'user';uni.setNavigationBarTitle({title:type.value==='privacy'?'隐私政策':'用户协议'});void load()})
onUnload(()=>{generation++})
async function load(){const current=++generation;loading.value=true;error.value=false;try{const result=await fetchOpsSettings();if(current===generation)data.value=result}catch{if(current===generation)error.value=true}finally{if(current===generation)loading.value=false}}
</script>

<template>
 <view class="app-page"><view class="app-content py-6"><view class="app-panel p-6">
 <text class="block text-xl font-bold">{{ type==='privacy'?'隐私政策':'用户协议' }}</text>
 <text v-if="loading" class="mt-4 block text-app-muted">正在加载正式内容…</text>
 <view v-else-if="error" class="mt-4"><text>内容加载失败，请重试</text><button class="app-secondary-button mt-4" @tap="load">重新加载</button></view>
 <template v-else-if="data?.policiesPublished"><text class="mt-3 block text-sm text-app-muted">{{ data.operator }} · 版本 {{ data.policyVersion }} · {{ data.effectiveDate }} 生效</text><text class="mt-6 block whitespace-pre-wrap leading-7">{{ type==='privacy'?data.privacyPolicy:data.userAgreement }}</text><text class="mt-6 block text-sm">联系方式：{{ data.contact }}</text></template>
 <template v-else><text class="mt-4 block leading-7">正式协议内容暂未发布。如需了解服务或个人信息处理事宜，请联系公寓管家。</text><text v-if="data?.contact" class="mt-4 block">{{ data.contact }}</text></template>
 </view></view></view>
</template>
