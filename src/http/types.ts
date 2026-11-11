/**
 * 在 uniapp 的 RequestOptions 和 IUniUploadFileOptions 基础上，添加自定义参数
 */
export type CustomRequestOptions = UniApp.RequestOptions & {
  query?: Record<string, any>
  /** 出错时是否隐藏错误提示 */
  hideErrorToast?: boolean
  /** 匿名请求：不携带访问令牌，401 不处理全局登录态 */
  skipAuth?: boolean
} & IUniUploadFileOptions // 添加uni.uploadFile参数类型

export interface HttpError<T = any> {
  type: 'business' | 'auth' | 'http' | 'network'
  code?: number | string
  statusCode?: number
  message: string
  data?: T
  raw?: unknown
}

// 通用响应格式（兼容 msg + message 字段）
export type IResponse<T = any> = {
  code: number | string
  data: T
  message: string
  [key: string]: any // 允许额外属性
} | {
  code: number | string
  data: T
  msg: string
  [key: string]: any // 允许额外属性
}
