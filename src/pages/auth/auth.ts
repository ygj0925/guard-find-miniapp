export type WechatAuthMode = 'mock' | 'api'

export type AuthFeedbackType = 'error' | 'info' | 'success'

export interface AuthFeedback {
  type: AuthFeedbackType
  message: string
}

export interface AccountLoginForm {
  phone: string
  password: string
  agreed: boolean
}

export interface PhoneCodeForm {
  phone: string
  code: string
  agreed: boolean
}

const PHONE_PATTERN = /^1\d{10}$/
const PASSWORD_MIN_LENGTH = 6
const PASSWORD_MAX_LENGTH = 20
const MAINLAND_AREA_CODE = '86'
const MAINLAND_PHONE_LENGTH = 11
const OVERSEAS_PHONE_MAX_LENGTH = 15
const OVERSEAS_PHONE_MIN_LENGTH = 5

export function normalizePhone(value: string, maxLength: number = MAINLAND_PHONE_LENGTH) {
  return value.replace(/\D/g, '').slice(0, maxLength)
}

export function validatePhone(phone: string): string {
  if (!phone) {
    return '请输入手机号'
  }
  if (!PHONE_PATTERN.test(normalizePhone(phone))) {
    return '请输入正确的 11 位手机号'
  }
  return ''
}

export function getPhoneMaxLength(areaCode: string): number {
  return areaCode === MAINLAND_AREA_CODE ? MAINLAND_PHONE_LENGTH : OVERSEAS_PHONE_MAX_LENGTH
}

export function validatePhoneByAreaCode(phone: string, areaCode: string): string {
  if (areaCode === MAINLAND_AREA_CODE) {
    return validatePhone(phone)
  }
  const digits = phone.replace(/\D/g, '')
  if (!digits) {
    return '请输入手机号'
  }
  if (digits.length < OVERSEAS_PHONE_MIN_LENGTH || digits.length > OVERSEAS_PHONE_MAX_LENGTH) {
    return '请输入正确的手机号'
  }
  return ''
}

export function validatePassword(password: string): string {
  if (!password) {
    return '请输入密码'
  }
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return '密码长度应为 6-20 位'
  }
  return ''
}

export function validateVerificationCode(code: string): string {
  if (!code) {
    return '请输入验证码'
  }
  if (!/^\d{4,6}$/.test(code)) {
    return '验证码应为 4-6 位数字'
  }
  return ''
}

export function canSubmitAccountLogin(form: AccountLoginForm): boolean {
  return !validatePhone(form.phone) && !validatePassword(form.password)
}

export function canSubmitPhoneCode(form: PhoneCodeForm): boolean {
  return !validatePhone(form.phone) && !validateVerificationCode(form.code)
}

export function getWechatAuthMode(): WechatAuthMode {
  return import.meta.env.VITE_WECHAT_AUTH_MODE === 'api' ? 'api' : 'mock'
}
