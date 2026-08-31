<script setup lang="ts">
import { ref } from 'vue'
import AppPageHeader from '@/components/AppPageHeader.vue'

defineOptions({
  name: 'Home',
})

definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '首页',
    backgroundColor: '#EDF6FF',
  },
})

interface SwiperChangeEvent {
  detail: { current: number }
}

interface QuickEntry {
  title: string
  iconClass: string
  gradient: string
  glow: string
  pagePath: string
}

const TAB_PAGES = [
  'pages/index/index',
  'pages/position/index',
  'pages/ai-chat/index',
  'pages/notification/index',
  'pages/me/me',
]

const banners = [
  {
    tag: '2026 全球招聘',
    title: '加入三生 · 共创新生',
    description: '构建你与三生的每一次相遇',
    background: 'linear-gradient(122deg, #1b62e0 0%, #2f7ff2 52%, #46a4f8 100%)',
  },
  {
    tag: '专业成长',
    title: '遇见更好的职业机会',
    description: '与优秀的人一起，成就专业价值',
    background: 'linear-gradient(122deg, #4a5ce8 0%, #6f63ef 52%, #9576f0 100%)',
  },
  {
    tag: '校招启航',
    title: '应届生启航计划',
    description: '导师带练 · 双通道晋升 · 全球视野',
    background: 'linear-gradient(122deg, #0f9bb5 0%, #16b1a8 54%, #38ca9c 100%)',
  },
]

const quickEntryPages: QuickEntry[][] = [
  [
    { title: '社会招聘', iconClass: 'i-carbon-portfolio', gradient: 'linear-gradient(140deg, #2f6fe8 0%, #4d9bf6 100%)', glow: '0 10rpx 20rpx rgba(47,111,232,0.26)', pagePath: 'pages/position/index' },
    { title: '校园招聘', iconClass: 'i-carbon-education', gradient: 'linear-gradient(140deg, #12b3c7 0%, #46d8d0 100%)', glow: '0 10rpx 20rpx rgba(18,179,199,0.24)', pagePath: 'pages/position/index' },
    { title: '内部推荐', iconClass: 'i-carbon-share-knowledge', gradient: 'linear-gradient(140deg, #ff7a2f 0%, #ffab3d 100%)', glow: '0 10rpx 20rpx rgba(255,122,47,0.24)', pagePath: 'pages/position/index' },
    { title: '求职工作台', iconClass: 'i-carbon-dashboard', gradient: 'linear-gradient(140deg, #16bd8e 0%, #4ddba8 100%)', glow: '0 10rpx 20rpx rgba(22,189,142,0.24)', pagePath: 'pages/me/me' },
    { title: '我的投递', iconClass: 'i-carbon-send-alt', gradient: 'linear-gradient(140deg, #6a63ef 0%, #9a7cf3 100%)', glow: '0 10rpx 20rpx rgba(106,99,239,0.24)', pagePath: 'pages/me/me' },
    { title: '面试安排', iconClass: 'i-carbon-calendar', gradient: 'linear-gradient(140deg, #f0603d 0%, #ff8f6b 100%)', glow: '0 10rpx 20rpx rgba(240,96,61,0.24)', pagePath: 'pages/me/me' },
    { title: '岗位收藏', iconClass: 'i-carbon-favorite', gradient: 'linear-gradient(140deg, #ff5c8a 0%, #ff96b2 100%)', glow: '0 10rpx 20rpx rgba(255,92,138,0.24)', pagePath: 'pages/me/me' },
    { title: '消息通知', iconClass: 'i-carbon-notification', gradient: 'linear-gradient(140deg, #5f7ce8 0%, #86a4ff 100%)', glow: '0 10rpx 20rpx rgba(95,124,232,0.24)', pagePath: 'pages/notification/index' },
  ],
  [
    { title: '简历完善', iconClass: 'i-carbon-user-profile', gradient: 'linear-gradient(140deg, #2aa8e0 0%, #5fd0f0 100%)', glow: '0 10rpx 20rpx rgba(42,168,224,0.24)', pagePath: 'pages/me/me' },
    { title: '麟才 AI', iconClass: 'i-carbon-ai-status', gradient: 'linear-gradient(140deg, #7b4df0 0%, #a97cf7 100%)', glow: '0 10rpx 20rpx rgba(123,77,240,0.24)', pagePath: 'pages/ai-chat/index' },
    { title: '薪酬福利', iconClass: 'i-carbon-wallet', gradient: 'linear-gradient(140deg, #f2a13c 0%, #ffc768 100%)', glow: '0 10rpx 20rpx rgba(242,161,60,0.24)', pagePath: 'pages/about/about' },
    { title: '企业介绍', iconClass: 'i-carbon-building', gradient: 'linear-gradient(140deg, #1f9ab0 0%, #47c3cc 100%)', glow: '0 10rpx 20rpx rgba(31,154,176,0.24)', pagePath: 'pages/about/about' },
    { title: '常见问题', iconClass: 'i-carbon-help', gradient: 'linear-gradient(140deg, #6b7fa8 0%, #98abc9 100%)', glow: '0 10rpx 20rpx rgba(107,127,168,0.22)', pagePath: 'pages/about/about' },
    { title: '全部岗位', iconClass: 'i-carbon-apps', gradient: 'linear-gradient(140deg, #d2568f 0%, #f083b8 100%)', glow: '0 10rpx 20rpx rgba(210,86,143,0.24)', pagePath: 'pages/position/index' },
  ],
]

