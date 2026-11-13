<script setup lang="ts">
import type { PropertyInput, RegionNode, RentalMode } from '@/api/property'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { getUserInfo } from '@/api/login'
import { fetchPropertyDetail, fetchRegionTree, propertyPriceSuffix, RENTAL_MODE_LABEL, saveProperty } from '@/api/property'
import { uploadPropertyImage } from '@/api/propertyImage'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({ style: { navigationBarTitleText: '编辑房源' } })
const tokenStore = useTokenStore()
const id = ref('')
const ready = ref(false)
const accessState = ref<'checking' | 'guest' | 'denied' | 'error' | 'manager'>('checking')
const loadError = ref('')
const saving = ref(false)
const uploading = ref(false)
let disposed = false
let requestVersion = 0
let operationVersion = 0
let selectionVersion = 0
let choosing = false
let pendingLoad: Promise<void> = Promise.resolve()
let wakeSelection: (() => void) | undefined
let loadedToken = ''
let verifiedToken = ''
function cancelSelection() {
  selectionVersion++
  choosing = false
  uploading.value = false
  wakeSelection?.()
  wakeSelection = undefined
}
function dispose() {
  disposed = true
  requestVersion++
  operationVersion++
  saving.value = false
  cancelSelection()
}
onUnload(dispose)
onBeforeUnmount(dispose)
watch(() => tokenStore.validToken, () => {
  requestVersion++
  operationVersion++
  ready.value = false
  verifiedToken = ''
  loadedToken = ''
  saving.value = false
  cancelSelection()
  accessState.value = tokenStore.updateNowTime().hasLogin ? 'error' : 'guest'
}, { flush: 'sync' })
const imageUrls = ref('')
const facilities = ref('')
// onLoad 会回填已存房源的地区文案,声明必须在其之前
const regionLabel = ref('')
const initialForm: PropertyInput = {
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
  priceUnit: 'month',
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
}
const form = reactive<PropertyInput>({ ...initialForm, facilities: [], images: [] })
const rentalModes: (RentalMode | null)[] = [null, 'whole', 'shared', 'room', 'short']
const rentalModeLabels = rentalModes.map(mode => mode ? RENTAL_MODE_LABEL[mode] : '未指定')
function syncPriceUnit() {
  form.priceUnit = form.priceType === 'sale' ? null : form.rentalMode === 'short' ? 'day' : 'month'
  if (form.priceType === 'sale')
    form.rentalMode = null
}
watch(() => [form.priceType, form.rentalMode], syncPriceUnit, { flush: 'sync' })
const priceLabel = computed(() => form.priceType === 'sale' ? '总价（元）*' : `租金（元${propertyPriceSuffix(form)}）*`)
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
onLoad((q) => {
  id.value = String(q?.id || '')
})
onShow(() => {
  void load()
})
function isCurrent(version: number, token: string) {
  return !disposed && version === requestVersion
    && tokenStore.updateNowTime().hasLogin && token === tokenStore.validToken
}
function isOperationCurrent(version: number, token: string) {
  return version === operationVersion && canWrite() && token === verifiedToken
}
function canWrite() {
  return !disposed && ready.value && accessState.value === 'manager'
    && tokenStore.updateNowTime().hasLogin && verifiedToken === tokenStore.validToken
}
function viewProperties() {
  uni.switchTab({ url: '/pages/index/index' })
}
function load() {
  pendingLoad = loadPage()
  wakeSelection?.()
  return pendingLoad
}
async function loadPage() {
  if (disposed)
    return
  const session = tokenStore.updateNowTime()
  const version = ++requestVersion
  operationVersion++
  saving.value = false
  // 原生选图会触发 onShow；仅保留尚未上传的选择，写入前等待最新核验。
  uploading.value = choosing
  ready.value = false
  verifiedToken = ''
  loadError.value = ''
  if (!session.hasLogin) {
    accessState.value = 'guest'
    cancelSelection()
    return
  }
  const token = session.validToken
  accessState.value = 'checking'
  try {
    const me = await getUserInfo({ header: { Authorization: `Bearer ${token}` }, hideErrorToast: true })
    if (!isCurrent(version, token))
      return
    if (me?.isPropertyManager !== true) {
      accessState.value = 'denied'
      cancelSelection()
      return
    }
    accessState.value = 'manager'
    verifiedToken = token
  }
  catch {
    if (isCurrent(version, token)) {
      accessState.value = 'error'
      cancelSelection()
    }
    return
  }
  if (loadedToken === token) {
    ready.value = true
    return
  }
  Object.assign(form, initialForm, { images: [], facilities: [] })
  imageUrls.value = ''
  facilities.value = ''
  regionLabel.value = ''
  void loadRegionTree(version, token)
  try {
    if (id.value) {
      const p = await fetchPropertyDetail(id.value)
      if (!isCurrent(version, token))
        return
      Object.assign(form, p)
      syncPriceUnit()
      imageUrls.value = p.images.join('\n')
      facilities.value = p.facilities.join('，')
      regionLabel.value = [p.city, p.district].filter(Boolean).join(' ')
    }
    if (!isCurrent(version, token))
      return
    loadedToken = token
    ready.value = true
  }
  catch {
    if (isCurrent(version, token))
      loadError.value = '房源加载失败，请重试'
  }
}

