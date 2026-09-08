import type { CustomRequestOptions } from '@/http/types'
import { useTokenStore } from '@/store'
import { AUTH_TOKEN_STORAGE_KEY } from '@/store/token'
import { getEnvBaseUrl } from '@/utils'
import { stringifyQuery } from './tools/queryString'

// 请求基准地址
const baseUrl = getEnvBaseUrl()

// 拦截器配置
const httpInterceptor = {
  // 拦截前触发
  invoke(options: CustomRequestOptions) {
    // 如果您使用了alova，则请把下面的代码放开注释
    // alova 执行流程：alova beforeRequest --> 本拦截器 --> alova responded
    // return options

    // 非 alova 请求，正常执行
    // 接口请求支持通过 query 参数配置 queryString
    if (options.query) {
      const queryStr = stringifyQuery(options.query)
      if (options.url.includes('?')) {
        options.url += `&${queryStr}`
      }
      else {
        options.url += `?${queryStr}`
      }
    }
    // 非 http 开头需拼接地址
    if (!options.url.startsWith('http')) {
      // #ifdef H5
      if (JSON.parse(import.meta.env.VITE_APP_PROXY_ENABLE)) {
        // 自动拼接代理前缀
        options.url = import.meta.env.VITE_APP_PROXY_PREFIX + options.url
      }
      else {
        options.url = baseUrl + options.url
      }
      // #endif
      // 非H5正常拼接
      // #ifndef H5
      options.url = baseUrl + options.url
      // #endif
      // TIPS: 如果需要对接多个后端服务，也可以在这里处理，拼接成所需要的地址
    }
    // 1. 请求超时（调用方可为 SSE 等长连接显式覆盖）
    options.timeout ??= 60000 // 60s
    // 2. 复制请求头，并在进入原生请求前消费自定义认证选项
    const skipAuth = options.skipAuth
    delete options.skipAuth
    options.header = {
      ...options.header,
    }
    // 3. 匿名请求不允许携带调用方提供或自动注入的认证头
    if (skipAuth) {
      delete options.header.Authorization
      delete options.header.authorization
    }
    else {
      const tokenStore = useTokenStore()
      const persistedToken = uni.getStorageSync<string>(AUTH_TOKEN_STORAGE_KEY)
      const token = persistedToken || tokenStore.updateNowTime().validToken

      if (token) {
        options.header.Authorization = `Bearer ${token}`
      }
    }
    return options
  },
}

export const requestInterceptor = {
  install() {
    // 拦截 request 请求
    uni.addInterceptor('request', httpInterceptor)
    // 拦截 uploadFile 文件上传
    uni.addInterceptor('uploadFile', httpInterceptor)
  },
}
