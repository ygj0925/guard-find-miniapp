<script setup lang="ts">
import { ref } from 'vue'
import { deleteResume, getFileUrl, getResumes, setDefaultResume, updateResume, uploadResume } from '@/api/resume'
import type { ResumeItem } from '@/api/resume'
import AppPageHeader from '@/components/AppPageHeader.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '附件简历', backgroundColor: '#f5f7fa' } })

const MAX_RESUMES = 3
const resumes = ref<ResumeItem[]>([])
const loading = ref(false)
const editing = ref<ResumeItem>()
const inputFocus = ref(false)
const editName = ref('')

function handleBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: '/pages/me/me' })
}

async function loadResumes() {
  loading.value = true
  try {
    const data = await getResumes()
    console.log('getResumes 返回数据：', data)
    resumes.value = data
  }
  catch { resumes.value = [] }
  finally { loading.value = false }
}

function chooseResume() {
  if (resumes.value.length >= MAX_RESUMES) {
    uni.showToast({ title: `最多上传 ${MAX_RESUMES} 份简历`, icon: 'none' })
    return
  }
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['pdf', 'doc', 'docx'],
    success: async (result) => {
      const file = result.tempFiles[0]
      if (!file)
        return
      const name = file.name.replace(/\.[^.]+$/, '') || '我的简历'
      loading.value = true
      try {
        await uploadResume(name, file.path)
        await loadResumes()
        uni.showToast({ title: '上传成功', icon: 'success' })
      }
      catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '上传失败', icon: 'none' }) }
      finally { loading.value = false }
    },
  })
  // #endif
  // #ifndef MP-WEIXIN
  uni.chooseFile({
    count: 1,
    type: 'all',
    extension: ['pdf', 'doc', 'docx'],
    success: async (result) => {
      const file = result.tempFiles[0]
      if (!file)
        return
      const name = file.name.replace(/\.[^.]+$/, '') || '我的简历'
      loading.value = true
      try {
        await uploadResume(name, file.path)
        await loadResumes()
        uni.showToast({ title: '上传成功', icon: 'success' })
      }
      catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '上传失败', icon: 'none' }) }
      finally { loading.value = false }
    },
  })
  // #endif
}

function showItemActions(item: ResumeItem) {
  const actions = item.isDefault
    ? ['下载简历', '在线预览', '重命名', '删除']
    : ['下载简历', '在线预览', '重命名', '设为默认', '删除']

  uni.showActionSheet({
    itemList: actions,
    success: (res) => {
      const action = actions[res.tapIndex]
      if (action === '下载简历') {
        previewResume(item)
      }
      else if (action === '在线预览') {
        onlinePreview(item)
      }
      else if (action === '重命名') {
        editing.value = item
        editName.value = item.name
        inputFocus.value = true
      }
      else if (action === '设为默认') {
        makeDefault(item)
      }
      else if (action === '删除') {
        confirmDelete(item)
      }
    },
  })
}

async function previewResume(item: ResumeItem) {
  loading.value = true
  try {
    const { attachmentUrl } = await getFileUrl(item.id)
    if (!attachmentUrl) {
      uni.showToast({ title: '文件地址不存在', icon: 'none' })
      return
    }
    uni.downloadFile({
      url: attachmentUrl,
      header: { Authorization: `Bearer ${uni.getStorageSync('auth-access-token')}` },
      success: ({ statusCode, tempFilePath }) => {
        if (statusCode === 200)
          uni.openDocument({ filePath: tempFilePath, showMenu: true })
        else
          uni.showToast({ title: '简历打开失败', icon: 'none' })
      },
      fail: () => uni.showToast({ title: '简历打开失败', icon: 'none' }),
    })
  }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '简历打开失败', icon: 'none' }) }
  finally { loading.value = false }
}

function onlinePreview(item: ResumeItem) {
  uni.navigateTo({ url: `/pages/resume/preview?id=${item.id}` })
}

async function saveName() {
  if (!editing.value || !editName.value.trim())
    return
  loading.value = true
  try {
    await updateResume(editing.value.id, { name: editName.value.trim() })
    inputFocus.value = false
    editing.value = undefined
    await loadResumes()
  }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' }) }
  finally { loading.value = false }
}

function closeEdit() {
  inputFocus.value = false
  editing.value = undefined
}

function confirmDelete(item: ResumeItem) {
  uni.showModal({
    title: '删除简历',
    content: `确定删除"${item.name}"吗？`,
    success: async ({ confirm }) => {
      if (!confirm)
        return
      loading.value = true
      try {
        await deleteResume(item.id)
        await loadResumes()
        uni.showToast({ title: '删除成功', icon: 'success' })
      }
      catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '删除失败', icon: 'none' }) }
      finally { loading.value = false }
    },
  })
}

async function makeDefault(item: ResumeItem) {
  if (item.isDefault)
    return
  loading.value = true
  try { await setDefaultResume(item.id); await loadResumes() }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '设置失败', icon: 'none' }) }
  finally { loading.value = false }
}

