import type {
  ILoginForm,
} from '@/api/login'
import type { IAuthLoginRes } from '@/api/types/login'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue' // 修复：导入 computed
import {
  login as _login,
  logout as _logout,
  refreshToken as _refreshToken,
} from '@/api/login'
import { isDoubleTokenRes, isSingleTokenRes } from '@/api/types/login'
import { useUserStore } from './user'

/**
 * 是否是双token模式
 */
export const isDoubleTokenMode = import.meta.env.VITE_AUTH_MODE === 'double'
export const AUTH_TOKEN_STORAGE_KEY = 'auth-access-token'
const AUTH_SESSION_LOCK_NAME = 'sss-recruitment-auth-session'
const UNSUPPORTED_SECURE_WECHAT_LOGIN_MESSAGE = '当前浏览器不支持安全微信登录，请升级浏览器或使用手机号登录'

interface AuthSessionLockManager {
  request: <T>(
    name: string,
    options: { mode: 'exclusive' },
    operation: () => Promise<T> | T,
  ) => Promise<T>
}

interface NavigatorWithAuthSessionLocks {
  locks?: AuthSessionLockManager
}

// 初始化状态
const tokenInfoState = isDoubleTokenMode
  ? {
      accessToken: '',
      accessExpiresIn: 0,
      refreshToken: '',
      refreshExpiresIn: 0,
    }
  : {
      token: '',
      expiresIn: 0,
    }

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
let authSessionOperationDepth = 0

function getAuthSessionLockManager(): AuthSessionLockManager | undefined {
  // #ifdef H5
  if (typeof navigator !== 'undefined') {
    const lockManager = (navigator as unknown as NavigatorWithAuthSessionLocks).locks
    if (typeof lockManager?.request === 'function')
      return lockManager
  }
  // #endif
  return undefined
}

export function isCrossContextAuthLockSupported() {
  let supported = false
  // #ifdef H5
  supported = getAuthSessionLockManager() !== undefined
  // #endif
  return supported
}

export function isAuthSessionOperationActive() {
  return authSessionOperationDepth > 0
}

async function runAuthSessionOperation<T>(operation: () => Promise<T> | T): Promise<T> {
  authSessionOperationDepth += 1
  try {
    return await operation()
  }
  finally {
    authSessionOperationDepth -= 1
  }
}

async function withProcessAuthSessionLock<T>(operation: () => Promise<T> | T): Promise<T> {
  const previousLock = authSessionLockQueue
  let releaseLock: () => void = () => undefined
  authSessionLockQueue = new Promise<void>((resolve) => {
    releaseLock = resolve
  })

  await previousLock
  try {
    return await operation()
  }
  finally {
    releaseLock()
  }
}

export function withAuthSessionLock<T>(
  operation: () => Promise<T> | T,
  requireCrossContextLock = false,
): Promise<T> {
  return withProcessAuthSessionLock(async () => {
    const lockManager = getAuthSessionLockManager()
    if (lockManager) {
      return lockManager.request(
        AUTH_SESSION_LOCK_NAME,
        { mode: 'exclusive' },
        () => runAuthSessionOperation(operation),
      )
    }

    // #ifdef H5
    if (requireCrossContextLock)
      throw new Error(UNSUPPORTED_SECURE_WECHAT_LOGIN_MESSAGE)
    // #endif

    return runAuthSessionOperation(operation)
  })
}

function readAccessToken(value: IAuthLoginRes) {
  if (isSingleTokenRes(value))
    return normalizeAccessToken(value.token)
  if (isDoubleTokenRes(value))
    return normalizeAccessToken(value.accessToken)
  return ''
}

