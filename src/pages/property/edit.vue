<script setup lang="ts">
import type { PropertyInput } from '@/api/property'
import { fetchPropertyDetail, fetchRegionTree, saveProperty, type RegionNode } from '@/api/property'

import { uploadPropertyImage } from '@/api/propertyImage'

definePage({ style: { navigationBarTitleText: '编辑房源' } })
const id = ref('')
const ready = ref(false)
const saving = ref(false)
const uploading = ref(false)
let disposed = false
onUnload(() => {
  disposed = true
})
const imageUrls = ref('')
const facilities = ref('')
const form = reactive<PropertyInput>({
  title: '',
  description: '',
  propertyType: 'house',
  layout: '',
  areaSqm: null,
  floorInfo: '',
  orientation: '',
  decoration: '',
  price: 1,
  priceType: 'rent',
  community: '',
  availableFrom: null,
  rentalMode: null,
  address: '',
  district: '',
  city: '',
  facilities: [],
  contactName: '',
  contactPhone: '',
  status: 1,
  images: [],
})
const types = ['住宅', '公寓', '别墅', '商铺']
const typeValues: PropertyInput['propertyType'][] = [
  'house',
  'apartment',
  'villa',
  'shop',
]
const fields: {
  key:
    | 'layout'
    | 'floorInfo'
    | 'orientation'
    | 'decoration'
    | 'community'
    | 'contactName'
    | 'contactPhone'
  label: string
  max: number
}[] = [
  { key: 'layout', label: '户型', max: 30 },
  { key: 'floorInfo', label: '楼层', max: 20 },
  { key: 'orientation', label: '朝向', max: 20 },
  { key: 'decoration', label: '装修', max: 20 },
  { key: 'community', label: '小区', max: 100 },
  { key: 'contactName', label: '联系人', max: 50 },
  { key: 'contactPhone', label: '联系电话', max: 20 },
]
onLoad(async (q) => {
  id.value = String(q?.id || '')
  void loadRegionTree()
  if (!id.value) {
    ready.value = true
    return
  }
  try {
    const p = await fetchPropertyDetail(id.value)
    Object.assign(form, p)
    imageUrls.value = p.images.join('\n')
    facilities.value = p.facilities.join('，')
    regionLabel.value = [p.city, p.district].filter(Boolean).join(' ')
    ready.value = true
  }
  catch {
    uni.showToast({ title: '房源加载失败，请返回重试', icon: 'none' })
  }
})

/** 省市区级联:数据来自 backend /miniapp/region/tree,与用户侧服务同源 */
const regionTree = ref<RegionNode[]>([])
const provinceIdx = ref(0)
const cityIdx = ref(0)
const districtIdx = ref(0)
const regionLabel = ref('')
const provinces = computed(() => regionTree.value.map(p => p.name))
const cities = computed(() =>
  regionTree.value[provinceIdx.value]?.children?.map(c => c.name) ?? [],
)
const districts = computed(() =>
  regionTree.value[provinceIdx.value]?.children?.[cityIdx.value]?.children
    ?.map(c => c.name) ?? [],
)

async function loadRegionTree() {
  try {
    regionTree.value = await fetchRegionTree()
  }
  catch {}
}

function onRegionColumnChange(e: { detail: { column: number, value: number } }) {
  const { column, value } = e.detail
  if (column === 0) {
    provinceIdx.value = value
    cityIdx.value = 0
    districtIdx.value = 0
  }
  else if (column === 1) {
    cityIdx.value = value
    districtIdx.value = 0
  }
  else {
    districtIdx.value = value
  }
}

