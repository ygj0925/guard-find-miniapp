<script setup lang="ts">
import type { AgentFormField, AgentFormFieldType, AgentFormPositionOption, AgentFormStatus } from '@/api/agent'
import type { ResumeItem } from '@/api/resume'
import type { AiMessageExtension } from '../aiHistory'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { getPositions } from '@/api/position'
import { getResumes, uploadResume } from '@/api/resume'

const props = defineProps<{
  extension: AiMessageExtension
}>()

const emit = defineEmits<{
  submit: [values: Record<string, unknown>]
}>()

const KNOWN_FIELD_TYPES: AgentFormFieldType[] = ['input', 'textarea', 'number', 'radio', 'select', 'date', 'resume_upload', 'position_select']
const DEFAULT_RESUME_EXTENSIONS = ['pdf', 'doc', 'docx']
const DEFAULT_MAX_RESUME_SIZE_MB = 10

const title = computed(() => readString(props.extension.data.title) || '请填写')
const description = computed(() => readString(props.extension.data.description))
const fields = computed<AgentFormField[]>(() => {
  const raw = props.extension.data.fields
  return Array.isArray(raw) ? raw as AgentFormField[] : []
})
const status = computed<AgentFormStatus>(() => {
  const value = readString(props.extension.data.status)
  const known = (['ready', 'submitting', 'submitted', 'failed', 'unknown'] as const)
    .includes(value as AgentFormStatus)
  return known ? (value as AgentFormStatus) : 'unknown'
})
const errorMessage = computed(() => readString(props.extension.data.error))
const hasUnsupportedField = computed(() => fields.value.some(field => !KNOWN_FIELD_TYPES.includes(field.type)))

const stepIndex = ref(0)
const answers = reactive<Record<string, unknown>>({})
const fieldErrors = reactive<Record<string, string>>({})

const total = computed(() => fields.value.length)
const currentIndex = computed(() => Math.min(stepIndex.value, Math.max(total.value - 1, 0)))
const currentField = computed<AgentFormField | undefined>(() => fields.value[currentIndex.value])
const isLastStep = computed(() => currentIndex.value === total.value - 1)
const disabled = computed(() => status.value !== 'ready')
const progressPercent = computed(() => total.value > 0 ? Math.round(((currentIndex.value + 1) / total.value) * 100) : 0)

// 简历上传/选择字段的本地状态；resumeId 表单只有一个字段，用不到按 key 隔离。
const resumeOptions = ref<ResumeItem[]>([])
const resumeOptionsLoaded = ref(false)
const resumeListLoading = ref(false)
const resumeUploading = ref(false)
const resumeSelecting = ref(false)

// 职位选择字段的本地状态：options 初始来自建卡时的首页快照，翻页由本组件直接调用
// 已有的职位查询接口在本地追加，不经过表单提交/续接接口。
const positionOptions = ref<AgentFormPositionOption[]>([])
const positionPageNum = ref(1)
const positionHasMore = ref(false)
const positionLoadingMore = ref(false)

watch(currentField, (field) => {
  if (field?.type === 'resume_upload')
    void loadResumeOptions()
  if (field?.type === 'position_select') {
    positionOptions.value = field.positionSelect?.options ?? []
    positionPageNum.value = field.positionSelect?.pageNum ?? 1
    positionHasMore.value = field.positionSelect?.hasMore ?? false
  }
}, { immediate: true })

onMounted(() => {
  if (currentField.value?.type === 'resume_upload')
    void loadResumeOptions()
})

async function loadResumeOptions() {
  if (resumeOptionsLoaded.value || resumeListLoading.value)
    return
  resumeListLoading.value = true
  try {
    resumeOptions.value = await getResumes()
    resumeOptionsLoaded.value = true
  }
  catch {
    resumeOptions.value = []
  }
  finally {
    resumeListLoading.value = false
  }
}

