// 认证模式类型
export type AuthMode = 'single' | 'double'

export interface PhoneLoginForm {
  /** 后端 sys_client.client_id；可通过 VITE_AUTH_CLIENT_ID 覆盖默认开发客户端。 */
  clientId: string
  authType: 'PHONE'
  phone: string
  captcha: string
  /** wx.login() 返回的临时凭证，用于关联微信身份。 */
  wxLoginCode?: string
}

export type SocialLoginSource = 'WECHAT_OPEN'

export interface SocialAuthorizeResult {
  authorizeUrl: string
}

export interface SocialLoginForm {
  /** 后端 sys_client.client_id，不是微信 AppID。 */
  clientId: string
  authType: 'SOCIAL'
  source: SocialLoginSource
  code: string
  state: string
}

export interface BehaviorCaptcha {
  originalImageBase64: string
  jigsawImageBase64: string
  point: { x: number, y: number }
  token: string
  secretKey?: string
}

export interface BehaviorCaptchaCheckResult {
  repCode: string
  repMsg?: string
}

export interface BehaviorCaptchaRequest {
  captchaType: 'blockPuzzle'
  captchaVerification?: string
}

// 单Token响应类型
export interface ISingleTokenRes {
  token: string
  /** 当前后端 LoginResp 不返回有效期；有值时才使用本地过期预判。 */
  expiresIn?: number
}

// 双Token响应类型
export interface IDoubleTokenRes {
  accessToken: string
  refreshToken: string
  accessExpiresIn: number // 访问令牌有效期(秒)
  refreshExpiresIn: number // 刷新令牌有效期(秒)
}

/**
 * 登录返回的信息，其实就是 token 信息
 */
export type IAuthLoginRes = ISingleTokenRes | IDoubleTokenRes

/**
 * 用户信息
 */
export type UserRole = string

export interface IUserInfoRes {
  userId: number
  username: string
  nickname: string
  avatar?: string
  /** 是否已完成内部员工认证。 */
  isInternalEmployee?: boolean
  /** 已认证或待认证的企业邮箱。 */
  email?: string
  /** 员工所属部门名称。 */
  deptName?: string
  /** 同时支持单角色和多角色，你自行选择一种就行 */
  role?: UserRole
  roles?: UserRole[]
  [key: string]: any // 允许其他扩展字段
}

export interface InternalEmployeeVerifyRequest {
  email: string
  captcha: string
}

// 认证存储数据结构
export interface AuthStorage {
  mode: AuthMode
  tokens: ISingleTokenRes | IDoubleTokenRes
  userInfo?: IUserInfoRes
  loginTime: number // 登录时间戳
}

/**
 * 获取验证码
 */
export interface ICaptcha {
  captchaEnabled: boolean
  uuid: string
  image: string
}
/**
 * 上传成功的信息
 */
export interface IUploadSuccessInfo {
  fileId: number
  originalName: string
  fileName: string
  storagePath: string
  fileHash: string
  fileType: string
  fileBusinessType: string
  fileSize: number
}
/**
 * 更新用户信息
 */
export interface IUpdateInfo {
  id: number
  name: string
  sex: string
}
/**
 * 更新用户信息
 */
export interface IUpdatePassword {
  id: number
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

/**
 * 判断是否为单Token响应
 * @param tokenRes 登录响应数据
 * @returns 是否为单Token响应
 */
export function isSingleTokenRes(tokenRes: IAuthLoginRes): tokenRes is ISingleTokenRes {
  return 'token' in tokenRes && !('refreshToken' in tokenRes)
}

/**
 * 判断是否为双Token响应
 * @param tokenRes 登录响应数据
 * @returns 是否为双Token响应
 */
export function isDoubleTokenRes(tokenRes: IAuthLoginRes): tokenRes is IDoubleTokenRes {
  return 'accessToken' in tokenRes && 'refreshToken' in tokenRes
}
