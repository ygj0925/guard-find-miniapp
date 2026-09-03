import type { BehaviorCaptcha, BehaviorCaptchaCheckResult, BehaviorCaptchaRequest, IAuthLoginRes, ICaptcha, IUpdateInfo, IUpdatePassword, IUserInfoRes, PhoneLoginForm } from './types/login'
import { http } from '@/http/http'

/**
 * 登录表单
 */
export interface ILoginForm {
  username: string
  password: string
}

/**
 * 获取验证码
 * @returns ICaptcha 验证码
 */
export function getCode() {
  return http.get<ICaptcha>('/user/getCode')
}

/**
 * 用户登录
 * @param loginForm 登录表单
 */
export function login(loginForm: ILoginForm) {
  return http.post<IAuthLoginRes>('/auth/login', loginForm)
}

/**
 * 手机号验证码登录；传入 wxLoginCode 时，后端会在登录成功后关联微信身份。
 */
export function phoneLogin(loginForm: PhoneLoginForm) {
  return http.post<IAuthLoginRes>('/auth/login', loginForm)
}

export function getBehaviorCaptcha() {
  return http.get<BehaviorCaptcha>('/captcha/behavior', { captchaType: 'blockPuzzle' })
}

export function checkBehaviorCaptcha(data: { captchaType: 'blockPuzzle', pointJson: string, token: string }) {
  return http.post<BehaviorCaptchaCheckResult>('/captcha/behavior', data)
}

export function sendSmsCaptcha(phone: string, captcha: BehaviorCaptchaRequest) {
  return http.get<void>('/captcha/sms', { phone, ...captcha })
}

// 发送内部员工认证验证码
export function innerEmployeeSend(email: string) {
  return http.post<string>('/portal/internal-employee/send', undefined, { email })
}

// 验证内部员工身份
export function innerEmployeeVerify(data: { email: string, captcha: string }) {
  return http.post<void>('/portal/internal-employee/verify', data)
}

/**
 * 刷新token
 * @param refreshToken 刷新token
 */
export function refreshToken(refreshToken: string) {
  return Promise.reject(new Error('当前后端未提供 Token 刷新接口'))
}

/**
 * 获取用户信息
 */
export function getUserInfo() {
  return http.get<IUserInfoRes>('/auth/user/info')
}

/**
 * 退出登录
 */
export function logout() {
  return http.post<void>('/auth/logout')
}

/**
 * 修改用户信息
 */
export function updateInfo(data: IUpdateInfo) {
  return http.post('/user/updateInfo', data)
}

/**
 * 修改用户密码
 */
export function updateUserPassword(data: IUpdatePassword) {
  return http.post('/user/updatePassword', data)
}

/**
 * 获取微信登录凭证
 * @returns Promise 包含微信登录凭证(code)
 */
export function getWxCode() {
  return new Promise<UniApp.LoginRes>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: res => resolve(res),
      fail: err => reject(new Error(err)),
    })
  })
}

/**
 * 微信登录
 * @param params 微信登录参数，包含code
 * @returns Promise 包含登录结果
 */