function onRegionConfirm(e: { detail: { value: number[] } }) {
  const [p, c, d] = e.detail.value.map(Number)
  provinceIdx.value = p
  cityIdx.value = c
  districtIdx.value = d
  const province = regionTree.value[p]
  const city = province?.children?.[c]
  const district = city?.children?.[d]
  form.city = city?.name ?? ''
  form.district = district?.name ?? ''
  regionLabel.value = [province?.name, city?.name, district?.name]
    .filter(Boolean)
    .join(' ')
}
const imageList = computed(() =>
  imageUrls.value
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean),
)
function removeImage(index: number) {
  if (!uploading.value)
    imageUrls.value = imageList.value.filter((_, i) => i !== index).join('\n')
}
function chooseImages() {
  if (uploading.value || saving.value)
    return
  const count = 9 - imageList.value.length
  if (count <= 0) {
    uni.showToast({ title: '最多9张图片', icon: 'none' })
    return
  }
  uploading.value = true
  uni.chooseImage({
    count,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      try {
        for (const path of res.tempFilePaths) {
          if (disposed)
            break
          const url = await uploadPropertyImage(path)
          if (disposed)
            break
          imageUrls.value = [...imageList.value, url].join('\n')
        }
      }
      catch (error) {
        if (!disposed) {
          uni.showToast({
            title: error instanceof Error ? error.message : '图片上传失败',
            icon: 'none',
          })
        }
      }
      finally {
        uploading.value = false
      }
    },
    fail: () => {
      uploading.value = false
    },
  })
}
async function submit(status: 1 | 2) {
  if (saving.value || uploading.value || !ready.value)
    return
  const images = imageUrls.value
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
  if (
    !form.title.trim()
    || !form.address.trim()
    || !(Number(form.price) >= 1)
    || images.length > 9
    || images.some(s => !/^https?:\/\/\S+$/.test(s) || s.length > 1000)
  ) {
    uni.showToast({
      title: '请填写标题、地址、有效价格及图片链接',
      icon: 'none',
    })
    return
  }
  saving.value = true
  try {
    await saveProperty(id.value, {
      ...form,
      price: Number(form.price),
      areaSqm: form.areaSqm ? Number(form.areaSqm) : null,
      rentalMode: form.priceType === 'rent' ? form.rentalMode : null,
      status,
      images,
      facilities: facilities.value
        .split(/[,，]/)
        .map(s => s.trim())
        .filter(Boolean),
    })
    uni.showToast({ title: '已保存', icon: 'success' })
    uni.navigateBack()
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <view v-if="ready" class="min-h-full bg-#F7F8FA p-4">
    <view class="rounded-xl bg-white p-4">
      <text class="block text-sm">标题 *</text><input
        v-model="form.title"
        class="my-3 border-b border-gray-2 py-2"
        :maxlength="100"
        placeholder="房源标题"
      >
      <picker
        :range="types"
        @change="form.propertyType = typeValues[Number($event.detail.value)]"
      >
        <view class="py-3">
          类型：{{ types[typeValues.indexOf(form.propertyType)] }} ›
        </view>
      </picker>
      <picker
        :range="['出租', '出售']"
        @change="
          form.priceType = Number($event.detail.value) === 0 ? 'rent' : 'sale'
        "
      >
        <view class="py-3">
          租售：{{ form.priceType === "rent" ? "出租" : "出售" }} ›
        </view>
      </picker>
      <picker
        v-if="form.priceType === 'rent'"
        :range="['未指定', '整租', '合租']"
        @change="
          form.rentalMode
            = Number($event.detail.value) === 1
              ? 'whole'
              : Number($event.detail.value) === 2
                ? 'shared'
                : null
        "
      >
        <view class="py-3">
          租赁方式：{{
            form.rentalMode === "whole"
              ? "整租"
              : form.rentalMode === "shared"
                ? "合租"
                : "未指定"
          }}
          ›
        </view>
      </picker>
      <text class="block text-sm">
        {{
          form.priceType === "rent" ? "月租（元）*" : "总价（元）*"
        }}
      </text><input
        v-model="form.price"
        type="digit"
        class="my-3 border-b border-gray-2 py-2"
      >
      <text class="block text-sm">面积（㎡）</text><input
        v-model="form.areaSqm"
        type="digit"
        class="my-3 border-b border-gray-2 py-2"
        placeholder="选填"
      >
      <view v-for="field in fields" :key="field.key">
        <text class="block text-sm">{{ field.label }}</text><input
          v-model="form[field.key]"
          :maxlength="field.max"
          class="my-3 border-b border-gray-2 py-2"
          placeholder="选填"
        >
      </view>
      <picker
        mode="multiSelector"
        :range="[provinces, cities, districts]"
        :value="[provinceIdx, cityIdx, districtIdx]"
        :disabled="!provinces.length"
        @columnchange="onRegionColumnChange"
        @change="onRegionConfirm"
      >
        <view class="py-3">
          所在地区：{{ regionLabel || (provinces.length ? '请选择' : '区划加载中…') }} ›
        </view>
      </picker>
      <text class="block text-sm">详细地址 *</text><input
        v-model="form.address"
        :maxlength="200"
        class="my-3 border-b border-gray-2 py-2"
      >
      <picker
        mode="date"
        @change="form.availableFrom = String($event.detail.value)"
      >
        <view class="py-3">
          可入住日期：{{ form.availableFrom || "未指定" }} ›
        </view>
      </picker><button
        v-if="form.availableFrom"
        size="mini"
        @tap="form.availableFrom = null"
      >
        清空日期
      </button>
      <text class="mt-3 block text-sm">设施（逗号分隔，最多20项）</text><input v-model="facilities" class="my-3 border-b border-gray-2 py-2">
      <text class="block text-sm">房源描述</text><textarea
        v-model="form.description"
        :maxlength="2000"
        class="my-3 w-full bg-gray-1 p-2"
      />
      <view class="my-3">
        <button :disabled="uploading || saving" @tap="chooseImages">
          {{
            uploading ? "图片上传中…" : `选择图片（${imageList.length}/9）`
          }}
        </button><text class="mt-2 block text-xs text-gray">
          支持 JPG、PNG，每张最多5MB
        </text>
      </view>
      <view class="mb-3 flex flex-wrap gap-2">
        <view v-for="(url, index) in imageList" :key="url">
          <image :src="url" mode="aspectFill" class="h-20 w-24" /><button
            size="mini"
            :disabled="uploading"
            @tap="removeImage(index)"
          >
            移除
          </button>
        </view>
      </view>
      <text class="block text-sm">
        图片链接（每行一个 HTTP(S) 地址，最多9张）
      </text><textarea
        v-model="imageUrls"
        :disabled="uploading"
        :maxlength="9009"
        class="my-3 w-full bg-gray-1 p-2"
      />
    </view>
    <view class="mt-4 flex gap-3">
      <button class="flex-1" :disabled="saving || uploading" @tap="submit(1)">
        存为草稿
      </button><button
        class="flex-1 bg-#1677FF text-white"
        :disabled="saving || uploading"
        @tap="submit(2)"
      >
        保存并上架
      </button>
    </view>
  </view><view v-else class="p-10 text-center">
    正在加载房源…
  </view>
</template>
