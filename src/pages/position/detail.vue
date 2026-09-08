<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { applyPosition, createPositionShares, getPositionDetail } from '@/api/position'
import type { PositionDetail as PositionDetailResponse } from '@/api/position'
import { getResumes } from '@/api/resume'
import type { ResumeItem } from '@/api/resume'
import AppPageHeader from '@/components/AppPageHeader.vue'
import { useTokenStore } from '@/store/token'
import { formatPositionSalary } from '@/utils/positionSalary'
import { toLoginPage } from '@/utils/toLoginPage'

defineOptions({
  name: 'PositionDetail',
})

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '职位详情',
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F5F7FA',
    backgroundColorTop: '#FFFFFF',
    backgroundColorBottom: '#FFFFFF',
  },
})

const POSITION_LIST_PATH = '/pages/position/index'
const DETAIL_PATH = '/pages/position/detail'
const SHARE_LIST_PATH = '/pages/position/sharelist'
const POSITION_PROGRESS_PATH = '/pages/position/progress'
interface PositionDetailView {
  id: string
  jobId: string | number
  title: string
  salary: string
  location: string
  education: string
  experience: string
  tags: string[]
  responsibilities: string[]
  requirements: string[]
  applied: boolean
  applyRecordId?: string | number
}

const EMPTY_POSITION: PositionDetailView = {
  id: '',
  jobId: '',
  title: '',
  salary: '',
  location: '',
  education: '',
  experience: '',
  tags: [],
  responsibilities: [],
  requirements: [],
  applied: false,
}
const tokenStore = useTokenStore()
const position = ref<PositionDetailView>(EMPTY_POSITION)
const isLoading = ref(true)
const isApplying = ref(false)
const isResumePickerVisible = ref(false)
const isResumesLoading = ref(false)
const resumes = ref<ResumeItem[]>([])
const selectedResumeId = ref<string>()
const screenshotPath = ref('')
const sharePositionId = ref('')
const isShareLoading = ref(false)

const isApplied = computed(() => position.value.applied)
const isLoggedIn = computed(() => tokenStore.hasLogin)
const detailPath = computed(() => `${DETAIL_PATH}?id=${encodeURIComponent(position.value.id)}`)
const sharePath = computed(() => {
  const base = `${SHARE_LIST_PATH}?id=${encodeURIComponent(position.value.id)}`
  return sharePositionId.value ? `${base}&shareId=${encodeURIComponent(sharePositionId.value)}` : base
})
const shareTitle = computed(() => position.value.title)

function normalizeTextList(value?: string[] | string) {
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\\r?\\n|\r?\n/) : []
  return entries
    .map(item => item.trim().replace(/^\d+[.、]\s*/, ''))
    .filter(Boolean)
}

function toPositionDetail(source: PositionDetailResponse): PositionDetailView {
  return {
    id: source.positionId,
    jobId: source.jobId,
    title: source.positionName,
    salary: formatPositionSalary(source),
    location: source.location,
    education: source.edu,
    experience: source.experience,
    tags: source.tags || [],
    responsibilities: normalizeTextList(source.responsibilities),
    requirements: normalizeTextList(source.requirements),
    applied: Boolean(source.applied),
    applyRecordId: source.applyRecordId,
  }
}

onLoad(async (options) => {
  if (!options?.id) {
    isLoading.value = false
    return
  }
  try {
    position.value = toPositionDetail(await getPositionDetail(options.id))
    // #ifdef MP-WEIXIN
    nextTick(() => drawSharePoster())
    // #endif
  }
  catch {
    uni.showToast({ title: '职位加载失败，请稍后重试', icon: 'none' })
  }
  finally {
    isLoading.value = false
  }
})

