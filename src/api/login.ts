/**
 * 登录与用户接口(guard-find-backend /miniapp/auth)。
 * 仅支持微信小程序一键登录:wx.login 的 code 换 token。
 */
import type { IAuthLoginRes, IUserInfoRes } from './types/login'
import { http } from '@/http/http'

/** 微信小程序一键登录(authType=WECHAT,未注册自动建档) */
export function wechatMiniappLogin(code: string) {
  return http.post<IAuthLoginRes>(
    '/miniapp/auth/login',
    { authType: 'WECHAT', code },
    undefined,
    undefined,
    { skipAuth: true, hideErrorToast: true },
  )
}

/** 当前登录用户信息 */
export function getUserInfo() {
  return http.get<IUserInfoRes>('/miniapp/auth/me')
}

/** 账号密码登录(保留 token store 兼容;小程序主流程不走此接口) */
export interface ILoginForm {
  username: string
  password: string
}

export function login(form: ILoginForm) {
  return http.post<IAuthLoginRes>(
    '/miniapp/auth/login',
    { authType: 'ACCOUNT', ...form },
    undefined,
    undefined,
    { skipAuth: true, hideErrorToast: true },
  )
}

/** 服务端为单 token 模式,无刷新接口(仅为 token store 类型兼容保留) */
export function refreshToken(_refreshToken?: string) {
  return Promise.reject(new Error('单 token 模式不支持刷新'))
}

/** 退出登录 */
export function logout() {
  return http.post<void>('/miniapp/auth/logout')
}
