<script setup lang="ts">
import { onShow, ref } from 'vue'
import { deleteResume, getResumes, setDefaultResume, updateResume, uploadResume, type ResumeItem } from '@/api/resume'
import AppPageHeader from '@/components/AppPageHeader.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '附件简历', backgroundColor: '#f5f7fa' } })

const resumes = ref<ResumeItem[]>([])
const loading = ref(false)
const editing = ref<ResumeItem>()
const editName = ref('')

async function loadResumes() {
  loading.value = true
  try { resumes.value = await getResumes() }
  catch { resumes.value = [] }
  finally { loading.value = false }
}

function chooseResume() {
  // 微信小程序使用 chooseMessageFile，允许选择 PDF/DOC/DOCX。
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({ count: 1, type: 'file', extension: ['pdf', 'doc', 'docx'], success: async (result) => {
    const file = result.tempFiles[0]
    if (!file) return
    const name = file.name.replace(/\.[^.]+$/, '') || '我的简历'
    loading.value = true
    try { await uploadResume(name, file.path); await loadResumes(); uni.showToast({ title: '上传成功', icon: 'success' }) }
    catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '上传失败', icon: 'none' }) }
    finally { loading.value = false }
  } })
  // #endif
  // #ifndef MP-WEIXIN
  uni.chooseFile({ count: 1, type: 'file', extension: ['pdf', 'doc', 'docx'], success: async (result) => {
    const file = result.tempFiles[0]
    if (!file) return
    const name = file.name.replace(/\.[^.]+$/, '') || '我的简历'
    loading.value = true
    try { await uploadResume(name, file.path); await loadResumes(); uni.showToast({ title: '上传成功', icon: 'success' }) }
    catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '上传失败', icon: 'none' }) }
    finally { loading.value = false }
  } })
  // #endif
}

function editResume(item: ResumeItem) { editing.value = item; editName.value = item.name }

async function saveName() {
  if (!editing.value || !editName.value.trim()) return
  loading.value = true
  try { await updateResume(editing.value.id, { name: editName.value.trim() }); editing.value = undefined; await loadResumes() }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' }) }
  finally { loading.value = false }
}

function confirmDelete(item: ResumeItem) {
  uni.showModal({ title: '删除简历', content: `确定删除“${item.name}”吗？`, success: async ({ confirm }) => {
    if (!confirm) return
    loading.value = true
    try { await deleteResume(item.id); await loadResumes() }
    catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '删除失败', icon: 'none' }) }
    finally { loading.value = false }
  } })
}

async function makeDefault(item: ResumeItem) {
  if (item.isDefault) return
  loading.value = true
  try { await setDefaultResume(item.id); await loadResumes() }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '设置失败', icon: 'none' }) }
  finally { loading.value = false }
}

function previewResume(item: ResumeItem) {
  if (!item.fileUrl) return
  uni.downloadFile({ url: item.fileUrl, header: { Authorization: `Bearer ${uni.getStorageSync('auth-access-token')}` }, success: ({ statusCode, tempFilePath }) => {
    if (statusCode === 200) uni.openDocument({ filePath: tempFilePath, showMenu: true })
    else uni.showToast({ title: '简历打开失败', icon: 'none' })
  }, fail: () => uni.showToast({ title: '简历打开失败', icon: 'none' }) })
}

onShow(loadResumes)
</script>

<template>
  <view class="min-h-[var(--app-viewport-height)] bg-[#f5f7fa]">
    <AppPageHeader title="附件简历" background="#ffffff" scrolled-background="#ffffff" />
    <view class="px-4 pb-8 pt-4">
      <view class="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-4 shadow-[0_8rpx_24rpx_rgba(38,64,105,0.05)]"><view><text class="block text-base text-[#202938] font-700">我的附件简历</text><text class="mt-1 block text-xs text-[#98a2b3]">支持 PDF、DOC、DOCX 格式</text></view><button class="m-0 border-0 rounded-full bg-brand-blue px-4 text-sm text-white" :disabled="loading" @tap="chooseResume">上传简历</button></view>
      <view v-if="loading && !resumes.length" class="py-16 text-center text-sm text-[#98a2b3]">加载中...</view>
      <view v-else-if="!resumes.length" class="rounded-2xl bg-white px-4 py-16 text-center text-sm text-[#98a2b3]">暂无附件简历</view>
      <view v-else class="flex flex-col gap-3"><view v-for="item in resumes" :key="item.id" class="rounded-2xl bg-white px-4 py-4 shadow-[0_8rpx_24rpx_rgba(38,64,105,0.05)]"><view class="flex items-start justify-between"><view class="min-w-0 flex-1"><text class="block overflow-hidden text-ellipsis whitespace-nowrap text-base text-[#202938] font-700">{{ item.name }}</text><text class="mt-1 block text-xs text-[#98a2b3]">{{ item.uploadedAt }}</text></view><text v-if="item.isDefault" class="ml-3 rounded-full bg-[#e3f3ff] px-2 py-1 text-xs text-brand-blue">默认</text></view><view class="mt-4 flex items-center gap-2"><button class="m-0 flex-1 border-1rpx border-[#d9e6f8] rounded-full bg-white text-xs text-brand-blue" @tap="previewResume(item)">预览</button><button class="m-0 flex-1 border-1rpx border-[#d9e6f8] rounded-full bg-white text-xs text-brand-blue" @tap="editResume(item)">重命名</button><button class="m-0 flex-1 border-1rpx border-[#d9e6f8] rounded-full bg-white text-xs text-brand-blue" @tap="makeDefault(item)">设为默认</button><button class="m-0 flex-1 border-0 rounded-full bg-[#fff1f1] text-xs text-[#d74b3f]" @tap="confirmDelete(item)">删除</button></view></view></view>
    </view>
    <view v-if="editing" class="fixed inset-0 z-100 flex items-center justify-center bg-black/45" @tap.self="editing = undefined"><view class="w-640rpx rounded-2xl bg-white p-5"><text class="block text-lg font-700">重命名简历</text><input v-model="editName" class="mt-4 h-88rpx rounded-xl bg-[#f5f7fa] px-3" maxlength="128" /><view class="mt-5 flex gap-3"><button class="flex-1 border-0 bg-[#f2f4f7]" @tap="editing = undefined">取消</button><button class="flex-1 border-0 bg-brand-blue text-white" @tap="saveName">保存</button></view></view></view>
  </view>
</template>