// #ifdef MP-WEIXIN
function drawSharePoster() {
  uni.downloadFile({
    url: 'https://static1.3sbio.com/logo/2.png',
    success: ({ statusCode, tempFilePath }: { statusCode: number, tempFilePath: string }) => {
      renderCanvas(statusCode === 200 ? tempFilePath : '')
    },
    fail: () => renderCanvas(''),
  })

  function renderCanvas(logoPath: string) {
    const ctx = uni.createCanvasContext('share-poster')
    const W = 375
    const H = 320
    const PAD = 16
    const MAX_CHARS = 22
    const LOGO_SIZE = 21
    const TITLE_X = logoPath ? PAD + LOGO_SIZE + 8 : PAD

    ctx.setFillStyle('#ffffff')
    ctx.fillRect(0, 0, W, H)

    // Logo（与标题行垂直居中）
    if (logoPath) {
      ctx.drawImage(logoPath, PAD, 16, LOGO_SIZE, LOGO_SIZE)
    }

    // 职位名 + 薪资
    const title = position.value.title || ''
    const titleShort = title.length > 14 ? `${title.slice(0, 14)}…` : title
    ctx.font = 'bold 17px sans-serif'
    ctx.setFillStyle('#1a2640')
    ctx.setTextAlign('left')
    ctx.fillText(titleShort, TITLE_X, 36)
    ctx.font = '600 14px sans-serif'
    ctx.setFillStyle('#2d6fe6')
    ctx.setTextAlign('right')
    ctx.fillText(position.value.salary || '', W - PAD, 36)

    // 工作信息行
    const metas = [
      position.value.location,
      position.value.experience,
      position.value.education,
    ].filter(Boolean).join('   ·   ')
    ctx.font = '12px sans-serif'
    ctx.setFillStyle('#6b7a8d')
    ctx.setTextAlign('left')
    ctx.fillText(metas, PAD, 58)

    // 分隔线
    ctx.setStrokeStyle('#edf0f5')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(PAD, 70)
    ctx.lineTo(W - PAD, 70)
    ctx.stroke()

    // 职位详情
    ctx.font = 'bold 14px sans-serif'
    ctx.setFillStyle('#1a2640')
    ctx.fillText('职位详情', PAD, 90)

    const resps = position.value.responsibilities.slice(0, 4)
    resps.forEach((text, i) => {
      const truncated = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text
      ctx.font = '13px sans-serif'
      ctx.setFillStyle('#4b5565')
      ctx.fillText(`${i + 1}. ${truncated}`, PAD, 112 + i * 22)
    })

    // 分隔线
    ctx.setStrokeStyle('#edf0f5')
    ctx.beginPath()
    ctx.moveTo(PAD, 192)
    ctx.lineTo(W - PAD, 192)
    ctx.stroke()

    // 任职要求
    ctx.font = 'bold 14px sans-serif'
    ctx.setFillStyle('#1a2640')
    ctx.fillText('任职要求', PAD, 212)

    const reqs = position.value.requirements.slice(0, 3)
    reqs.forEach((text, i) => {
      const truncated = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text
      ctx.font = '13px sans-serif'
      ctx.setFillStyle('#4b5565')
      ctx.fillText(`${i + 1}. ${truncated}`, PAD, 234 + i * 22)
    })

    // 灰色底部
    ctx.setFillStyle('#f5f7fa')
    ctx.fillRect(0, 292, W, H - 292)
    ctx.font = '11px sans-serif'
    ctx.setFillStyle('#9aa5b5')
    ctx.setTextAlign('center')
    ctx.fillText('三生制药 · 期待您的加入', W / 2, 308)

    ctx.draw(false, () => {
      uni.canvasToTempFilePath({
        canvasId: 'share-poster',
        success: (res: { tempFilePath: string }) => {
          screenshotPath.value = res.tempFilePath
          console.log('[海报生成成功]', res.tempFilePath)
        },
        fail: (err: unknown) => {
          console.log('[海报生成失败]', err)
        },
      })
    })
  }
}
// #endif
onShareAppMessage(() => ({
  title: position.value.title,
  path: sharePath.value,
  imageUrl: screenshotPath.value || 'https://static1.3sbio.com/logo/2.png',
}))

onShareTimeline(() => ({
  title: shareTitle.value,
  query: sharePositionId.value
    ? `id=${encodeURIComponent(position.value.id)}&shareId=${encodeURIComponent(sharePositionId.value)}`
    : `id=${encodeURIComponent(position.value.id)}`,
}))

function handleBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: POSITION_LIST_PATH })
}

function callShareApi() {
  return createPositionShares([position.value.id])
    .then((res) => {
      sharePositionId.value = res?.id ?? ''
      console.log('[分享接口成功]', res)
    })
    .catch(err => console.log('[分享接口失败]', err))
}

function handleShareLogin() {
  toLoginPage({ queryString: `?redirect=${encodeURIComponent(sharePath.value)}` })
}