async function loadMorePositions(field: AgentFormField) {
  const positionSelect = field.positionSelect
  if (!positionSelect || positionLoadingMore.value || !positionHasMore.value)
    return
  positionLoadingMore.value = true
  try {
    const nextPageNum = positionPageNum.value + 1
    const page = await getPositions({
      ...positionSelect.queryCriteria,
      pageNum: nextPageNum,
      pageSize: positionSelect.pageSize,
    })
    const appended = page.list.map(item => ({
      positionId: item.positionId,
      jobId: String(item.jobId),
      positionName: item.positionName,
      location: item.location,
      salaryText: salaryTextOf(item.salaryMin, item.salaryMax, item.salaryUnit),
    }))
    positionOptions.value = [...positionOptions.value, ...appended]
    positionPageNum.value = nextPageNum
    positionHasMore.value = nextPageNum * positionSelect.pageSize < page.total
  }
  catch {
    uni.showToast({ title: '加载更多职位失败', icon: 'none' })
  }
  finally {
    positionLoadingMore.value = false
  }
}

function salaryTextOf(min?: number, max?: number, unit?: string) {
  if (min == null && max == null)
    return unit || '面议'
  const range = min != null && max != null ? `${min}-${max}` : String(min ?? max)
  return unit ? `${range} ${unit}` : range
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function setAnswer(key: string, value: unknown) {
  answers[key] = value
  if (fieldErrors[key])
    fieldErrors[key] = ''
}

function validate(field: AgentFormField, rawValue: unknown): string {
  const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue
  const empty = value === undefined || value === null || value === ''
  if (field.required && empty)
    return field.type === 'resume_upload' ? '请选择或上传一份简历' : field.type === 'position_select' ? '请选择一个职位' : '此项为必填'
  if (empty)
    return ''
  if (field.type === 'number' && Number.isNaN(Number(value)))
    return '请输入合法数字'
  if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(value)))
    return '请填写正确的日期'
  if (field.minLength != null && String(value).length < field.minLength)
    return `不能少于 ${field.minLength} 个字符`
  if (field.maxLength != null && String(value).length > field.maxLength)
    return `不能超过 ${field.maxLength} 个字符`
  return ''
}

function goToStep(index: number) {
  stepIndex.value = Math.max(0, Math.min(index, total.value - 1))
}

function goNext() {
  const field = currentField.value
  if (!field)
    return
  const message = validate(field, answers[field.key])
  if (message) {
    fieldErrors[field.key] = message
    return
  }
  goToStep(currentIndex.value + 1)
}

function goPrev() {
  goToStep(currentIndex.value - 1)
}

function handleSubmit() {
  let firstInvalidIndex = -1
  fields.value.forEach((field, index) => {
    const message = validate(field, answers[field.key])
    fieldErrors[field.key] = message
    if (message && firstInvalidIndex < 0)
      firstInvalidIndex = index
  })
  if (firstInvalidIndex >= 0) {
    goToStep(firstInvalidIndex)
    return
  }
  emit('submit', { ...answers })
}

function selectOption(field: AgentFormField, option: string) {
  if (disabled.value)
    return
  setAnswer(field.key, option)
}

function selectResumeOption(field: AgentFormField, resume: ResumeItem) {
  if (disabled.value || resumeUploading.value)
    return
  setAnswer(field.key, resume.id)
}

function selectPositionOption(field: AgentFormField, option: AgentFormPositionOption) {
  if (disabled.value)
    return
  setAnswer(field.key, option.positionId)
}

function onDateChange(field: AgentFormField, event: { detail: { value: string } }) {
  setAnswer(field.key, event.detail.value)
}

/** 复用 src/pages/resume/index.vue 的选择方式，只是选完后直接把结果作为表单答案，不跳转页面。 */
function chooseResumeFile(field: AgentFormField) {
  if (disabled.value || resumeUploading.value || resumeSelecting.value)
    return
  const extensions = field.accept?.length ? field.accept : DEFAULT_RESUME_EXTENSIONS
  resumeSelecting.value = true
  const releaseSelecting = () => {
    resumeSelecting.value = false
  }
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: extensions,
    success: (result) => {
      releaseSelecting()
      const file = result.tempFiles[0]
      if (file)
        void uploadChosenResume(field, file.path, file.name, typeof file.size === 'number' ? file.size : undefined)
    },
    fail: releaseSelecting,
    complete: releaseSelecting,
  })
  // #endif
  // #ifndef MP-WEIXIN
  uni.chooseFile({
    count: 1,
    type: 'all',
    extension: extensions,
    success: (result) => {
      releaseSelecting()
      const files = Array.isArray(result.tempFiles) ? result.tempFiles : [result.tempFiles]
      const paths = Array.isArray(result.tempFilePaths) ? result.tempFilePaths : [result.tempFilePaths]
      const file = files[0]
      const filePath = paths[0]
        || (file && typeof file === 'object' && 'path' in file && typeof file.path === 'string' ? file.path : '')
      const originalName = file && typeof file === 'object' && 'name' in file && typeof file.name === 'string' ? file.name : ''
      const fileSize = file && typeof file === 'object' && 'size' in file && typeof file.size === 'number'
        ? file.size
        : undefined
      if (!filePath) {
        uni.showToast({ title: '无法读取所选文件，请重新选择', icon: 'none' })
        return
      }
      void uploadChosenResume(field, filePath, originalName, fileSize)
    },
    fail: releaseSelecting,
    complete: releaseSelecting,
  })
  // #endif
}

