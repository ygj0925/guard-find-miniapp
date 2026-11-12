import { isSuccessResultCode } from '@/http/tools/enum'
import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

export function uploadPropertyImage(filePath: string): Promise<string> {
  const store = useTokenStore()
  const token = store.updateNowTime().validToken
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: '/miniapp/property/images',
      name: 'file',
      filePath,
      timeout: 60000,
      async success(res) {
        try {
          let data: {
            code: string | number
            msg?: string
            data?: { url?: string }
          } | null = null
          try {
            data = JSON.parse(res.data)
          }
          catch (error) {
            if (res.statusCode !== 401)
              throw error
          }
          if (res.statusCode === 401 || String(data?.code) === '401') {
            reject(new Error(data?.msg || '登录已过期，请重新登录'))
            if (await store.clearLoginState(token))
              toLoginPage()
            return
          }
          if (
            res.statusCode < 200
            || res.statusCode >= 300
            || (typeof data?.code !== 'number' && typeof data?.code !== 'string')
            || String(data?.code).trim() === ''
            || !isSuccessResultCode(Number(data?.code))
            || typeof data?.data?.url !== 'string'
            || !/^https?:\/\/\S+$/.test(data.data.url)
          ) {
            throw new Error(data?.msg || '图片上传失败')
          }
          resolve(data.data.url)
        }
        catch (error) {
          reject(error instanceof Error ? error : new Error('图片上传失败'))
        }
      },
      fail: () => reject(new Error('图片上传失败，请检查网络后重试')),
    })
  })
}