onShow(loadResumes)
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-[#f5f7fa]">
    <AppPageHeader title="附件简历" background="#ffffff" scrolled-background="#ffffff">
      <template #left>
        <button
          class="plain-button h-12 w-12 flex cursor-pointer items-center justify-center border-0 rounded-full bg-transparent p-0 text-xl text-[#17233d] leading-none active:bg-[#eef4ff]"
          aria-label="返回"
          @tap="handleBack"
        >
          <view class="i-carbon-chevron-left" />
        </button>
      </template>
    </AppPageHeader>

    <view class="px-3 pb-32 pt-4">
      <!-- 加载中 -->
      <view v-if="loading && !resumes.length" class="py-20 text-center text-sm text-[#98a2b3]">
        加载中...
      </view>

      <!-- 简历列表 -->
      <view v-else>
        <!-- 空状态 -->
        <view v-if="!resumes.length" class="rounded-xl bg-white py-16 text-center text-sm text-[#98a2b3] shadow-[0_4rpx_20rpx_rgba(38,64,105,0.06)]">
          暂无附件简历，点击下方按钮上传
        </view>

        <!-- 简历项 -->
        <view class="flex flex-col gap-3">
          <view
            v-for="item in resumes"
            :key="item.id"
            class="flex items-center rounded-xl bg-white px-4 py-5 shadow-[0_4rpx_16rpx_rgba(38,64,105,0.06)]"
          >
            <!-- PDF 图标 -->
            <view class="mr-3 h-88rpx w-72rpx flex flex-shrink-0 flex-col items-center justify-center rounded-10rpx bg-[#e84040]">
              <view class="i-carbon-document-pdf text-2xl text-white leading-none" />
            </view>

            <!-- 文件信息 -->
            <view class="min-w-0 flex flex-1 flex-col">
              <view class="flex items-center gap-2">
                <text class="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#1a2640] font-600 leading-[1.4]">
                  {{ item.name }}
                </text>
                <text v-if="item.isDefault" class="flex-shrink-0 rounded-full bg-[#e8f0fd] px-2 py-0.5 text-xs text-brand-blue">
                  默认
                </text>
              </view>
              <text class="mt-1 block text-xs text-[#98a2b3] leading-[1.4]">
                更新于 {{ item.uploadedAt }}
              </text>
            </view>

            <!-- 操作按钮 -->
            <view
              class="ml-2 flex-shrink-0 px-2 py-2 text-xl text-[#98a2b3] leading-none active:opacity-60"
              role="button"
              @tap="showItemActions(item)"
            >
              ···
            </view>
          </view>
        </view>
      </view>

      <!-- 数量提示 -->
      <text class="mt-3 block px-1 text-xs text-[#98a2b3]">
        最多上传 {{ MAX_RESUMES }} 份简历，已上传 {{ resumes.length }} 份
      </text>
    </view>

    <!-- 底部上传按钮（固定） -->
    <view class="fixed bottom-0 left-0 right-0 box-border border-t-1rpx border-t-[#f0f2f5] border-t-solid bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-3">
      <view
        class="min-h-88rpx flex items-center justify-center rounded-2xl text-base font-600"
        :class="resumes.length >= MAX_RESUMES || loading
          ? 'cursor-not-allowed bg-[#c8d3e8] text-white'
          : 'cursor-pointer bg-brand-blue text-white active:opacity-88'"
        role="button"
        @tap="chooseResume"
      >
        <view class="i-carbon-upload mr-2 text-lg leading-none" />
        <text>上传简历</text>
      </view>
    </view>

    <!-- 重命名弹窗 -->
    <view
      v-if="editing"
      class="fixed inset-0 z-100 flex items-end justify-center bg-black/45"
      @tap="closeEdit"
    >
      <view class="w-full rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+20rpx)] pt-6" @tap.stop>
        <text class="block text-center text-base text-[#1a2640] font-700">重命名</text>
        <view class="mt-4 overflow-hidden rounded-xl bg-[#f5f7fa]">
          <input
            v-model="editName"
            class="h-96rpx w-full px-4 text-sm text-[#1a2640]"
            :maxlength="128"
            :focus="inputFocus"
            placeholder="请输入简历名称"
            placeholder-style="color:#98a2b3"
            @blur="inputFocus = false"
          >
        </view>
        <view class="mt-4 flex gap-3">
          <view
            class="min-h-88rpx flex flex-1 cursor-pointer items-center justify-center rounded-xl bg-[#f2f4f7] text-sm text-[#6b7a8d] font-600 active:opacity-70"
            @tap="closeEdit"
          >
            取消
          </view>
          <view
            class="min-h-88rpx flex flex-1 cursor-pointer items-center justify-center rounded-xl bg-brand-blue text-sm text-white font-600 active:opacity-88"
            @tap="saveName"
          >
            保存
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
