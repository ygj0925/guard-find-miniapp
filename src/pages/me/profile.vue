<script setup lang="ts">
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getUserInfo, updateUserInfo } from '@/api/login'
import { uploadPropertyImage } from '@/api/propertyImage'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationBarTitleText: '编辑资料',
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()
const nickname = ref('')
// 只使用 GET 的真实头像或上传返回值，绝不读取 store 中的默认本地头像。
const avatar = ref('')
const preview = ref('')
const failedAvatar = ref('')
const pendingImage = ref('')
const loaded = ref(false)
const loading = ref(false)
const selecting = ref(false)
const uploading = ref(false)
const saving = ref(false)
const loadError = ref('')
const uploadError = ref('')
const saveError = ref('')
const nicknameTouched = ref(false)
const busy = computed(() => loading.value || selecting.value || uploading.value || saving.value)
const nicknameError = computed(() => {
  if (!nicknameTouched.value)
    return ''
  const value = nickname.value.trim()
  if (!value)
    return '昵称不能为空'
  return value.length > 64 ? '昵称不能超过64个字符' : ''
})

let sessionToken = ''
let generation = 0
let visible = false
let disposed = false

function invalidate() {
  generation++
  loading.value = false
  selecting.value = false
  uploading.value = false
  saving.value = false
}

function clearForm() {
  loaded.value = false
  nickname.value = ''
  avatar.value = ''
  preview.value = ''
  failedAvatar.value = ''
  pendingImage.value = ''
  nicknameTouched.value = false
  loadError.value = ''
  uploadError.value = ''
  saveError.value = ''
}

// 同步失效，包含 A → B → A 的切换，不能仅在响应时比较 token。
watch(() => tokenStore.validToken, () => {
  invalidate()
  sessionToken = ''
  clearForm()
}, { flush: 'sync' })

function isCurrent(current: number, token: string) {
  return !disposed && visible && current === generation && !!token
    && token === sessionToken && token === tokenStore.updateNowTime().validToken
}

function requireSession() {
  if (disposed || !visible)
    return false
  const token = tokenStore.updateNowTime().validToken
  if (!token) {
    toLoginPage()
    return false
  }
  return token === sessionToken
}

// 页面自行展示普通错误；401 登录跳转仍由公共请求层处理。
function requestOptions(token: string) {
  return { header: { Authorization: `Bearer ${token}` }, hideErrorToast: true }
}

