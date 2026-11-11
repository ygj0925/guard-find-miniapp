import type { CustomRequestOptions, HttpError, IResponse } from '@/http/types'
import { AUTH_TOKEN_STORAGE_KEY, useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'
import { createHttpError, getResponseMessage, HttpErrorType, isSuccessResultCode, ResultEnum, ShowMessage } from './tools/enum'

function normalizeAccessToken(value: unknown) {
  return typeof value === 'string' ? value.replace(/^Bearer\s+/i, '').trim() : ''
}

function readRequestAccessToken(options: CustomRequestOptions) {
  if (options.skipAuth)
    return ''

  const authorization = options.header?.Authorization || options.header?.authorization
  const headerToken = normalizeAccessToken(authorization)
  if (headerToken)
    return headerToken

  try {
    const persistedToken = normalizeAccessToken(uni.getStorageSync<string>(AUTH_TOKEN_STORAGE_KEY))
    return persistedToken || normalizeAccessToken(useTokenStore().updateNowTime().validToken)
  }
  catch {
    return normalizeAccessToken(useTokenStore().updateNowTime().validToken)
  }
}

export function http<T>(options: CustomRequestOptions) {
  const requestAccessToken = readRequestAccessToken(options)
  // 1. 返回 Promise 对象
  return new Promise<T>((resolve, reject) => {
    uni.request({
      ...options,
      dataType: 'json',
      // #ifndef MP-WEIXIN
      responseType: 'json',
      // #endif
      // 响应成功
      success: async (res) => {
        const responseData = res.data as Partial<IResponse<T>>
        const code = responseData?.code
        // 后端部分接口（如行为验证码）将业务码序列化为字符串 "0"。
        const normalizedCode = typeof code === 'string' ? Number(code) : code

        // 检查是否是401错误（包括HTTP状态码401或业务码401）
        const isTokenExpired = res.statusCode === 401 || normalizedCode === ResultEnum.Unauthorized

        if (isTokenExpired && options.skipAuth) {
          return reject(createHttpError({
            type: HttpErrorType.Auth,
            code,
            statusCode: res.statusCode,
            message: getResponseMessage(responseData, '请求未授权'),
            data: responseData?.data,
            raw: res,
          }))
        }

        if (isTokenExpired && options.url.includes('/auth/logout')) {
          return reject(createHttpError({
            type: HttpErrorType.Auth,
            code,
            statusCode: res.statusCode,
            message: getResponseMessage(responseData, '登录已过期'),
            data: responseData?.data,
            raw: res,
          }))
        }

        if (isTokenExpired) {
          // 先结束请求，再按发起请求时的 token 条件清理，避免迟到的 401 退出新账号。
          reject(createHttpError({
            type: HttpErrorType.Auth,
            code,
            statusCode: res.statusCode,
            message: getResponseMessage(responseData, '登录已过期，请重新登录'),
            data: responseData?.data,
            raw: res,
          }))
          if (await useTokenStore().clearLoginState(requestAccessToken))
            toLoginPage()
          return
        }

        // 处理其他成功状态（HTTP状态码200-299）
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 处理业务逻辑错误
          if (!isSuccessResultCode(normalizedCode as number)) {
            const httpError = createHttpError({
              type: HttpErrorType.Business,
              code,
              statusCode: res.statusCode,
              message: getResponseMessage(responseData),
              data: responseData?.data,
              raw: responseData,
            })

            if (!options.hideErrorToast) {
              uni.showToast({
                icon: 'none',
                title: httpError.message,
              })
            }
            return reject(httpError)
          }
          return resolve(responseData.data as T)
        }

        // 处理其他错误
        const httpError = createHttpError({
          type: HttpErrorType.Http,
          code,
          statusCode: res.statusCode,
          message: getResponseMessage(responseData, ShowMessage(res.statusCode)),
          data: responseData?.data,
          raw: res,
        })

        if (!options.hideErrorToast) {
          uni.showToast({
            icon: 'none',
            title: httpError.message,
          })
        }
        reject(httpError)
      },
      // 响应失败
      fail(err) {
        const httpError = createHttpError({
          type: HttpErrorType.Network,
          message: '网络错误，换个网络试试',
          raw: err,
        } satisfies HttpError)

        if (!options.hideErrorToast) {
          uni.showToast({
            icon: 'none',
            title: httpError.message,
          })
        }
        reject(httpError)
      },
    })
  })
}

/**
 * GET 请求
 * @param url 后台地址
 * @param query 请求query参数
 * @param header 请求头，默认为json格式
 * @returns
 */
export function httpGet<T>(url: string, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    query,
    method: 'GET',
    header,
    ...options,
  })
}

/**
 * POST 请求
 * @param url 后台地址
 * @param data 请求body参数
 * @param query 请求query参数，post请求也支持query，很多微信接口都需要
 * @param header 请求头，默认为json格式
 * @returns
 */
export function httpPost<T>(url: string, data?: Record<string, any>, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    query,
    data,
    method: 'POST',
    header,
    ...options,
  })
}
/**
 * PUT 请求
 */
export function httpPut<T>(url: string, data?: Record<string, any>, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    data,
    query,
    method: 'PUT',
    header,
    ...options,
  })
}

/**
 * DELETE 请求（无请求体，仅 query）
 */
export function httpDelete<T>(url: string, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    query,
    method: 'DELETE',
    header,
    ...options,
  })
}

// 支持与 axios 类似的API调用
http.get = httpGet
http.post = httpPost
http.put = httpPut
http.delete = httpDelete
