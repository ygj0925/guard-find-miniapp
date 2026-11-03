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
      success(res) {
        try {
          const data = JSON.parse(res.data) as {
            code: string | number
            msg?: string
            data?: { url?: string }
          }
          if (
            String(data.code) === '401'
            && store.updateNowTime().validToken === token
          ) {
            store.clearLoginState()
            toLoginPage()
          }
          if (
            res.statusCode < 200
            || res.statusCode >= 300
            || !isSuccessResultCode(Number(data.code))
            || !data.data?.url
          ) {
            throw new Error(data.msg || '图片上传失败')
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