export const useTokenStore = defineStore(
  'token',
  () => {
    // 定义用户信息
    const tokenInfo = ref<IAuthLoginRes>({ ...tokenInfoState })

    // 登录尝试标识仅约束当前运行中的异步任务，不参与持久化。
    let loginAttemptSequence = 0
    let activeLoginAttemptId = 0
    let tokenOwnerAttemptId: number | null = null
    let tokenOwnerAccessToken: string | null = null

    function releaseTokenOwner() {
      tokenOwnerAttemptId = null
      tokenOwnerAccessToken = null
    }

    // 添加一个时间戳 ref 作为响应式依赖
    const nowTime = ref(Date.now())
    /**
     * 更新响应式数据:now
     * 确保isTokenExpired/isRefreshTokenExpired重新计算,而不是用错误过期缓存值
     * 可useTokenStore内部适时调用;也可链式调用:tokenStore.updateNowTime().hasLogin
     * @returns 最新的tokenStore实例
     */
    const updateNowTime = () => {
      nowTime.value = Date.now()
      return useTokenStore()
    }

    function scheduleOwnedLoginStateCleanup(attemptId: number) {
      if (tokenOwnerAttemptId !== attemptId)
        return false

      const installedAccessToken = tokenOwnerAccessToken
      releaseTokenOwner()
      if (installedAccessToken === null)
        return false

      void withAuthSessionLock(() => {
        if (
          tokenOwnerAttemptId !== null
          || readAccessToken(tokenInfo.value) !== installedAccessToken
          || readPersistedAccessToken() !== installedAccessToken
        ) {
          return false
        }

        return clearLoginStateUnlocked(installedAccessToken)
      }).catch((error) => {
        console.error('清理未完成登录状态失败:', error)
      })
      return true
    }

    function beginLoginAttempt() {
      const previousOwnerAttemptId = tokenOwnerAttemptId
      const attemptId = ++loginAttemptSequence
      activeLoginAttemptId = attemptId

      // 旧尝试安装的临时 token 只能排队到会话锁内按实际 token 清理。
      if (previousOwnerAttemptId !== null)
        scheduleOwnedLoginStateCleanup(previousOwnerAttemptId)
      return attemptId
    }

    function cancelLoginAttempt(attemptId: number) {
      if (activeLoginAttemptId !== attemptId)
        return false

      activeLoginAttemptId = ++loginAttemptSequence
      if (tokenOwnerAttemptId === attemptId)
        scheduleOwnedLoginStateCleanup(attemptId)
      return true
    }

    // 设置用户信息。先完整持久化，再发布响应式状态，避免写入失败时出现新旧账号混合态。
    const setTokenInfo = (val: IAuthLoginRes, ownerAttemptId?: number) => {
      if (ownerAttemptId !== undefined && ownerAttemptId !== activeLoginAttemptId)
        return false

      const nextAccessToken = readAccessToken(val)
      const now = Date.now()
      try {
        if (isSingleTokenRes(val)) {
          uni.setStorageSync(AUTH_TOKEN_STORAGE_KEY, val.token)
          // 单token模式
          if (typeof val.expiresIn === 'number' && val.expiresIn > 0) {
            uni.setStorageSync('accessTokenExpireTime', now + val.expiresIn * 1000)
          }
          else {
            uni.removeStorageSync('accessTokenExpireTime')
          }
        }
        else if (isDoubleTokenRes(val)) {
          uni.setStorageSync(AUTH_TOKEN_STORAGE_KEY, val.accessToken)
          // 双token模式
          const accessExpireTime = now + val.accessExpiresIn * 1000
          const refreshExpireTime = now + val.refreshExpiresIn * 1000
          uni.setStorageSync('accessTokenExpireTime', accessExpireTime)
          uni.setStorageSync('refreshTokenExpireTime', refreshExpireTime)
        }

        tokenInfo.value = val
        tokenOwnerAttemptId = ownerAttemptId ?? null
        tokenOwnerAccessToken = ownerAttemptId === undefined ? null : nextAccessToken
        updateNowTime()
        return true
      }
      catch (error) {
        if (readPersistedAccessToken() === nextAccessToken)
          resetLoginStateUnlocked()
        releaseTokenOwner()
        throw error
      }
    }

    /**
     * 判断token是否过期
     */
    const isTokenExpired = computed(() => {
      if (!tokenInfo.value) {
        return true
      }

      if (!isDoubleTokenMode && (!isSingleTokenRes(tokenInfo.value) || !tokenInfo.value.token)) {
        return true
      }
      if (isDoubleTokenMode && (!isDoubleTokenRes(tokenInfo.value) || !tokenInfo.value.accessToken)) {
        return true
      }

      if (!isDoubleTokenMode && isSingleTokenRes(tokenInfo.value) && !tokenInfo.value.expiresIn) {
        return false
      }

      const now = nowTime.value
      const expireTime = uni.getStorageSync('accessTokenExpireTime')

      if (!expireTime)
        return true
      return now >= expireTime
    })

    /**
     * 判断refreshToken是否过期
     */
    const isRefreshTokenExpired = computed(() => {
      if (!isDoubleTokenMode)
        return true

      const now = nowTime.value
      const refreshExpireTime = uni.getStorageSync('refreshTokenExpireTime')

      if (!refreshExpireTime)
        return true
      return now >= refreshExpireTime
    })

    /**
     * 登录成功后处理逻辑
     * @param nextTokenInfo 登录返回的token信息
     * @param attemptId 发起登录网络请求前创建的尝试标识
     * @param beforeCommit token 写入前执行的同步校验
     */
    async function _postLogin(
      nextTokenInfo: IAuthLoginRes,
      attemptId: number,
      beforeCommit?: () => void,
    ) {
      return withAuthSessionLock(async () => {
        if (attemptId !== activeLoginAttemptId)
          return false

        const expectedAccessToken = readAccessToken(nextTokenInfo)
        const userStore = useUserStore()
        try {
          beforeCommit?.()
          if (!setTokenInfo(nextTokenInfo, attemptId))
            return false
          if (readPersistedAccessToken() !== expectedAccessToken)
            return false

          // 新 token 生效后先移除旧账号资料；待资料请求成功且所有权仍有效时再一次性提交。
          userStore.clearUserInfo()
          const userInfo = await userStore.fetchUserInfo({ commit: false })
          if (
            attemptId !== activeLoginAttemptId
            || tokenOwnerAttemptId !== attemptId
            || readAccessToken(tokenInfo.value) !== expectedAccessToken
            || readPersistedAccessToken() !== expectedAccessToken
          ) {
            return false
          }

          userStore.setUserInfo(userInfo)
          releaseTokenOwner()
          return true
        }
        catch (error) {
          clearLoginStateForAttemptUnlocked(attemptId, expectedAccessToken)
          throw error
        }
      }, beforeCommit !== undefined)
    }

    /**
     * 用户登录
     * 有的时候后端会用一个接口返回token和用户信息，有的时候会分开2个接口，一个获取token，一个获取用户信息
     * （各有利弊，看业务场景和系统复杂度），这里使用2个接口返回的来模拟
     * @param loginForm 登录参数
     * @returns 登录结果
     */
    const login = async (loginForm: ILoginForm) => {
      const attemptId = beginLoginAttempt()
      try {
        const res = await _login(loginForm)
        console.log('普通登录-res: ', res)
        const committed = await _postLogin(res, attemptId)
        if (committed) {
          uni.showToast({
            title: '登录成功',
            icon: 'success',
          })
        }
        return res
      }
      catch (error) {
        console.error('登录失败:', error)
        uni.showToast({
          title: '登录失败，请重试',
          icon: 'error',
        })
        throw error
      }
      finally {
        cancelLoginAttempt(attemptId)
        updateNowTime()
      }
    }

    /**
     * Completes a successful external provider login after that provider has
     * returned a verified token response. Mock provider results never call this.
     */
    const completeExternalLogin = async (
      nextTokenInfo: IAuthLoginRes,
      attemptId = beginLoginAttempt(),
      beforeCommit?: () => void,
    ) => {
      try {
        const committed = await _postLogin(nextTokenInfo, attemptId, beforeCommit)
        if (committed) {
          uni.showToast({
            title: '登录成功',
            icon: 'success',
          })
        }
        return committed
      }
      finally {
        cancelLoginAttempt(attemptId)
        updateNowTime()
      }
    }

    function resetLoginStateUnlocked() {
      let cleared = true
      try {
        tokenInfo.value = { ...tokenInfoState }
        updateNowTime()
      }
      catch (error) {
        cleared = false
        console.error('清理内存登录状态失败:', error)
      }

      for (const storageKey of [
        'accessTokenExpireTime',
        'refreshTokenExpireTime',
        'token',
        AUTH_TOKEN_STORAGE_KEY,
      ]) {
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

    function canClearLoginStateUnlocked(expectedAccessToken: string) {
      const currentAccessToken = readAccessToken(tokenInfo.value)
      const persistedAccessToken = readPersistedAccessToken()
      return persistedAccessToken !== undefined
        && currentAccessToken === expectedAccessToken
        && persistedAccessToken === expectedAccessToken
    }

    function clearLoginStateUnlocked(expectedAccessToken?: string) {
      const normalizedExpectedAccessToken = expectedAccessToken === undefined
        ? undefined
        : normalizeAccessToken(expectedAccessToken)
      if (
        normalizedExpectedAccessToken !== undefined
        && !canClearLoginStateUnlocked(normalizedExpectedAccessToken)
      ) {
        return false
      }

      if (normalizedExpectedAccessToken === undefined)
        activeLoginAttemptId = ++loginAttemptSequence
      releaseTokenOwner()
      return resetLoginStateUnlocked()
    }

    function clearLoginStateForAttemptUnlocked(attemptId: number, expectedAccessToken: string) {
      const normalizedExpectedAccessToken = normalizeAccessToken(expectedAccessToken)
      if (
        tokenOwnerAttemptId !== attemptId
        || tokenOwnerAccessToken !== normalizedExpectedAccessToken
      ) {
        return false
      }

      if (activeLoginAttemptId === attemptId)
        activeLoginAttemptId = ++loginAttemptSequence
      const cleared = clearLoginStateUnlocked(normalizedExpectedAccessToken)
      if (!cleared)
        releaseTokenOwner()
      return cleared
    }

    /**
     * 退出登录并删除用户信息。
     * 指定 expectedAccessToken 时，仅允许使用该 token 的请求清理自身。
     */
    function clearLoginState(expectedAccessToken?: string): Promise<boolean> {
      return withAuthSessionLock(
        () => clearLoginStateUnlocked(expectedAccessToken),
      )
    }

    const logout = async (): Promise<boolean> => {
      let logoutRequest: ReturnType<typeof _logout> | undefined
      let logoutRequestError: unknown
      let localStateCleared = false

      await withAuthSessionLock(() => {
        // 显式退出以锁内读取到的共享 token 为权威，不能复用迟到 401 的 expected-token 条件清理。
        const persistedAccessToken = readPersistedAccessToken()
        activeLoginAttemptId = ++loginAttemptSequence
        releaseTokenOwner()

        // 共享 token 为空表示其他标签已退出；读取失败时也不能回退使用陈旧的内存 token。
        if (persistedAccessToken) {
          try {
            // 必须在删除共享 token 前同步创建请求，确保请求拦截器仍能读取当前 token。
            logoutRequest = _logout()
          }
          catch (error) {
            logoutRequestError = error
          }
        }

        const resetSucceeded = resetLoginStateUnlocked()
        localStateCleared = persistedAccessToken !== undefined && resetSucceeded
      })

      if (logoutRequestError)
        console.error('服务端退出登录失败，本地登录态已清理:', logoutRequestError)

      if (logoutRequest) {
        try {
          await logoutRequest
        }
        catch (error) {
          // 服务端退出失败不应阻止用户在当前设备退出。
          console.error('服务端退出登录失败，本地登录态已清理:', error)
        }
      }

      if (!localStateCleared)
        throw new Error('本地登录状态清理失败')
      return true
    }

    /**
     * 刷新token
     * @returns 刷新结果
     */
    const refreshToken = async () => {
      if (!isDoubleTokenMode) {
        console.error('单token模式不支持刷新token')
        throw new Error('单token模式不支持刷新token')
      }

      try {
        // 安全检查，确保refreshToken存在
        if (!isDoubleTokenRes(tokenInfo.value) || !tokenInfo.value.refreshToken) {
          throw new Error('无效的refreshToken')
        }

        const expectedAccessToken = readAccessToken(tokenInfo.value)
        const expectedOwnerAttemptId = tokenOwnerAttemptId
        const expectedPersistedAccessToken = readPersistedAccessToken()
        if (
          expectedPersistedAccessToken === undefined
          || expectedPersistedAccessToken !== expectedAccessToken
        ) {
          throw new Error('登录状态已更新，忽略过期的刷新结果')
        }

        const refreshToken = tokenInfo.value.refreshToken
        const res = await _refreshToken(refreshToken)
        await withAuthSessionLock(() => {
          if (
            readAccessToken(tokenInfo.value) !== expectedAccessToken
            || tokenOwnerAttemptId !== expectedOwnerAttemptId
            || readPersistedAccessToken() !== expectedPersistedAccessToken
          ) {
            throw new Error('登录状态已更新，忽略过期的刷新结果')
          }

          console.log('刷新token-res: ', res)
          const installed = setTokenInfo(res, expectedOwnerAttemptId ?? undefined)
          if (!installed)
            throw new Error('登录状态已更新，忽略过期的刷新结果')
        })
        return res
      }
      catch (error) {
        console.error('刷新token失败:', error)
        throw error
      }
      finally {
        updateNowTime()
      }
    }

    /**
     * 获取有效的token
     * 注意：在computed中不直接调用异步函数，只做状态判断
     * 实际的刷新操作应由调用方处理
     * 建议这样使用 tokenStore.updateNowTime().validToken
     */
    const getValidToken = computed(() => {
      // token已过期，返回空
      if (isTokenExpired.value) {
        return ''
      }

      if (!isDoubleTokenMode) {
        return isSingleTokenRes(tokenInfo.value) ? tokenInfo.value.token : ''
      }
      else {
        return isDoubleTokenRes(tokenInfo.value) ? tokenInfo.value.accessToken : ''
      }
    })

    /**
     * 检查是否有登录信息（不考虑token是否过期）
     */
    const hasLoginInfo = computed(() => {
      if (!tokenInfo.value) {
        return false
      }
      if (isDoubleTokenMode) {
        return isDoubleTokenRes(tokenInfo.value) && !!tokenInfo.value.accessToken
      }
      else {
        return isSingleTokenRes(tokenInfo.value) && !!tokenInfo.value.token
      }
    })

    /**
     * 检查是否已登录且token有效
     * 建议这样使用tokenStore.updateNowTime().hasLogin
     */
    const hasValidLogin = computed(() => {
      console.log('hasValidLogin', hasLoginInfo.value, !isTokenExpired.value)
      return hasLoginInfo.value && !isTokenExpired.value
    })

    /**
     * 尝试获取有效的token，如果过期且可刷新，则刷新token
     * @returns 有效的token或空字符串
     */
    const tryGetValidToken = async (): Promise<string> => {
      updateNowTime()
      if (!getValidToken.value && isDoubleTokenMode && !isRefreshTokenExpired.value) {
        try {
          await refreshToken()
          return getValidToken.value
        }
        catch (error) {
          console.error('尝试刷新token失败:', error)
          return ''
        }
      }
      return getValidToken.value
    }

    return {
      // 核心API方法
      login,
      beginLoginAttempt,
      cancelLoginAttempt,
      completeExternalLogin,
      logout,
      clearLoginState,

      // 认证状态判断（最常用的）
      hasLogin: hasValidLogin,

      // 内部系统使用的方法
      refreshToken,
      tryGetValidToken,
      validToken: getValidToken,

      // 调试或特殊场景可能需要直接访问的信息
      tokenInfo,
      setTokenInfo,
      updateNowTime,
    }
  },
  {
    // 添加持久化配置，确保刷新页面后token信息不丢失
    persist: true,
  },
)