async function handleShare() {
  if (!tokenStore.updateNowTime().hasLogin) {
    handleShareLogin()
    return
  }
  if (isShareLoading.value)
    return
  isShareLoading.value = true
  try {
    await callShareApi()
  }
  finally {
    isShareLoading.value = false
  }
  // #ifdef H5
  const webNavigator = navigator as Navigator & {
    share?: (data: { title: string, text: string, url: string }) => Promise<void>
  }
  if (webNavigator.share) {
    try {
      await webNavigator.share({
        title: shareTitle.value,
        text: `${position.value.salary} · ${position.value.location}`,
        url: window.location.href,
      })
      return
    }
    catch {
      return
    }
  }
  // #endif

  uni.setClipboardData({
    data: `${shareTitle.value} ${sharePath.value}`,
    success: () => uni.showToast({ title: '职位链接已复制', icon: 'none' }),
  })
}

async function handleApply() {
  if (isApplied.value) {
    uni.showToast({ title: '该职位已投递', icon: 'none' })
    return
  }

  if (!tokenStore.updateNowTime().hasLogin) {
    toLoginPage({
      queryString: `?redirect=${encodeURIComponent(detailPath.value)}`,
    })
    return
  }

  if (isApplying.value)
    return

  isResumePickerVisible.value = true
  isResumesLoading.value = true
  selectedResumeId.value = undefined
  try {
    resumes.value = await getResumes()
    selectedResumeId.value = resumes.value.find(item => item.isDefault)?.id ?? resumes.value[0]?.id
  }
  catch {
    resumes.value = []
    isResumePickerVisible.value = false
  }
  finally {
    isResumesLoading.value = false
  }
}

function closeResumePicker() {
  if (!isApplying.value)
    isResumePickerVisible.value = false
}

function selectResume(resumeId: string) {
  if (!isApplying.value)
    selectedResumeId.value = resumeId
}

function goToResumePage() {
  isResumePickerVisible.value = false
  uni.navigateTo({ url: '/pages/resume/index' })
}

async function confirmApply() {
  if (!selectedResumeId.value || isApplying.value)
    return

  if (position.value.jobId === '' || position.value.jobId == null) {
    uni.showToast({ title: '职位 jobId 缺失，暂时无法投递', icon: 'none' })
    return
  }

  isApplying.value = true
  try {
    const positionId = position.value.id
    const applyResult = await applyPosition(positionId, {
      resumeId: selectedResumeId.value,
      jobId: position.value.jobId,
    })
    const applyRecordId = applyResult.applyId || position.value.applyRecordId
    position.value = { ...position.value, applied: true, applyRecordId }
    isResumePickerVisible.value = false
    uni.showToast({ title: '简历投递成功', icon: 'success' })

    void getPositionDetail(positionId)
      .then((detail) => {
        const refreshedPosition = toPositionDetail(detail)
        position.value = {
          ...refreshedPosition,
          applied: true,
          applyRecordId: refreshedPosition.applyRecordId ?? applyRecordId,
        }
      })
      .catch(error => console.warn('投递成功，但刷新职位详情失败:', error))
  }
  finally {
    isApplying.value = false
  }
}