async function uploadChosenResume(field: AgentFormField, filePath: string, originalName: string, fileSize?: number) {
  const allowedExtensions = (field.accept?.length ? field.accept : DEFAULT_RESUME_EXTENSIONS).map(item => item.toLowerCase())
  const extensions = new Set(allowedExtensions)
  const maxSizeBytes = (field.maxSizeMb ?? DEFAULT_MAX_RESUME_SIZE_MB) * 1024 * 1024
  const extension = originalName.split('.').pop()?.toLowerCase() || ''
  if (originalName && !extensions.has(extension)) {
    uni.showToast({ title: `仅支持 ${allowedExtensions.join('、')} 文件`, icon: 'none' })
    return
  }
  if (typeof fileSize === 'number' && fileSize > maxSizeBytes) {
    uni.showToast({ title: `简历文件不能超过 ${field.maxSizeMb ?? DEFAULT_MAX_RESUME_SIZE_MB}MB`, icon: 'none' })
    return
  }
  const name = originalName.replace(/\.[^.]+$/, '') || '我的简历'
  resumeUploading.value = true
  try {
    const uploaded = await uploadResume(name, filePath)
    resumeOptions.value = [uploaded, ...resumeOptions.value.filter(item => item.id !== uploaded.id)]
    setAnswer(field.key, uploaded.id)
    uni.showToast({ title: '上传成功', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '上传失败', icon: 'none' })
  }
  finally {
    resumeUploading.value = false
  }
}
</script>

