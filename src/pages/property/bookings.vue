<script setup lang="ts">
import type { Booking } from '@/api/property'
import {
  changeBookingStatus,
  createBooking,
  fetchBookings,
} from '@/api/property'

definePage({ style: { navigationBarTitleText: '看房预约' } })
const propertyId = ref('')
const role = ref<'guest' | 'owner'>('guest')
const items = ref<Booking[]>([])
const date = ref('')
const time = ref('')
const contactName = ref('')
const contactPhone = ref('')
const remark = ref('')
const busy = ref(false)
const loading = ref(false)
const error = ref(false)
const total = ref(0)
const page = ref(0)
let generation = 0
const labels: Record<number, string> = {
  1: '待确认',
  2: '已确认',
  3: '已拒绝',
  4: '已取消',
}
onLoad((q) => {
  propertyId.value = String(q?.propertyId || '')
})
onShow(() => {
  if (!propertyId.value)
    void load()
})
onUnload(() => {
  generation++
})
onReachBottom(() => {
  if (items.value.length < total.value)
    void load(true)
})
async function load(more = false) {
  if (more && loading.value)
    return
  const current = ++generation
  loading.value = true
  error.value = false
  try {
    const next = more ? page.value + 1 : 1
    const res = await fetchBookings(role.value, next)
    if (current !== generation)
      return
    items.value = more ? [...items.value, ...res.list] : res.list
    page.value = next
    total.value = res.total
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
async function submit() {
  if (busy.value)
    return
  const bookingTime = `${date.value}T${time.value}:00`
  if (
    !date.value
    || !time.value
    || !contactName.value.trim()
    || !contactPhone.value.trim()
    || new Date(bookingTime).getTime() <= Date.now()
  ) {
    uni.showToast({ title: '请填写未来看房时间和联系方式', icon: 'none' })
    return
  }
  busy.value = true
  try {
    await createBooking(propertyId.value, {
      bookingTime,
      contactName: contactName.value,
      contactPhone: contactPhone.value,
      remark: remark.value,
    })
    uni.showToast({ title: '预约已提交' })
    uni.navigateBack()
  }
  finally {
    busy.value = false
  }
}
async function change(item: Booking, status: number) {
  if (busy.value)
    return
  busy.value = true
  try {
    await changeBookingStatus(item.id, status)
    await load()
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="min-h-full bg-#F7F8FA p-4">
    <view v-if="propertyId" class="rounded-xl bg-white p-4">
      <picker mode="date" @change="date = String($event.detail.value)">
        <view class="py-4">
          看房日期：{{ date || "请选择" }} ›
        </view>
      </picker>
      <picker mode="time" @change="time = String($event.detail.value)">
        <view class="py-4">
          看房时间：{{ time || "请选择" }} ›
        </view>
      </picker>
      <input
        v-model="contactName"
        :maxlength="50"
        placeholder="联系人"
        class="mb-4 border-b border-gray-2 py-3"
      ><input
        v-model="contactPhone"
        :maxlength="20"
        placeholder="联系电话"
        class="mb-4 border-b border-gray-2 py-3"
      ><textarea
        v-model="remark"
        :maxlength="500"
        placeholder="备注（选填）"
        class="mb-4 w-full"
      /><button class="bg-#1677FF text-white" :disabled="busy" @tap="submit">
        提交预约
      </button>
    </view>
    <template v-else>
      <view class="mb-4 flex gap-3">
        <button
          class="flex-1"
          :type="role === 'guest' ? 'primary' : 'default'"
          @tap="
            role = 'guest';
            load();
          "
        >
          我预约的
        </button><button
          class="flex-1"
          :type="role === 'owner' ? 'primary' : 'default'"
          @tap="
            role = 'owner';
            load();
          "
        >
          收到的预约
        </button>
      </view>
      <view
        v-for="item in items"
        :key="item.id"
        class="mb-3 rounded-xl bg-white p-4"
      >
        <text class="block font-bold">
          {{
            item.propertyTitle || "房源已删除"
          }}
        </text><text class="mt-2 block text-sm">
          {{ item.bookingTime.replace("T", " ") }} ·
          {{ labels[item.status] }}
        </text><text class="mt-2 block text-sm">
          {{ item.contactName }} {{ item.contactPhone }}
        </text><text class="mt-2 block text-sm">{{ item.remark }}</text>
        <view
          v-if="role === 'owner' && item.status === 1"
          class="mt-3 flex gap-2"
        >
          <button size="mini" :disabled="busy" @tap="change(item, 2)">
            确认
          </button><button size="mini" :disabled="busy" @tap="change(item, 3)">
            拒绝
          </button>
        </view><button
          v-if="role === 'guest' && [1, 2].includes(item.status)"
          size="mini"
          class="mt-3"
          :disabled="busy"
          @tap="change(item, 4)"
        >
          取消预约
        </button>
      </view>
      <view v-if="loading" class="p-8 text-center">
        加载中…
      </view><button v-else-if="error" @tap="load()">
        加载失败，点击重试
      </button><view v-else-if="!items.length" class="p-10 text-center text-gray">
        暂无预约
      </view>
    </template>
  </view>
</template>