/** 省市区级联:数据来自 backend /miniapp/region/tree,与用户侧服务同源 */
const regionTree = ref<RegionNode[]>([])
const provinceIdx = ref(0)
const cityIdx = ref(0)
const districtIdx = ref(0)
const provinces = computed(() => regionTree.value.map(p => p.name))
const cities = computed(() =>
  regionTree.value[provinceIdx.value]?.children?.map(c => c.name) ?? [],
)
const districts = computed(() =>
  regionTree.value[provinceIdx.value]?.children?.[cityIdx.value]?.children
    ?.map(c => c.name) ?? [],
)

async function loadRegionTree(version: number, token: string) {
  try {
    const tree = await fetchRegionTree()
    if (isCurrent(version, token))
      regionTree.value = tree
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
  if (uploading.value || saving.value || !canWrite())
    return
  const token = verifiedToken
  const count = 9 - imageList.value.length
  if (count <= 0) {
    uni.showToast({ title: '最多9张图片', icon: 'none' })
    return
  }
  const selection = ++selectionVersion
  const isSelectionCurrent = () => !disposed && selection === selectionVersion
    && tokenStore.updateNowTime().hasLogin && token === tokenStore.validToken
  choosing = true
  uploading.value = true
  uni.chooseImage({
    count,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      let version: number | undefined
      try {
        while (isSelectionCurrent()) {
          const pending = pendingLoad
          await Promise.race([pending, new Promise<void>((resolve) => {
            wakeSelection = resolve
          })])
          if (pending === pendingLoad)
            break
        }
        if (!isSelectionCurrent() || !canWrite())
          return
        choosing = false
        version = operationVersion
        for (const path of res.tempFilePaths) {
          if (!isOperationCurrent(version, token))
            break
          const url = await uploadPropertyImage(path)
          if (!isOperationCurrent(version, token))
            break
          imageUrls.value = [...imageList.value, url].join('\n')
        }
      }
      catch (error) {
        if (version !== undefined && isOperationCurrent(version, token)) {
          uni.showToast({
            title: error instanceof Error ? error.message : '图片上传失败',
            icon: 'none',
          })
        }
      }
      finally {
        if (selection === selectionVersion)
          wakeSelection = undefined
        if (isSelectionCurrent() && (version === undefined || version === operationVersion)) {
          choosing = false
          uploading.value = false
        }
      }
    },
    fail: () => {
      if (isSelectionCurrent()) {
        choosing = false
        uploading.value = false
      }
    },
  })
}
async function submit(status: 1 | 2) {
  if (saving.value || uploading.value || !canWrite())
    return
  const version = operationVersion
  const token = verifiedToken
  syncPriceUnit()
  const images = imageUrls.value
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
  const availableFromInvalid = !!form.availableFrom
    && !/^\d{4}-\d{2}-\d{2}$/.test(String(form.availableFrom))
  if (
    !form.title.trim()
    || !form.address.trim()
    || !(Number(form.price) >= 1)
    || availableFromInvalid
    || images.length > 9
    || images.some(s => !/^https?:\/\/\S+$/.test(s) || s.length > 1000)
  ) {
    uni.showToast({
      title: availableFromInvalid
        ? '可入住日期格式应为 2026-12-01'
        : '请填写标题、地址、有效价格及图片链接',
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
      priceUnit: form.priceType === 'sale' ? null : form.rentalMode === 'short' ? 'day' : 'month',
      status,
      images,
      facilities: facilities.value
        .split(/[,，]/)
        .map(s => s.trim())
        .filter(Boolean),
    })
    if (isOperationCurrent(version, token)) {
      uni.showToast({ title: '已保存', icon: 'success' })
      uni.navigateBack()
    }
  }
  catch {
    if (isOperationCurrent(version, token))
      uni.showToast({ title: '保存失败，填写信息已保留，请重试', icon: 'none' })
  }
  finally {
    if (isOperationCurrent(version, token))
      saving.value = false
  }
}
</script>

<template>
  <view v-if="ready" class="edit-page app-page p-4">
    <view class="app-panel p-4">
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
        :range="rentalModeLabels"
        :value="rentalModes.indexOf(form.rentalMode)"
        @change="form.rentalMode = rentalModes[Number($event.detail.value)] ?? null"
      >
        <view class="min-h-11 py-3">
          租赁方式：{{ form.rentalMode ? RENTAL_MODE_LABEL[form.rentalMode] : '未指定' }} ›
        </view>
      </picker>
      <text class="block text-sm">
        {{ priceLabel }}
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
      <button class="app-secondary-button flex-1" :disabled="saving || uploading" @tap="submit(1)">
        存为草稿
      </button><button
        class="app-primary-button flex-1"
        :disabled="saving || uploading"
        @tap="submit(2)"
      >
        保存并上架
      </button>
    </view>
  </view>
  <view v-else class="edit-page app-page">
    <view class="app-content py-6">
      <view class="app-panel app-state gap-3 px-5 py-12">
        <text class="text-center text-base text-app-ink font-semibold">
          {{ accessState === 'guest' ? '登录后维护房源' : accessState === 'denied' ? '房源由公寓管家统一维护' : accessState === 'error' ? '管理身份核验失败' : loadError || '正在加载房源…' }}
        </text>
        <button v-if="accessState === 'guest'" class="app-primary-button w-full" @tap="toLoginPage()">
          去登录
        </button>
        <button v-else-if="accessState === 'error' || loadError" class="app-secondary-button w-full" @tap="load">
          重新加载
        </button>
        <button v-if="accessState === 'denied'" class="app-secondary-button w-full" @tap="viewProperties">
          查看房源
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.edit-page {
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
}

input,
picker > view,
button {
  min-height: 44px;
}
</style>
