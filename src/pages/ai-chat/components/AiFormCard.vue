<script setup lang="ts">
import type { AgentFormField, AgentFormFieldType, AgentFormStatus } from '@/api/agent'
import type { AiMessageExtension } from '../aiHistory'
import { computed, reactive, ref } from 'vue'

const props = defineProps<{
  extension: AiMessageExtension
}>()

const emit = defineEmits<{
  submit: [values: Record<string, unknown>]
}>()

const KNOWN_FIELD_TYPES: AgentFormFieldType[] = ['input', 'textarea', 'number', 'radio', 'select', 'date']

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
    return '此项为必填'
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

function onDateChange(field: AgentFormField, event: { detail: { value: string } }) {
  setAnswer(field.key, event.detail.value)
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
      <view class="form-progress">
        <text class="form-step-label">第 {{ currentIndex + 1 }} / {{ total }} 题</text>
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
          class="form-button form-button-ghost"
          :disabled="disabled || currentIndex === 0"
          @tap="goPrev"
        >
          上一题
        </button>
        <button
          v-if="!isLastStep"
          class="form-button form-button-primary"
          :disabled="disabled"
          @tap="goNext"
        >
          下一题
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
</style>