function handleFailure(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function validAvatar(value: string) {
  return value === '' || (value.length <= 1024 && /^https?:\/\/\S+$/.test(value))
}

async function loadProfile() {
  if (busy.value || !requireSession())
    return
  const current = generation
  const token = sessionToken
  loading.value = true
  loadError.value = ''
  try {
    const info = await getUserInfo(requestOptions(token))
    if (!isCurrent(current, token))
      return
    nickname.value = info.nickname
    avatar.value = info.avatar || ''
    preview.value = avatar.value
    failedAvatar.value = ''
    loaded.value = true
  }
  catch (error) {
    if (isCurrent(current, token))
      loadError.value = handleFailure(error, '资料加载失败，请重试')
  }
  finally {
    if (isCurrent(current, token))
      loading.value = false
  }
}

onShow(() => {
  if (disposed)
    return
  visible = true
  const token = tokenStore.updateNowTime().validToken
  if (!token) {
    invalidate()
    sessionToken = ''
    clearForm()
    toLoginPage()
    return
  }
  if (sessionToken !== token) {
    invalidate()
    clearForm()
    sessionToken = token
  }
  if (!loaded.value)
    void loadProfile()
  else if (pendingImage.value && !uploadError.value)
    uploadError.value = '头像上传已中断，请重试'
})

onHide(() => {
  visible = false
  invalidate()
})
function dispose() {
  disposed = true
  visible = false
  invalidate()
}
onUnload(dispose)
onBeforeUnmount(dispose)

function editNickname(event: { detail: { value: string } }) {
  if (!loaded.value || busy.value || !requireSession())
    return
  nickname.value = event.detail.value
  nicknameTouched.value = true
  saveError.value = ''
}

async function uploadAvatar() {
  if (busy.value || !pendingImage.value || !loaded.value || !requireSession())
    return
  const current = generation
  const token = sessionToken
  uploading.value = true
  uploadError.value = ''
  saveError.value = ''
  try {
    const url = await uploadPropertyImage(pendingImage.value)
    if (!isCurrent(current, token))
      return
    if (!url || !validAvatar(url))
      throw new Error('上传未返回有效头像地址，请重试')
    avatar.value = url
    pendingImage.value = ''
    // 继续预览用户选择的临时图片；上传成功不能提前更新 userStore。
  }
  catch (error) {
    if (isCurrent(current, token))
      uploadError.value = handleFailure(error, '头像上传失败，请重试')
  }
  finally {
    if (isCurrent(current, token))
      uploading.value = false
  }
}

function selectAvatar(path: string) {
  if (!path || busy.value || !loaded.value || !requireSession())
    return
  pendingImage.value = path
  preview.value = path
  failedAvatar.value = ''
  void uploadAvatar()
}

function chooseWechatAvatar(event: { detail: { avatarUrl: string } }) {
  selectAvatar(event.detail.avatarUrl)
}

function markAvatarFailed() {
  if (requireSession())
    failedAvatar.value = preview.value
}

function chooseAvatar() {
  if (busy.value || !loaded.value || !requireSession())
    return
  const current = generation
  const token = sessionToken
  selecting.value = true
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success(res) {
      if (!isCurrent(current, token))
        return
      selecting.value = false
      const file = res.tempFiles[0]
      if (file && typeof file !== 'string' && file.size > 5 * 1024 * 1024) {
        uploadError.value = '图片不能超过5MB，请重新选择'
        return
      }
      selectAvatar(res.tempFilePaths[0])
    },
    fail(error) {
      if (!isCurrent(current, token))
        return
      selecting.value = false
      if (!/cancel/i.test(error.errMsg || ''))
        uploadError.value = '无法选择图片，请重试'
    },
  })
}

function removeAvatar() {
  if (busy.value || !loaded.value || !requireSession())
    return
  avatar.value = ''
  preview.value = ''
  failedAvatar.value = ''
  pendingImage.value = ''
  uploadError.value = ''
  saveError.value = ''
}

async function saveProfile() {
  if (busy.value || !loaded.value || !requireSession())
    return
  nicknameTouched.value = true
  if (nicknameError.value)
    return
  if (pendingImage.value) {
    uploadError.value = '请先重试头像上传，上传成功后再保存'
    return
  }
  if (!validAvatar(avatar.value)) {
    saveError.value = '头像地址无效，请重新选择头像或移除头像'
    return
  }
  const current = generation
  const token = sessionToken
  let committed = false
  saving.value = true
  saveError.value = ''
  try {
    const info = await updateUserInfo({ nickname: nickname.value.trim(), avatar: avatar.value }, requestOptions(token))
    if (!isCurrent(current, token))
      return
    userStore.setUserInfo(info)
    committed = true
    uni.navigateBack({
      delta: 1,
      fail() {
        if (isCurrent(current, token))
          uni.switchTab({ url: '/pages/me/me' })
      },
    })
  }
  catch (error) {
    if (isCurrent(current, token))
      saveError.value = handleFailure(error, '保存失败，请重试')
  }
  finally {
    // PUT 成功后持续锁定到离页，避免导航尚未完成时再次提交。
    if (!committed && isCurrent(current, token))
      saving.value = false
  }
}
</script>

