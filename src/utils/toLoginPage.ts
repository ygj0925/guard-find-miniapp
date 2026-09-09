import { LOGIN_PAGE } from '@/router/config'
import { currRoute, getLastPage } from '@/utils'
import { debounce } from '@/utils/debounce'

interface ToLoginPageOptions {
  /**
   * 跳转模式, uni.navigateTo | uni.reLaunch
   * @default 'navigateTo'
   */
  mode?: 'navigateTo' | 'reLaunch'
  /**
   * 查询参数
   * @example '?redirect=/pages/home/index'
   */
  queryString?: string
}

export interface LoginPageNavigationResult {
  status: 'opened' | 'already-open' | 'failed'
  message?: string
}

function getRedirectQuery(queryString: string) {
  if (queryString.includes('redirect=')) {
    return queryString
  }

  const { path, query } = currRoute()
  if (!path) {
    return queryString
  }
  const queryStringFromRoute = Object.entries(query)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  const redirect = `${path}${queryStringFromRoute ? `?${queryStringFromRoute}` : ''}`
  const separator = queryString ? (queryString.startsWith('?') ? '&' : '?') : '?'
  return `${queryString}${separator}redirect=${encodeURIComponent(redirect)}`
}

function resolveLoginPageTarget(options: ToLoginPageOptions = {}) {
  const { mode = 'navigateTo', queryString = '' } = options
  const url = `${LOGIN_PAGE}${getRedirectQuery(queryString)}`
  const currentPage = getLastPage()
  const currentPath = currentPage?.route ? `/${currentPage.route}` : ''
  return { mode, url, currentPath }
}

/**
 * 用户主动操作时跳转登录页，不经过全局防抖，并返回明确的导航结果。
 */
export function navigateToLoginPage(options: ToLoginPageOptions = {}): Promise<LoginPageNavigationResult> {
  let target: ReturnType<typeof resolveLoginPageTarget>
  try {
    target = resolveLoginPageTarget(options)
  }
  catch (error) {
    return Promise.resolve({
      status: 'failed',
      message: error instanceof Error ? error.message : '无法生成登录页地址',
    })
  }

  if (target.currentPath === LOGIN_PAGE)
    return Promise.resolve({ status: 'already-open' })

  return new Promise((resolve) => {
    const success = () => resolve({ status: 'opened' } as const)
    const fail = (error: { errMsg?: string }) => resolve({
      status: 'failed',
      message: error.errMsg || '登录页打开失败',
    } as const)

    if (target.mode === 'navigateTo') {
      uni.navigateTo({ url: target.url, success, fail })
    }
    else {
      uni.reLaunch({ url: target.url, success, fail })
    }
  })
}

// 登录页由 router/config 统一维护，避免 Token 失效时跳往已删除的旧路径。

/**
 * 系统或接口触发时跳转登录页。
 *
 * 首次调用立即生效，并在 500ms 内忽略后续调用，确保用户当前操作产生的
 * redirect 不会被隐藏页面或并发请求的登录跳转覆盖。
 */
export const toLoginPage = debounce((options: ToLoginPageOptions = {}) => {
  const { mode, url, currentPath } = resolveLoginPageTarget(options)

  if (currentPath === LOGIN_PAGE)
    return

  if (mode === 'navigateTo') {
    uni.navigateTo({ url })
  }
  else {
    uni.reLaunch({ url })
  }
}, 500, { edges: ['leading'] })