function openApplyProgress() {
  if (!position.value.applyRecordId) {
    uni.showToast({ title: '投递记录加载中，请稍后重试', icon: 'none' })
    return
  }
  uni.navigateTo({
    url: `${POSITION_PROGRESS_PATH}?id=${encodeURIComponent(String(position.value.applyRecordId))}`,
  })
}
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-app-surface text-app-ink">
    <AppPageHeader title="职位详情" background="#ffffff" scrolled-background="#ffffff">
      <template #left>
        <button
          class="plain-button h-12 w-12 flex cursor-pointer items-center justify-center border-0 rounded-full bg-transparent p-0 text-xl text-app-ink leading-none active:bg-[#eef4ff]"
          aria-label="返回职位列表"
          @tap="handleBack"
        >
          <view class="i-carbon-chevron-left" />
        </button>
      </template>
    </AppPageHeader>

    <view v-if="isLoading" class="pb-36">
      <view class="bg-white px-4 pb-5 pt-4">
        <view class="skeleton-block h-10 w-3/5 rounded-xl" />
        <view class="mt-3 flex gap-2">
          <view class="skeleton-block h-6 w-24 rounded-lg" />
          <view class="skeleton-block h-6 w-20 rounded-lg" />
          <view class="skeleton-block h-6 w-20 rounded-lg" />
        </view>
      </view>
      <view class="mt-2 bg-white px-4 py-5">
        <view class="skeleton-block h-7 w-28 rounded-lg" />
        <view class="mt-4 flex flex-col gap-3">
          <view v-for="index in 7" :key="index" class="skeleton-block h-5 rounded-lg" :class="index === 7 ? 'w-3/4' : 'w-full'" />
        </view>
      </view>
    </view>

    <template v-else>
      <view class="bg-white px-4 pb-5 pt-4">
        <view class="flex items-start justify-between gap-3">
          <text class="min-w-0 flex-1 text-2xl text-app-ink font-700 leading-[1.3]">{{ position.title }}</text>
          <text class="flex-none pt-1 text-xl text-brand-blue font-700 leading-none">{{ position.salary }}</text>
        </view>
        <view v-if="position.location || position.experience || position.education" class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-app-ink-soft">
          <view v-if="position.location" class="flex items-center gap-1.5">
            <view class="i-carbon-location text-base text-app-muted leading-none" />
            <text>{{ position.location }}</text>
          </view>
          <view v-if="position.experience" class="flex items-center gap-1.5">
            <view class="i-carbon-portfolio text-base text-app-muted leading-none" />
            <text>{{ position.experience }}</text>
          </view>
          <view v-if="position.education" class="flex items-center gap-1.5">
            <view class="i-carbon-education text-base text-app-muted leading-none" />
            <text>{{ position.education }}</text>
          </view>
        </view>
      </view>

      <view class="mt-2 bg-white px-4 py-5">
        <text class="block text-xl text-app-ink font-700">职位详情</text>
        <view v-if="position.tags.some(Boolean)" class="mt-3 flex flex-wrap gap-2">
          <text v-for="tag in position.tags.filter(Boolean)" :key="tag" class="rounded-lg bg-[#f2f6fb] px-2.5 py-1.5 text-xs text-app-ink-soft">{{ tag }}</text>
        </view>

        <view class="mt-4 flex flex-col gap-2.5 text-base text-app-ink-soft leading-[1.8]">
          <text v-for="(item, index) in position.responsibilities" :key="item" class="block">
            {{ index + 1 }}. {{ item }}
          </text>
        </view>

        <text class="mt-5 block text-lg text-app-ink font-700">任职要求</text>
        <view class="mt-3 flex flex-col gap-2.5 text-base text-app-ink-soft leading-[1.8]">
          <text v-for="(item, index) in position.requirements" :key="item" class="block">
            {{ index + 1 }}. {{ item }}
          </text>
        </view>
      </view>

      <view class="h-36" />
    </template>

    <view class="fixed inset-x-0 bottom-0 z-100 border-t border-[#e9edf3] bg-white/98 px-4 pt-2.5 shadow-[0_-8rpx_28rpx_rgba(31,52,89,0.08)] pb-safe">
      <view class="flex items-center gap-3">
        <!-- #ifdef MP-WEIXIN -->
        <button v-if="isLoggedIn" class="plain-button h-12 w-12 flex flex-none flex-col items-center justify-center border-0 rounded-xl bg-[#f5f7fa] p-0 text-xs text-app-ink-soft leading-none transition-colors duration-180 active:bg-[#e9edf3] motion-reduce:transition-none" open-type="share" aria-label="分享职位" @tap="callShareApi">
          <view class="i-carbon-share mb-1 text-lg text-app-ink leading-none" />
          <text>分享</text>
        </button>
        <button v-else class="plain-button h-12 w-12 flex flex-none flex-col items-center justify-center border-0 rounded-xl bg-[#f5f7fa] p-0 text-xs text-app-ink-soft leading-none transition-colors duration-180 active:bg-[#e9edf3] motion-reduce:transition-none" aria-label="分享职位" @tap="handleShareLogin">
          <view class="i-carbon-share mb-1 text-lg text-app-ink leading-none" />
          <text>分享</text>
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <button class="plain-button h-12 w-12 flex flex-none flex-col items-center justify-center border-0 rounded-xl bg-[#f5f7fa] p-0 text-xs text-app-ink-soft leading-none transition-colors duration-180 active:bg-[#e9edf3] motion-reduce:transition-none" aria-label="分享职位" @tap="handleShare">
          <view class="i-carbon-share mb-1 text-lg text-app-ink leading-none" />
          <text>分享</text>
        </button>
        <!-- #endif -->

        <button
          class="plain-button h-12 min-w-0 flex flex-1 items-center justify-center border-0 rounded-xl bg-brand-blue px-4 text-base text-white font-700 shadow-[0_8rpx_20rpx_rgba(45,111,230,0.2)] transition-[transform,opacity,background-color] duration-180 ease-out active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#9bb8e8] disabled:shadow-none motion-reduce:transition-none"
          :disabled="isApplying"
          :aria-label="isApplied ? '查看投递进度' : '投递简历'"
          @tap="isApplied ? openApplyProgress() : handleApply()"
        >
          <view v-if="isApplying" class="apply-spinner mr-2 h-4.5 w-4.5 border-2 border-white/35 border-t-white rounded-full" />
          <text>{{ isApplying ? '正在投递' : isApplied ? '查看投递进度' : '投递简历' }}</text>
        </button>
      </view>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <canvas canvas-id="share-poster" style="position: fixed; left: -9999px; top: 0; width: 375px; height: 320px;" />
    <!-- #endif -->

    <view v-if="isResumePickerVisible" class="fixed inset-0 z-200 flex items-end bg-black/42" @tap="closeResumePicker">
      <view class="max-h-[78vh] w-full overflow-hidden rounded-t-[28rpx] bg-white shadow-[0_-18rpx_56rpx_rgba(26,48,86,0.16)] pb-safe" @tap.stop>
        <view class="mx-auto mt-2.5 h-1 w-9 rounded-full bg-[#d7dee8]" />

        <view class="flex items-start justify-between px-5 pb-3 pt-2.5">
          <view class="min-w-0 flex-1 pr-4">
            <text class="block text-lg text-app-ink font-700 leading-tight">选择投递简历</text>
            <text class="mt-1 block text-sm text-app-muted leading-relaxed">请选择一份附件简历完成投递</text>
          </view>
          <button class="plain-button h-10 w-10 flex flex-none items-center justify-center border-0 rounded-full bg-[#f3f5f8] p-0 text-lg text-app-ink-soft transition-colors duration-180 active:bg-[#e5eaf1] disabled:opacity-45 motion-reduce:transition-none" aria-label="关闭简历选择" :disabled="isApplying" @tap="closeResumePicker">
            <view class="i-carbon-close leading-none" />
          </button>
        </view>

        <view class="bg-[#f7f9fc] pt-3">
          <view v-if="isResumesLoading" class="mx-4 mb-3 flex items-center rounded-xl bg-white px-3.5 py-3.5 shadow-[0_6rpx_18rpx_rgba(36,58,91,0.06)]">
            <view class="skeleton-block h-11 w-11 flex-none rounded-xl" />
            <view class="ml-3 min-w-0 flex-1">
              <view class="skeleton-block h-5 w-2/5 rounded-lg" />
              <view class="skeleton-block mt-2 h-4 w-3/5 rounded-lg" />
            </view>
            <view class="skeleton-block ml-3 h-5.5 w-5.5 flex-none rounded-full" />
          </view>

          <scroll-view v-else-if="resumes.length" scroll-y class="max-h-[40vh] px-4" role="radiogroup" aria-label="可投递简历">
            <view
              v-for="resume in resumes"
              :key="resume.id"
              class="mb-2.5 flex cursor-pointer items-center border rounded-xl border-solid px-3.5 py-3.5 transition-[transform,background-color,border-color,box-shadow] duration-180 ease-out active:scale-[0.99] motion-reduce:transition-none"
              :class="selectedResumeId === resume.id
                ? 'border-[rgba(45,111,230,0.45)] bg-white shadow-[0_8rpx_22rpx_rgba(45,111,230,0.11)]'
                : 'border-[#edf0f4] bg-white shadow-[0_4rpx_14rpx_rgba(36,58,91,0.05)]'"
              role="radio"
              :aria-checked="selectedResumeId === resume.id"
              :aria-label="`选择简历 ${resume.name}`"
              @tap="selectResume(resume.id)"
            >
              <view
                class="h-11 w-11 flex flex-none items-center justify-center rounded-xl text-xl transition-colors duration-180 motion-reduce:transition-none"
                :class="selectedResumeId === resume.id
                  ? 'bg-brand-blue text-white shadow-[0_6rpx_16rpx_rgba(45,111,230,0.2)]'
                  : 'bg-[#edf4ff] text-brand-blue'"
              >
                <view class="i-carbon-document-pdf leading-none" />
              </view>

              <view class="ml-3 min-w-0 flex-1">
                <view class="flex items-center gap-2">
                  <text class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-base text-app-ink font-650">{{ resume.name }}</text>
                  <text v-if="resume.isDefault" class="flex-none rounded-md bg-[#e8f1ff] px-2 py-0.5 text-2xs text-brand-blue font-600">默认</text>
                </view>
                <view class="mt-1 flex items-center text-xs text-app-muted">
                  <view class="i-carbon-time mr-1 flex-none text-sm leading-none" />
                  <text class="overflow-hidden text-ellipsis whitespace-nowrap">上传于 {{ resume.uploadedAt }}</text>
                </view>
              </view>

              <view
                class="ml-3 h-5.5 w-5.5 flex flex-none items-center justify-center border-2 rounded-full transition-colors duration-180 motion-reduce:transition-none"
                :class="selectedResumeId === resume.id
                  ? 'border-brand-blue bg-brand-blue text-white'
                  : 'border-[#cbd5e1] bg-white'"
              >
                <view v-if="selectedResumeId === resume.id" class="i-carbon-checkmark text-xs leading-none" />
              </view>
            </view>
          </scroll-view>

          <view v-else class="mx-4 mb-3 flex flex-col items-center border border-[#edf0f4] rounded-xl border-solid bg-white px-6 py-7 text-center shadow-[0_4rpx_14rpx_rgba(36,58,91,0.05)]">
            <view class="h-12 w-12 flex items-center justify-center rounded-xl bg-[#edf4ff] text-2xl text-brand-blue">
              <view class="i-carbon-document-add leading-none" />
            </view>
            <text class="mt-3 block text-base text-app-ink font-650">还没有附件简历</text>
            <text class="mt-1 block text-sm text-app-muted leading-relaxed">先上传简历，再回来投递当前职位</text>
            <button class="plain-button mt-4 h-11 flex items-center justify-center border border-[rgba(45,111,230,0.2)] rounded-xl border-solid bg-[#edf4ff] px-5 text-sm text-brand-blue font-650 transition-colors duration-180 active:bg-[#dce9ff] motion-reduce:transition-none" @tap="goToResumePage">
              <view class="i-carbon-upload mr-2 text-base leading-none" />
              <text>上传简历</text>
            </button>
          </view>
        </view>

        <view v-if="!isResumesLoading && resumes.length" class="flex items-center gap-3 border-t border-[#e7ebf1] bg-white px-4 py-3">
          <button class="plain-button h-12 w-24 flex flex-none items-center justify-center border border-[#dce2ea] rounded-xl border-solid bg-white text-base text-app-ink-soft font-600 transition-colors duration-180 active:bg-[#f1f4f8] disabled:opacity-45 motion-reduce:transition-none" :disabled="isApplying" @tap="closeResumePicker">
            取消
          </button>
          <button class="plain-button h-12 min-w-0 flex flex-1 items-center justify-center border-0 rounded-xl bg-brand-blue px-4 text-base text-white font-700 shadow-[0_8rpx_20rpx_rgba(45,111,230,0.2)] transition-[transform,opacity,background-color] duration-180 active:scale-[0.99] disabled:bg-[#9bb8e8] disabled:shadow-none motion-reduce:transition-none" :disabled="!selectedResumeId || isApplying" @tap="confirmApply">
            <view v-if="isApplying" class="apply-spinner mr-2 h-4 w-4 border-2 border-white/35 border-t-white rounded-full" />
            <view v-else class="i-carbon-send-alt mr-2 text-lg leading-none" />
            <text>{{ isApplying ? '正在投递' : '确认投递' }}</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.plain-button::after {
  border: 0;
}

.skeleton-block {
  background: linear-gradient(90deg, #edf1f6 25%, #f7f9fc 42%, #edf1f6 64%);
  background-size: 300% 100%;
  animation: skeleton-shimmer 1.3s ease-in-out infinite;
}

.apply-spinner {
  animation: apply-spin 0.8s linear infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: 0 0;
  }
}

@keyframes apply-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-block,
  .apply-spinner {
    animation: none;
  }
}
</style>
