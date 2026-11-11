import type { IAuthLoginRes } from '@/api/types/login'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useUserStore } from './user'

export const AUTH_TOKEN_STORAGE_KEY = 'auth-access-token'
const ACCESS_TOKEN_EXPIRE_KEY = 'accessTokenExpireTime'
const AUTH_SESSION_LOCK_NAME = 'guard-find-miniapp-auth-session'

interface AuthSessionLockManager {
  request: <T>(
    name: string,
    options: { mode: 'exclusive' },
    operation: () => Promise<T> | T,
  ) => Promise<T>
}

const emptyTokenInfo: IAuthLoginRes = { token: '', expiresIn: 0 }

function normalizeAccessToken(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/^Bearer\s+/i, '').trim() : ''
}

export function readPersistedAccessToken(): string | undefined {
  try {
    const persistedAccessToken = uni.getStorageSync(AUTH_TOKEN_STORAGE_KEY)
    if (persistedAccessToken === undefined || persistedAccessToken === null || persistedAccessToken === '')
      return ''
    if (typeof persistedAccessToken !== 'string')
      return undefined
    return normalizeAccessToken(persistedAccessToken)
  }
  catch {
    return undefined
  }
}

let authSessionLockQueue: Promise<void> = Promise.resolve()

function getAuthSessionLockManager(): AuthSessionLockManager | undefined {
  // #ifdef H5
  if (typeof navigator !== 'undefined') {
    const lockManager = (navigator as unknown as { locks?: AuthSessionLockManager }).locks
    if (typeof lockManager?.request === 'function')
      return lockManager
  }
  // #endif
  return undefined
}

function withAuthSessionLock<T>(operation: () => Promise<T> | T): Promise<T> {
  const previousLock = authSessionLockQueue
  let releaseLock: () => void = () => undefined
  authSessionLockQueue = new Promise<void>((resolve) => {
    releaseLock = resolve
  })

  return previousLock.then(async () => {
    try {
      const lockManager = getAuthSessionLockManager()
      return lockManager
        ? await lockManager.request(AUTH_SESSION_LOCK_NAME, { mode: 'exclusive' }, operation)
        : await operation()
    }
    finally {
      releaseLock()
    }
  })
}

export const useTokenStore = defineStore(
  'token',
  () => {
    const tokenInfo = ref<IAuthLoginRes>({ ...emptyTokenInfo })

    // 过期判断依赖当前时间，调用方用 updateNowTime() 刷新后再读 hasLogin/validToken
    const nowTime = ref(Date.now())
    const updateNowTime = () => {
      nowTime.value = Date.now()
      return useTokenStore()
    }

    function resetLoginStateUnlocked() {
      let cleared = true
      try {
        tokenInfo.value = { ...emptyTokenInfo }
        updateNowTime()
      }
      catch (error) {
        cleared = false
        console.error('清理内存登录状态失败:', error)
      }

      for (const storageKey of [ACCESS_TOKEN_EXPIRE_KEY, AUTH_TOKEN_STORAGE_KEY]) {
        try {
          uni.removeStorageSync(storageKey)
        }
        catch (error) {
          cleared = false
          console.error(`清理认证缓存失败: ${storageKey}`, error)
        }
      }

      try {
        useUserStore().clearUserInfo()
      }
      catch (error) {
        cleared = false
        console.error('清理用户信息失败:', error)
      }
      return cleared
    }

    // 先完整持久化，再发布响应式状态，避免写入失败时出现新旧账号混合态。
    const setTokenInfo = (val: IAuthLoginRes) => {
      const nextAccessToken = normalizeAccessToken(val.token)
      try {
        uni.setStorageSync(AUTH_TOKEN_STORAGE_KEY, val.token)
        if (typeof val.expiresIn === 'number' && val.expiresIn > 0)
          uni.setStorageSync(ACCESS_TOKEN_EXPIRE_KEY, Date.now() + val.expiresIn * 1000)
        else
          uni.removeStorageSync(ACCESS_TOKEN_EXPIRE_KEY)

        tokenInfo.value = val
        updateNowTime()
      }
      catch (error) {
        if (readPersistedAccessToken() === nextAccessToken)
          resetLoginStateUnlocked()
        throw error
      }
    }

    const validToken = computed(() => {
      const token = normalizeAccessToken(tokenInfo.value?.token)
      if (!token)
        return ''
      if (!tokenInfo.value.expiresIn)
        return token
      const expireTime = uni.getStorageSync(ACCESS_TOKEN_EXPIRE_KEY)
      return expireTime && nowTime.value < expireTime ? token : ''
    })

    const hasLogin = computed(() => !!validToken.value)

    function clearLoginStateUnlocked(expectedAccessToken?: string) {
      if (expectedAccessToken !== undefined) {
        const expected = normalizeAccessToken(expectedAccessToken)
        const persisted = readPersistedAccessToken()
        if (persisted === undefined || persisted !== expected || normalizeAccessToken(tokenInfo.value?.token) !== expected)
          return false
      }
      return resetLoginStateUnlocked()
    }

    /**
     * 清理登录态并删除用户信息。
     * 指定 expectedAccessToken 时，仅当它仍是当前 token 才清理，避免迟到的 401 退出新账号。
     */
    function clearLoginState(expectedAccessToken?: string): Promise<boolean> {
      return withAuthSessionLock(() => clearLoginStateUnlocked(expectedAccessToken))
    }

    return {
      clearLoginState,
      hasLogin,
      validToken,
      tokenInfo,
      setTokenInfo,
      updateNowTime,
    }
  },
  {
    persist: true,
  },
)
