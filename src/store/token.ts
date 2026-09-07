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
  return typeof value === 'string' ? value.replace(/^Bearer\s+/i, '').trim() : ''
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

    function beginLoginAttempt() {
      const attemptId = ++loginAttemptSequence
      activeLoginAttemptId = attemptId

      // 新尝试开始时只移除尚未完成资料提交的临时登录，不影响已完成的会话。
      if (tokenOwnerAttemptId !== null) {
        tokenOwnerAttemptId = null
        resetLoginState()
      }
      return attemptId
    }

    function cancelLoginAttempt(attemptId: number) {
      if (activeLoginAttemptId !== attemptId)
        return false

      activeLoginAttemptId = ++loginAttemptSequence
      if (tokenOwnerAttemptId === attemptId) {
        tokenOwnerAttemptId = null
        resetLoginState()
      }
      return true
    }

    // 设置用户信息。先完整持久化，再发布响应式状态，避免写入失败时出现新旧账号混合态。
    const setTokenInfo = (val: IAuthLoginRes, ownerAttemptId?: number) => {
      if (ownerAttemptId !== undefined && ownerAttemptId !== activeLoginAttemptId)
        return false

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
        updateNowTime()
        return true
      }
      catch (error) {
        tokenOwnerAttemptId = null
        resetLoginState()
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
     */
    async function _postLogin(nextTokenInfo: IAuthLoginRes, attemptId: number) {
      if (attemptId !== activeLoginAttemptId)
        return false

      const expectedAccessToken = readAccessToken(nextTokenInfo)
      const userStore = useUserStore()
      try {
        if (!setTokenInfo(nextTokenInfo, attemptId))
          return false

        // 新 token 生效后先移除旧账号资料；待资料请求成功且所有权仍有效时再一次性提交。
        userStore.clearUserInfo()
        const userInfo = await userStore.fetchUserInfo({ commit: false })
        if (
          attemptId !== activeLoginAttemptId
          || tokenOwnerAttemptId !== attemptId
          || readAccessToken(tokenInfo.value) !== expectedAccessToken
        ) {
          return false
        }

        userStore.setUserInfo(userInfo)
        tokenOwnerAttemptId = null
        return true
      }
      catch (error) {
        clearLoginStateForAttempt(attemptId, expectedAccessToken)
        throw error
      }
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
    const completeExternalLogin = async (nextTokenInfo: IAuthLoginRes, attemptId = beginLoginAttempt()) => {
      try {
        const committed = await _postLogin(nextTokenInfo, attemptId)
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

    function resetLoginState() {
      tokenInfo.value = { ...tokenInfoState }
      updateNowTime()

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
          console.error(`清理认证缓存失败: ${storageKey}`, error)
        }
      }

      try {
        useUserStore().clearUserInfo()
      }
      catch (error) {
        console.error('清理用户信息失败:', error)
      }
    }

    function clearLoginStateForAttempt(attemptId: number, expectedAccessToken: string) {
      if (
        tokenOwnerAttemptId !== attemptId
        || readAccessToken(tokenInfo.value) !== expectedAccessToken
      ) {
        return false
      }

      tokenOwnerAttemptId = null
      if (activeLoginAttemptId === attemptId)
        activeLoginAttemptId = ++loginAttemptSequence
      resetLoginState()
      return true
    }

    /**
     * 退出登录并删除用户信息。
     * 指定 expectedAccessToken 时，仅允许使用该 token 的请求清理自身。
     */
    function clearLoginState(expectedAccessToken?: string) {
      if (
        expectedAccessToken !== undefined
        && readAccessToken(tokenInfo.value) !== normalizeAccessToken(expectedAccessToken)
      ) {
        return false
      }

      if (expectedAccessToken === undefined)
        activeLoginAttemptId = ++loginAttemptSequence
      tokenOwnerAttemptId = null
      resetLoginState()
      return true
    }

    const logout = async () => {
      // 先发起带当前 token 的服务端退出请求，再立即清理本地登录态。
      const logoutRequest = _logout()
      clearLoginState()
      try {
        await logoutRequest
      }
      catch (error) {
        // 服务端退出失败不应阻止用户在当前设备退出。
        console.error('服务端退出登录失败，本地登录态已清理:', error)
      }
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
        const refreshToken = tokenInfo.value.refreshToken
        const res = await _refreshToken(refreshToken)
        if (
          readAccessToken(tokenInfo.value) !== expectedAccessToken
          || tokenOwnerAttemptId !== expectedOwnerAttemptId
        ) {
          throw new Error('登录状态已更新，忽略过期的刷新结果')
        }

        console.log('刷新token-res: ', res)
        const installed = setTokenInfo(res, expectedOwnerAttemptId ?? undefined)
        if (!installed)
          throw new Error('登录状态已更新，忽略过期的刷新结果')
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
