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

// 登录页由 router/config 统一维护，避免 Token 失效时跳往已删除的旧路径。

/**
 * 跳转到登录页。
 *
 * 首次调用立即生效，并在 500ms 内忽略后续调用，确保用户当前操作产生的
 * redirect 不会被隐藏页面或并发请求的登录跳转覆盖。
 */
export const toLoginPage = debounce((options: ToLoginPageOptions = {}) => {
  const { mode = 'navigateTo', queryString = '' } = options

  const url = `${LOGIN_PAGE}${getRedirectQuery(queryString)}`

  // 获取当前页面路径
  const currentPage = getLastPage()
  const currentPath = `/${currentPage.route}`
  // 如果已经在登录页，则不跳转
  if (currentPath === LOGIN_PAGE) {
    return
  }

  if (mode === 'navigateTo') {
    uni.navigateTo({ url })
  }
  else {
    uni.reLaunch({ url })
  }
}, 500, { edges: ['leading'] })
