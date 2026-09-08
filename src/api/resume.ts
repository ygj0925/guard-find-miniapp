import type { IResponse } from '@/http/types'
import { http } from '@/http/http'
import { getResponseMessage, HttpErrorType, isSuccessResultCode, ResultEnum } from '@/http/tools/enum'
import { AUTH_TOKEN_STORAGE_KEY, useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

export interface ResumeItem {
  id: string
  name: string
  fileId: string
  fileType: string
  isDefault: boolean
  uploadedAt: string
  originalFileName?: string
}

export interface ResumeUrl {
  attachmentUrl: string // 简历附件下载地址
  previewUrl: string // 简历在线预览地址
}

export interface ResumeUpdateForm {
  name: string
  isDefault?: boolean
}

export function getResumes() {
  return http.get<ResumeItem[]>('/miniapp/resumes')
}

export function updateResume(id: string, data: ResumeUpdateForm) {
  return http.put<ResumeItem>(`/miniapp/resumes/${id}`, data)
}

export function setDefaultResume(id: string) {
  return http.put<ResumeItem>(`/miniapp/resumes/${id}/default`)
}

export function deleteResume(id: string) {
  return http.delete<void>(`/miniapp/resumes/${id}`)
}

class ResumeUploadAuthError extends Error {
  readonly type = HttpErrorType.Auth
  readonly code?: number | string
  readonly statusCode: number

  constructor(message: string, code: number | string | undefined, statusCode: number) {
    super(message)
    this.name = 'ResumeUploadAuthError'
    this.code = code
    this.statusCode = statusCode
  }
}

function parseUploadPayload(statusCode: number, responseData: string) {
  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(responseData) as unknown
  }
  catch {
    if (statusCode === ResultEnum.Unauthorized)
      throw new ResumeUploadAuthError('登录已过期，请重新登录', undefined, statusCode)
    throw new Error('简历上传响应解析失败')
  }

  const payload = parsedPayload && typeof parsedPayload === 'object'
    ? parsedPayload as Partial<IResponse<ResumeItem>>
    : undefined
  const code = payload?.code
  const normalizedCode = typeof code === 'string' ? Number(code) : code

  if (statusCode === ResultEnum.Unauthorized || normalizedCode === ResultEnum.Unauthorized) {
    throw new ResumeUploadAuthError(
      getResponseMessage(payload, '登录已过期，请重新登录'),
      code,
      statusCode,
    )
  }

  if (statusCode < 200 || statusCode >= 300)
    throw new Error(getResponseMessage(payload, `简历上传失败（${statusCode}）`))

  if (typeof normalizedCode !== 'number' || !Number.isFinite(normalizedCode) || !isSuccessResultCode(normalizedCode))
    throw new Error(getResponseMessage(payload, '简历上传失败'))
  if (!payload?.data || typeof payload.data !== 'object')
    throw new Error('简历上传结果无效')
  return payload.data
}

export function uploadResume(name: string, filePath: string) {
  return new Promise<ResumeItem>((resolve, reject) => {
    const tokenStore = useTokenStore()
    const persistedToken = uni.getStorageSync<string>(AUTH_TOKEN_STORAGE_KEY)
    const token = String(persistedToken || tokenStore.updateNowTime().validToken || '')
      .replace(/^Bearer\s+/i, '')
      .trim()

    uni.uploadFile({
      url: '/miniapp/resumes',
      filePath,
      name: 'file',
      formData: { name },
      header: token ? { Authorization: `Bearer ${token}` } : undefined,
      success: async (response) => {
        try {
          resolve(parseUploadPayload(response.statusCode, response.data))
        }
        catch (error) {
          const uploadError = error instanceof Error ? error : new Error('简历上传失败')
          const loginStateCleared = uploadError instanceof ResumeUploadAuthError && token
            ? await tokenStore.clearLoginState(token).catch(() => false)
            : false
          reject(uploadError)
          if (loginStateCleared)
            toLoginPage()
        }
      },
      fail: error => reject(new Error(error.errMsg || '简历上传失败')),
    })
  })
}

export function getFileUrl(id: string) {
  return http.get<ResumeUrl>(`/miniapp/resumes/${encodeURIComponent(id)}/urls`)
}