<template>
  <view class="app-page bg-app-surface text-app-ink">
    <view class="app-content pb-48rpx pt-32rpx">
      <view v-if="loading" class="app-panel p-32rpx text-app-muted" role="status">
        正在加载资料…
      </view>
      <view v-else-if="!loaded" class="app-panel p-32rpx">
        <text class="block text-28rpx text-app-ink-soft leading-40rpx" role="alert">
          {{ loadError || '请登录后重新加载资料' }}
        </text>
        <button class="app-tap mt-24rpx app-secondary-button w-full" :disabled="busy" aria-label="重试加载资料" @tap="loadProfile">
          重试加载
        </button>
      </view>

      <view v-else class="app-panel p-32rpx">
        <text class="block app-section-title">编辑资料</text>
        <view class="mt-32rpx flex flex-col items-center gap-24rpx">
          <image
            v-if="preview && preview !== failedAvatar"
            :key="preview"
            :src="preview"
            mode="aspectFill"
            class="h-160rpx w-160rpx rounded-full bg-app-soft"
            aria-label="头像预览"
            @error="markAvatarFailed"
          />
          <view v-else class="h-160rpx w-160rpx flex items-center justify-center rounded-full bg-app-soft text-brand-blue" aria-label="暂无头像">
            <view class="i-carbon-user h-80rpx w-80rpx" aria-hidden="true" />
          </view>
          <!-- #ifdef MP-WEIXIN -->
          <button
            class="app-tap app-secondary-button w-full"
            open-type="chooseAvatar"
            :disabled="busy"
            aria-label="选择微信头像"
            @chooseavatar="chooseWechatAvatar"
          >
            {{ uploading ? '头像上传中…' : '选择微信头像' }}
          </button>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <button class="app-tap app-secondary-button w-full" :disabled="busy" aria-label="选择头像" @tap="chooseAvatar">
            {{ uploading ? '头像上传中…' : '选择头像' }}
          </button>
          <!-- #endif -->
          <text class="text-24rpx text-app-muted leading-36rpx">支持 JPG、PNG 图片，大小不超过5MB</text>
          <button v-if="preview" class="app-tap app-secondary-button w-full" :disabled="busy" aria-label="移除头像" @tap="removeAvatar">
            移除头像
          </button>
        </view>
        <view v-if="uploadError" class="mt-24rpx">
          <text class="block text-28rpx text-app-danger leading-40rpx" role="alert">{{ uploadError }}</text>
          <button v-if="pendingImage" class="app-tap mt-16rpx app-secondary-button w-full" :disabled="busy" aria-label="重试头像上传" @tap="uploadAvatar">
            重试上传
          </button>
        </view>

        <view class="mt-40rpx">
          <text class="block text-30rpx font-semibold leading-44rpx">昵称</text>
          <!-- #ifdef MP-WEIXIN -->
          <input
            type="nickname"
            :value="nickname"
            :maxlength="64"
            :disabled="busy"
            class="mt-16rpx min-h-96rpx rounded-16rpx bg-app-soft px-24rpx text-32rpx text-app-ink"
            placeholder="请输入昵称"
            aria-label="昵称"
            @input="editNickname"
            @blur="editNickname"
          >
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <input
            type="text"
            :value="nickname"
            :maxlength="64"
            :disabled="busy"
            class="mt-16rpx min-h-96rpx rounded-16rpx bg-app-soft px-24rpx text-32rpx text-app-ink"
            placeholder="请输入昵称"
            aria-label="昵称"
            @input="editNickname"
            @blur="editNickname"
          >
          <!-- #endif -->
          <text v-if="nicknameError" class="mt-12rpx block text-28rpx text-app-danger leading-40rpx" role="alert">{{ nicknameError }}</text>
          <text v-else class="mt-12rpx block text-24rpx text-app-muted leading-36rpx">昵称不能为空，最多64个字符</text>
        </view>
        <text v-if="saveError" class="mt-24rpx block text-28rpx text-app-danger leading-40rpx" role="alert">{{ saveError }}</text>
        <button
          class="app-tap mt-40rpx app-primary-button w-full"
          :disabled="busy || !!pendingImage"
          :loading="saving"
          aria-label="保存资料"
          @tap="saveProfile"
        >
          {{ saving ? '保存中…' : '保存资料' }}
        </button>
      </view>
    </view>
  </view>
</template>