<template>
  <view class="form-card" :class="`form-status-${status}`">
    <view class="form-header">
      <text class="form-title">{{ title }}</text>
      <text v-if="description" class="form-description">{{ description }}</text>
    </view>

    <view v-if="hasUnsupportedField" class="form-body">
      <text class="form-hint">该卡片包含无法识别的字段，暂不支持在此填写</text>
    </view>

    <template v-else-if="status === 'ready' && currentField">
      <view v-if="total > 1" class="form-progress">
        <text class="form-step-label">第 {{ currentIndex + 1 }} / {{ total }} 步</text>
        <view class="form-progress-track">
          <view class="form-progress-bar" :style="{ width: `${progressPercent}%` }" />
        </view>
      </view>

      <view class="form-field">
        <text class="form-field-label">
          {{ currentField.label }}<text v-if="currentField.required" class="form-required">*</text>
        </text>

        <view v-if="currentField.type === 'radio' || currentField.type === 'select'" class="form-options">
          <button
            v-for="option in currentField.options || []"
            :key="option"
            class="form-option"
            :class="{ 'form-option-active': answers[currentField.key] === option }"
            :disabled="disabled"
            @tap="selectOption(currentField, option)"
          >
            {{ option }}
          </button>
        </view>

        <textarea
          v-else-if="currentField.type === 'textarea'"
          class="form-textarea"
          :value="String(answers[currentField.key] ?? '')"
          :disabled="disabled"
          :maxlength="currentField.maxLength ?? -1"
          placeholder="请输入"
          @input="(event: any) => setAnswer(currentField!.key, event.detail.value)"
        />

        <picker
          v-else-if="currentField.type === 'date'"
          mode="date"
          :value="String(answers[currentField.key] ?? '')"
          :disabled="disabled"
          @change="onDateChange(currentField, $event)"
        >
          <view class="form-picker">
            {{ answers[currentField.key] || '请选择日期' }}
          </view>
        </picker>

        <view v-else-if="currentField.type === 'resume_upload'" class="form-resume-picker">
          <view v-if="resumeListLoading" class="form-resume-loading">
            <text class="form-hint">正在加载已保存的简历…</text>
          </view>
          <view v-else-if="resumeOptions.length" class="form-resume-list">
            <view
              v-for="resume in resumeOptions"
              :key="resume.id"
              class="form-resume-item"
              :class="{ 'form-resume-item-active': answers[currentField.key] === resume.id }"
              @tap="selectResumeOption(currentField, resume)"
            >
              <text class="form-resume-name">{{ resume.name }}</text>
              <text v-if="resume.isDefault" class="form-resume-tag">默认</text>
            </view>
          </view>
          <button
            class="form-button form-button-ghost form-resume-upload-button"
            :disabled="disabled || resumeUploading || resumeSelecting"
            @tap="chooseResumeFile(currentField)"
          >
            {{ resumeUploading ? '上传中…' : '上传新简历' }}
          </button>
        </view>

        <view v-else-if="currentField.type === 'position_select'" class="form-position-picker">
          <view v-if="!positionOptions.length" class="form-hint">
            没有可选择的职位
          </view>
          <view v-else class="form-position-list">
            <view
              v-for="option in positionOptions"
              :key="option.positionId"
              class="form-position-item"
              :class="{ 'form-position-item-active': answers[currentField.key] === option.positionId }"
              @tap="selectPositionOption(currentField, option)"
            >
              <text class="form-position-name">{{ option.positionName }}</text>
              <view class="form-position-meta">
                <text v-if="option.location" class="form-position-tag">{{ option.location }}</text>
                <text v-if="option.salaryText" class="form-position-tag">{{ option.salaryText }}</text>
                <text v-if="option.matchReasoning" class="form-position-tag form-position-tag-match">
                  {{ option.matchReasoning.level }} {{ option.matchReasoning.score }}分
                </text>
              </view>
              <text v-if="option.matchReasoning?.summary" class="form-position-summary">
                {{ option.matchReasoning.summary }}
              </text>
            </view>
          </view>
          <button
            v-if="positionHasMore"
            class="form-button form-button-ghost form-position-more-button"
            :disabled="disabled || positionLoadingMore"
            @tap="loadMorePositions(currentField)"
          >
            {{ positionLoadingMore ? '加载中…' : '加载更多' }}
          </button>
        </view>

        <input
          v-else
          class="form-input"
          :type="currentField.type === 'number' ? 'number' : 'text'"
          :value="String(answers[currentField.key] ?? '')"
          :disabled="disabled"
          :maxlength="currentField.type === 'input' ? (currentField.maxLength ?? -1) : -1"
          placeholder="请输入"
          @input="(event: any) => setAnswer(currentField!.key, event.detail.value)"
        >

        <text v-if="fieldErrors[currentField.key]" class="form-error">{{ fieldErrors[currentField.key] }}</text>
      </view>

      <view class="form-actions">
        <button
          v-if="total > 1"
          class="form-button form-button-ghost"
          :disabled="disabled || currentIndex === 0"
          @tap="goPrev"
        >
          上一步
        </button>
        <button
          v-if="!isLastStep"
          class="form-button form-button-primary"
          :disabled="disabled"
          @tap="goNext"
        >
          下一步
        </button>
        <button
          v-else
          class="form-button form-button-primary"
          :disabled="disabled"
          @tap="handleSubmit"
        >
          提交
        </button>
      </view>
    </template>

    <view v-else class="form-body">
      <text v-if="status === 'submitting'" class="form-hint">提交中…</text>
      <text v-else-if="status === 'submitted'" class="form-hint form-hint-success">已提交</text>
      <text v-else-if="status === 'failed'" class="form-hint form-hint-failed">{{ errorMessage || '提交失败' }}</text>
      <text v-else class="form-hint">该表单已失效，请在新消息中重新开始</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.form-card {
  box-sizing: border-box;
  width: 100%;
  margin-top: 16rpx;
  padding: 22rpx;
  border: 1rpx solid rgba(93, 132, 216, 0.22);
  border-radius: 20rpx;
  background: #f5f8ff;
}

.form-header {
  display: flex;
  flex-direction: column;
  margin-bottom: 16rpx;
}

.form-title {
  color: #253554;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 1.4;
}

