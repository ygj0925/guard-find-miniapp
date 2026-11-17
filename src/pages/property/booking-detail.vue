<script setup lang="ts">
import type { BookingDetail,OpsSettings } from '@/api/operations'
import { actOnBooking,bookingLabels,fetchBookingDetail,fetchOpsSettings,subscribeBooking } from '@/api/operations'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({style:{navigationBarTitleText:'预约详情'}})
const id=ref('')
const data=ref<BookingDetail|null>(null)
const settings=ref<OpsSettings|null>(null)
const loading=ref(false)
const failed=ref(false)
const busy=ref(false)
const action=ref('')
const reason=ref('')
const date=ref('')
const time=ref('')
const error=ref('')
let generation=0
const names:Record<string,string>={CONFIRM:'确认预约',REJECT:'拒绝预约',CANCEL:'取消预约',RESCHEDULE:'申请改期',VISIT:'登记到访',COMPLETE:'完成看房',NO_SHOW:'标记未到访'}
const actions=computed(()=>{const b=data.value;if(!b)return [];if(b.canManage)return b.status===1?['CONFIRM','REJECT','CANCEL','RESCHEDULE']:b.status===2?['VISIT','NO_SHOW','CANCEL','RESCHEDULE']:b.status===5?['COMPLETE']:[];return b.isGuest&&[1,2].includes(b.status)?['CANCEL','RESCHEDULE']:[]})
onLoad(query=>{id.value=String(query?.id||'')})
onShow(()=>void load())
onUnload(()=>{generation++})
async function load(){if(!useTokenStore().updateNowTime().hasLogin){toLoginPage();return}const current=++generation;loading.value=true;failed.value=false;try{const result=await fetchBookingDetail(id.value);if(current===generation)data.value=result;try{const config=await fetchOpsSettings();if(current===generation)settings.value=config}catch{}}catch{if(current===generation)failed.value=true}finally{if(current===generation)loading.value=false}}
function begin(value:string){action.value=value;reason.value='';date.value='';time.value='';error.value=''}
async function submit(){if(busy.value)return;if(['REJECT','CANCEL','RESCHEDULE','NO_SHOW'].includes(action.value)&&!reason.value.trim()){error.value='请填写原因';return}if(action.value==='RESCHEDULE'&&(!date.value||!time.value)){error.value='请选择新的看房日期与时间';return}busy.value=true;error.value='';try{await actOnBooking(id.value,{action:action.value,reason:reason.value.trim(),bookingTime:action.value==='RESCHEDULE'?`${date.value} ${time.value}:00`:undefined});action.value='';await load();uni.showToast({title:'预约已更新',icon:'none'})}catch(failure){error.value=failure instanceof Error?failure.message:'处理失败，请重试'}finally{busy.value=false}}
async function subscribe(){if(busy.value||!settings.value?.subscriptionEnabled)return
// #ifdef MP-WEIXIN
 const templateId=settings.value.templateId
 uni.requestSubscribeMessage({tmplIds:[templateId],success:async result=>{if(result[templateId]!=='accept'){uni.showToast({title:'未订阅，仍可在业务通知查看结果',icon:'none'});return}busy.value=true;try{await subscribeBooking(id.value,templateId);uni.showToast({title:'已记录本次订阅授权',icon:'none'})}catch{uni.showToast({title:'授权记录失败，请稍后重试',icon:'none'})}finally{busy.value=false}},fail:()=>uni.showToast({title:'无法发起订阅，请检查微信设置',icon:'none'})})
// #endif
// #ifndef MP-WEIXIN
 uni.showToast({title:'请在微信小程序中订阅提醒',icon:'none'})
// #endif
}
function support(){uni.navigateTo({url:'/pages/message/chat?mode=support'})}
function openProperty(){if(data.value)uni.navigateTo({url:`/pages/property/detail?id=${data.value.propertyId}`})}
</script>

<template>
 <view class="app-page"><view class="app-content py-6">
  <view v-if="loading" class="app-panel p-6">正在加载预约…</view>
  <view v-else-if="failed" class="app-panel p-6"><text>预约加载失败或已无权访问</text><button class="app-secondary-button mt-4" @tap="load">重新加载</button></view>
  <template v-else-if="data">
   <view class="app-panel p-5"><text class="block text-xl font-bold">{{ data.statusLabel }}</text><text class="mt-2 block text-sm text-app-muted">预约编号：{{ data.id }}</text><button class="app-tap mt-4 text-left text-brand-blue" @tap="openProperty">{{ data.property[0]?.title || '房源已删除' }}</button><text class="mt-4 block">看房时间：{{ data.bookingTime }}</text><text class="mt-3 block">联系人：{{ data.contactName }} {{ data.contactPhone }}</text><text v-if="data.remark" class="mt-3 block">备注：{{ data.remark }}</text></view>
   <view class="app-panel mt-4 p-5"><text class="block font-bold">接待信息</text><text class="mt-3 block">{{ data.reception.managerName || '公寓管家统一接待' }}</text><text class="mt-3 block">集合地点：{{ data.reception.meetingPoint || '请提前与管家确认' }}</text><text v-if="data.reception.instructions" class="mt-3 block whitespace-pre-wrap">{{ data.reception.instructions }}</text><button class="app-secondary-button mt-4" @tap="support">联系公寓管家</button></view>
   <view class="app-panel mt-4 p-5"><button v-if="settings?.subscriptionEnabled" class="app-secondary-button" :disabled="busy" @tap="subscribe">订阅微信预约提醒</button><text v-else class="text-sm text-app-muted">微信提醒暂未启用，处理结果可在业务通知查看。</text></view>
   <view v-if="actions.length" class="app-panel mt-4 p-5"><button v-for="value in actions" :key="value" class="app-secondary-button mb-3" :disabled="busy" @tap="begin(value)">{{ names[value] }}</button></view>
   <view v-if="action" class="app-panel mt-4 p-5"><text class="block font-bold">{{ names[action] }}</text><textarea v-model="reason" :maxlength="500" class="mt-4 min-h-24 w-full rounded-lg bg-app-soft p-3" placeholder="请填写处理原因或说明"/><template v-if="action==='RESCHEDULE'"><picker mode="date" :value="date" @change="date=String($event.detail.value)"><view class="mt-3 rounded-lg bg-app-soft p-3">{{ date || '选择新日期' }}</view></picker><picker mode="time" :value="time" @change="time=String($event.detail.value)"><view class="mt-3 rounded-lg bg-app-soft p-3">{{ time || '选择新时间' }}</view></picker></template><text v-if="error" class="mt-3 block text-app-danger">{{ error }}</text><button class="app-primary-button mt-4" :loading="busy" :disabled="busy" @tap="submit">确认提交</button><button class="app-secondary-button mt-3" :disabled="busy" @tap="action=''">暂不处理</button></view>
   <view class="app-panel mt-4 p-5"><text class="block font-bold">处理记录</text><view v-for="log in data.logs" :key="log.id" class="mt-4 border-0 border-b border-app-border border-solid pb-4"><text class="block text-sm text-app-muted">{{ log.createTime }}</text><text class="mt-1 block">{{ log.reason || names[log.action] || log.action }} · {{ bookingLabels[log.toStatus] }}</text></view><text v-if="!data.logs.length" class="mt-3 block text-app-muted">暂无历史处理记录</text></view>
  </template>
 </view></view>
</template>
