<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AuthButton from './components/AuthButton.vue'
import AuthInput from './components/AuthInput.vue'
import AuthLayout from './components/AuthLayout.vue'
import { validatePassword } from './auth'

definePage({
  excludeLoginPath: true,
  style: { navigationStyle: 'custom', navigationBarTitleText: '设置密码' },
})

const form = reactive({ password: '', confirmPassword: '' })
const errors = reactive({ password: '', confirmPassword: '' })
const feedback = ref('')
const canSubmit = computed(() => !validatePassword(form.password) && form.password === form.confirmPassword)

function goBack() {
  uni.navigateBack()
}

function checkPassword() {
  errors.password = validatePassword(form.password)
}

function checkConfirmPassword() {
  errors.confirmPassword = form.confirmPassword === form.password ? '' : '两次输入的密码不一致'
}

function submit() {
  checkPassword()
  checkConfirmPassword()
  if (canSubmit.value) {
    feedback.value = '重置密码服务待接入，当前不会修改密码。'
  }
}
</script>

<template>
  <AuthLayout title="设置密码" subtitle="请输入 6-20 位新密码" @back="goBack">
    <AuthInput v-model="form.password" icon="⌑" placeholder="请输入新密码" password :maxlength="20" :error="errors.password" @blur="checkPassword" />
    <AuthInput v-model="form.confirmPassword" icon="⌑" placeholder="请再次输入新密码" password :maxlength="20" :error="errors.confirmPassword" @blur="checkConfirmPassword" />
    <AuthButton label="确认设置" :disabled="!canSubmit" @tap="submit" />
    <text v-if="feedback" class="mt-3 block text-center text-2xs text-#3b82f6 leading-[1.5]">{{ feedback }}</text>
  </AuthLayout>
</template>