.form-description {
  margin-top: 6rpx;
  color: #71809c;
  font-size: 23rpx;
  line-height: 1.5;
}

.form-progress {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 18rpx;
}

.form-step-label {
  color: #8794aa;
  font-size: 21rpx;
}

.form-progress-track {
  height: 6rpx;
  border-radius: 4rpx;
  background: #e2e9f7;
  overflow: hidden;
}

.form-progress-bar {
  height: 100%;
  border-radius: 4rpx;
  background: #4674d3;
  transition: width 0.2s ease;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.form-field-label {
  color: #34435f;
  font-size: 25rpx;
  font-weight: 600;
}

.form-required {
  margin-left: 4rpx;
  color: #c54f42;
}

.form-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.form-option {
  box-sizing: border-box;
  min-height: 68rpx;
  margin: 0;
  padding: 0 24rpx;
  border: 1rpx solid #c9d5ec;
  border-radius: 34rpx;
  background: #fff;
  color: #34435f;
  font-size: 24rpx;
  line-height: 68rpx;
}

.form-option::after {
  border: 0;
}

.form-option-active {
  border-color: #4674d3;
  background: #4674d3;
  color: #fff;
}

.form-option[disabled] {
  opacity: 0.6;
}

.form-input,
.form-textarea,
.form-picker {
  box-sizing: border-box;
  width: 100%;
  min-height: 80rpx;
  padding: 0 20rpx;
  border: 1rpx solid #c9d5ec;
  border-radius: 14rpx;
  background: #fff;
  color: #253554;
  font-size: 25rpx;
  line-height: 80rpx;
}

.form-textarea {
  min-height: 160rpx;
  padding: 16rpx 20rpx;
  line-height: 1.5;
}

.form-error {
  color: #c54f42;
  font-size: 22rpx;
}

.form-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 22rpx;
}

.form-button {
  box-sizing: border-box;
  min-height: 84rpx;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 42rpx;
  font-size: 24rpx;
  font-weight: 600;
}

.form-button::after {
  border: 0;
}

.form-button-ghost {
  border: 1rpx solid #c9d5ec;
  background: #fff;
  color: #5a6b8c;
}

.form-button-primary {
  background: linear-gradient(105deg, #5d8ee0, #3f72d8);
  color: #fff;
}

.form-button[disabled] {
  opacity: 0.52;
}

.form-body {
  display: flex;
  align-items: center;
}

.form-hint {
  color: #71809c;
  font-size: 23rpx;
}

.form-hint-success {
  color: #39865b;
}

.form-hint-failed {
  color: #c54f42;
}

.form-status-submitted,
.form-status-unknown {
  opacity: 0.85;
}

.form-resume-picker {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.form-resume-loading {
  padding: 8rpx 0;
}

.form-resume-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.form-resume-item {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76rpx;
  padding: 0 20rpx;
  border: 1rpx solid #c9d5ec;
  border-radius: 14rpx;
  background: #fff;
}

.form-resume-item-active {
  border-color: #4674d3;
  background: rgba(70, 116, 211, 0.08);
}

.form-resume-name {
  color: #34435f;
  font-size: 25rpx;
}

.form-resume-tag {
  padding: 2rpx 12rpx;
  border-radius: 20rpx;
  background: #e2e9f7;
  color: #4674d3;
  font-size: 20rpx;
}

.form-resume-upload-button {
  flex: none;
}

.form-position-picker {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.form-position-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.form-position-item {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 16rpx 20rpx;
  border: 1rpx solid #c9d5ec;
  border-radius: 14rpx;
  background: #fff;
}

.form-position-item-active {
  border-color: #4674d3;
  background: rgba(70, 116, 211, 0.08);
}

.form-position-name {
  color: #34435f;
  font-size: 25rpx;
  font-weight: 600;
}

.form-position-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.form-position-tag {
  padding: 2rpx 12rpx;
  border-radius: 20rpx;
  background: #e2e9f7;
  color: #4674d3;
  font-size: 20rpx;
}

.form-position-tag-match {
  background: rgba(57, 134, 91, 0.12);
  color: #39865b;
  font-weight: 600;
}

.form-position-summary {
  margin-top: 4rpx;
  color: #71809c;
  font-size: 21rpx;
  line-height: 1.5;
}

.form-position-more-button {
  flex: none;
}
</style>
