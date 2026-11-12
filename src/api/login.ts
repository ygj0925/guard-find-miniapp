/**
 * 登录与用户接口(guard-find-backend /miniapp/auth)。
 * 仅支持微信小程序一键登录:wx.login 的 code 换 token。
 */
import type { IAuthLoginRes, IUserInfoRes } from './types/login'
import type { CustomRequestOptions } from '@/http/types'
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
export function getUserInfo(options?: Partial<CustomRequestOptions>) {
  return http.get<IUserInfoRes>('/miniapp/auth/me', undefined, undefined, options)
}

/** 仅更新当前用户的昵称和头像，返回完整用户信息。 */
export function updateUserInfo(
  data: { nickname: string, avatar: string },
  options?: Partial<CustomRequestOptions>,
) {
  return http.put<IUserInfoRes>(
    '/miniapp/auth/me',
    { nickname: data.nickname, avatar: data.avatar },
    undefined,
    undefined,
    options,
  )
}

/** 退出登录 */
export function logout() {
  return http.post<void>('/miniapp/auth/logout')
}
