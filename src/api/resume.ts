import { getEnvBaseUrl } from '@/utils'
import { http } from '@/http/http'

export interface ResumeItem {
  id: number
  name: string
  fileUrl: string
  isDefault: boolean
  uploadedAt: string
}

export interface ResumeUpdateForm {
  name: string
  isDefault?: boolean
}

export function getResumes() {
  return http.get<ResumeItem[]>('/miniapp/resumes')
}

export function updateResume(id: number, data: ResumeUpdateForm) {
  return http.put<ResumeItem>(`/miniapp/resumes/${id}`, data)
}

export function setDefaultResume(id: number) {
  return http.put<ResumeItem>(`/miniapp/resumes/${id}/default`)
}

export function deleteResume(id: number) {
  return http.delete<void>(`/miniapp/resumes/${id}`)
}

export function uploadResume(name: string, filePath: string) {
  return new Promise<ResumeItem>((resolve, reject) => {
    const token = uni.getStorageSync<string>('auth-access-token')
    uni.uploadFile({
      url: `${getEnvBaseUrl()}/miniapp/resumes`,
      filePath,
      name: 'file',
      formData: { name },
      header: token ? { Authorization: `Bearer ${token}` } : undefined,
      success: (response) => {
        try {
          const payload = JSON.parse(response.data) as { code: number | string, data: ResumeItem, msg?: string, message?: string }
          if (Number(payload.code) !== 0) {
            reject(new Error(payload.msg || payload.message || '简历上传失败'))
            return
          }
          resolve(payload.data)
        }
        catch {
          reject(new Error('简历上传响应解析失败'))
        }
      },
      fail: error => reject(new Error(error.errMsg || '简历上传失败')),
    })
  })
}
