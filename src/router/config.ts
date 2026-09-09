import { getAllPages } from '@/utils'

export const LOGIN_STRATEGY_MAP = {
  DEFAULT_NO_NEED_LOGIN: 0, // 黑名单策略，默认可以进入APP
  DEFAULT_NEED_LOGIN: 1, // 白名单策略，默认不可以进入APP，需要强制登录
}
// TODO: 1/3 登录策略，默认使用`无需登录策略`，即默认不需要登录就可以访问
export const LOGIN_STRATEGY = LOGIN_STRATEGY_MAP.DEFAULT_NO_NEED_LOGIN
export const isNeedLoginMode = LOGIN_STRATEGY === LOGIN_STRATEGY_MAP.DEFAULT_NEED_LOGIN

export const LOGIN_PAGE = '/pages/auth/login'
export const WECHAT_OAUTH_CALLBACK_PAGE = '/pages/auth/wechat-callback'
export const REGISTER_PAGE = '/pages/auth/register'
export const BIND_PHONE_PAGE = '/pages/auth/bind-phone'
export const RESET_PASSWORD_PAGE = '/pages/auth/reset-password'
export const SET_PASSWORD_PAGE = '/pages/auth/set-password'
export const AGREEMENT_PAGE = '/pages/auth/agreement'
export const PRIVACY_PAGE = '/pages/auth/privacy'

export const LOGIN_PAGE_LIST = [
  LOGIN_PAGE,
  WECHAT_OAUTH_CALLBACK_PAGE,
  REGISTER_PAGE,
  BIND_PHONE_PAGE,
  RESET_PASSWORD_PAGE,
  SET_PASSWORD_PAGE,
  AGREEMENT_PAGE,
  PRIVACY_PAGE,
]

// 在 definePage 里面配置了 excludeLoginPath 的页面，功能与 EXCLUDE_LOGIN_PATH_LIST 相同
export const excludeLoginPathList = getAllPages('excludeLoginPath').map(page => page.path)

// 排除在外的列表，白名单策略指白名单列表，黑名单策略指黑名单列表
// TODO: 2/3 在 definePage 配置 excludeLoginPath，或者在下面配置 EXCLUDE_LOGIN_PATH_LIST
export const EXCLUDE_LOGIN_PATH_LIST = [
  '/pages/xxx/index', // 示例值
  '/pages-sub/xxx/index', // 示例值
  ...excludeLoginPathList, // 都是以 / 开头的 path
]

// 小程序使用统一认证页；微信授权入口会在页面内根据平台安全分流
export const LOGIN_PAGE_ENABLE_IN_MP = true