const popularJobs = [
  { title: '生物药研发高级研究员', tags: ['上海', '硕士', '3-5年'], salary: '25-40K' },
  { title: '医学联络官（MSL）', tags: ['北京', '本科', '1-3年'], salary: '20-35K' },
  { title: '质量注册专员', tags: ['沈阳', '本科', '经验不限'], salary: '12-18K' },
]

const headerScrolled = ref(false)
const bannerIndex = ref(0)
const entryPageIndex = ref(0)

function openPage(pagePath: string) {
  const url = `/${pagePath}`
  if (TAB_PAGES.includes(pagePath)) {
    uni.switchTab({ url })
    return
  }
  uni.navigateTo({ url })
}

function handleBannerChange(event: SwiperChangeEvent) {
  bannerIndex.value = event.detail.current
}

function handleEntryPageChange(event: SwiperChangeEvent) {
  entryPageIndex.value = event.detail.current
}

onPageScroll(({ scrollTop }) => {
  headerScrolled.value = scrollTop > 8
})
</script>

<template>
  <view class="app-tab-page font-['Noto_Sans_SC','Microsoft_YaHei',sans-serif]">
    <view class="relative overflow-hidden bg-home-hero">
      <AppPageHeader
        title="三生制药招聘"
        transparent
        :scrolled="headerScrolled"
      />

      <view class="relative z-1 px-3 pb-4 pt-2">
        <view class="mb-3 px-1.5">
          <text class="block text-xl text-app-ink font-800 leading-[1.3] tracking-1rpx">找到属于你的岗位</text>
          <text class="mt-1.5 block text-2xs text-app-muted">三生制药 · 创新驱动的全球化生物制药企业</text>
        </view>

        <view class="relative">
          <swiper
            class="h-296rpx overflow-hidden rounded-36rpx shadow-[0_18rpx_40rpx_rgba(40,88,176,0.18)]"
            circular
            autoplay
            :interval="4200"
            :duration="420"
            @change="handleBannerChange"
          >
            <swiper-item v-for="banner in banners" :key="banner.title">
              <view
                class="relative box-border h-full flex flex-col justify-center overflow-hidden rounded-36rpx px-5 pb-4 text-white"
                :style="{ background: banner.background }"
              >
                <view class="pointer-events-none absolute h-260rpx w-260rpx rounded-full bg-white/14 -right-72rpx -top-96rpx" />
                <view class="pointer-events-none absolute right-72rpx h-180rpx w-180rpx rounded-full bg-white/10 -bottom-88rpx" />

                <view class="relative z-1 self-start rounded-full bg-white/22 px-2.5 py-1 text-3xs tracking-2rpx">
                  {{ banner.tag }}
                </view>
                <text class="relative z-1 mt-3 text-xl font-800 leading-[1.32] tracking-2rpx">{{ banner.title }}</text>
                <text class="relative z-1 mt-2 block text-xs text-white/86">{{ banner.description }}</text>
              </view>
            </swiper-item>
          </swiper>

          <view class="pointer-events-none absolute inset-x-0 bottom-3 z-1 flex justify-center">
            <view class="flex items-center gap-1.5 rounded-full bg-black/16 px-2 py-1">
              <view
                v-for="(banner, index) in banners"
                :key="banner.title"
                class="h-6rpx rounded-full transition-all duration-260"
                :class="index === bannerIndex ? 'w-28rpx bg-white' : 'w-10rpx bg-white/48'"
              />
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="px-3 pt-1">
      <view
        class="relative cursor-pointer overflow-hidden rounded-32rpx bg-[linear-gradient(118deg,#3f61f2_0%,#6a5bf0_52%,#9a63f2_100%)] px-3.5 py-3 shadow-[0_16rpx_36rpx_rgba(72,78,214,0.24)] active:opacity-88"
        role="button"
        @tap="openPage('pages/ai-chat/index')"
      >
        <view class="pointer-events-none absolute h-200rpx w-200rpx rounded-full bg-white/16 -right-56rpx -top-72rpx" />
        <view class="pointer-events-none absolute left-160rpx h-140rpx w-140rpx rounded-full bg-white/10 -bottom-72rpx" />

        <view class="relative z-1 flex items-center">
          <view class="h-92rpx w-92rpx center flex-none border-1rpx border-white/30 rounded-26rpx border-solid bg-white/18">
            <view class="i-carbon-ai-status text-2xl text-white leading-none" />
          </view>

          <view class="ml-3 min-w-0 flex flex-1 flex-col">
            <view class="flex items-center">
              <text class="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-white font-700">麟才寻你 · AI 助手</text>
              <text class="ml-1.5 flex-none rounded-full bg-white/24 px-1.5 py-0.5 text-3xs text-white font-600">NEW</text>
            </view>
            <text class="mt-1.5 block text-2xs text-white/82">说出期望，AI 帮你匹配岗位并一键投递</text>
          </view>

          <view class="ml-2 h-60rpx flex flex-none items-center rounded-full bg-white px-3 text-xs text-[#5347e8] font-700 shadow-[0_8rpx_18rpx_rgba(28,32,110,0.18)]">
            <text>聊一聊</text>
            <view class="i-carbon-arrow-right ml-0.5 text-xs leading-none" />
          </view>
        </view>
      </view>

      <view class="mt-3 app-card px-1.5 pb-3 pt-4">
        <swiper
          class="h-300rpx"
          :duration="300"
          @change="handleEntryPageChange"
        >
          <swiper-item v-for="(entryPage, pageIndex) in quickEntryPages" :key="pageIndex">
            <view class="grid grid-cols-4 gap-y-5 px-1">
              <view
                v-for="entry in entryPage"
                :key="entry.title"
                class="flex flex-col cursor-pointer items-center active:opacity-70"
                role="button"
                @tap="openPage(entry.pagePath)"
              >
                <view
                  class="h-84rpx w-84rpx center rounded-26rpx"
                  :style="{ background: entry.gradient, boxShadow: entry.glow }"
                >
                  <view class="h-44rpx w-44rpx text-2xl text-white leading-none" :class="entry.iconClass" />
                </view>
                <text class="mt-2 text-2xs text-app-ink-soft font-600">{{ entry.title }}</text>
              </view>
            </view>
          </swiper-item>
        </swiper>

        <view class="mt-1 flex items-center justify-center gap-1">
          <view
            v-for="(entryPage, pageIndex) in quickEntryPages"
            :key="pageIndex"
            class="h-6rpx rounded-full transition-all duration-260"
            :class="pageIndex === entryPageIndex ? 'w-28rpx bg-brand-blue' : 'w-12rpx bg-[#dbe4f2]'"
          />
        </view>
      </view>

      <view class="mb-2.5 mt-4 flex items-center justify-between px-1.5">
        <view class="min-w-0 flex flex-1 items-center">
          <view class="mr-2 h-28rpx w-6rpx flex-none rounded-full bg-brand-hero" />
          <text class="text-base text-app-ink font-700">热门岗位</text>
          <text class="ml-2 overflow-hidden text-ellipsis whitespace-nowrap text-2xs text-app-muted">本周高热度在招</text>
        </view>
        <view
          class="ml-3 flex flex-none cursor-pointer items-center text-xs text-app-muted active:opacity-74"
          role="button"
          @tap="openPage('pages/position/index')"
        >
          <text>查看全部</text>
          <view class="i-carbon-chevron-right ml-px text-sm leading-none" />
        </view>
      </view>

      <view class="flex flex-col gap-2.5">
        <view
          v-for="(job, index) in popularJobs"
          :key="job.title"
          class="cursor-pointer app-card px-3.5 py-3.5 active:opacity-80"
          role="button"
          @tap="openPage('pages/position/index')"
        >
          <view class="flex items-center gap-2">
            <text class="flex-none rounded-8rpx bg-[#fff1e6] px-1.5 py-0.5 text-3xs text-[#ff7311] font-700">
              TOP{{ index + 1 }}
            </text>
            <text class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-app-ink font-700">
              {{ job.title }}
            </text>
            <text class="flex-none text-sm text-[#ff7311] font-800">{{ job.salary }}</text>
          </view>

          <view class="mt-2.5 flex flex-wrap gap-1.5">
            <text
              v-for="tag in job.tags"
              :key="tag"
              class="rounded-10rpx bg-[#f1f5fb] px-2 py-1 text-2xs text-[#5b6b85]"
            >
              {{ tag }}
            </text>
          </view>

          <view class="mt-3 flex items-center justify-between border-t-1rpx border-t-[#eef2f8] border-t-solid pt-2.5">
            <view class="flex items-center text-2xs text-app-muted">
              <view class="i-carbon-building mr-1 text-sm leading-none" />
              <text>三生制药 · 官方直招</text>
            </view>
            <text class="text-2xs text-brand-blue font-600">立即查看</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
