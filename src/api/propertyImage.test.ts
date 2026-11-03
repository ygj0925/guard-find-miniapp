import { vi } from 'vitest'
import { uploadPropertyImage } from './propertyImage'

const session = vi.hoisted(() => ({ token: 'old-token', clear: vi.fn(), login: vi.fn() }))
vi.mock('@/store/token', () => ({
  useTokenStore: () => ({
    updateNowTime: () => ({ validToken: session.token }),
    clearLoginState: session.clear,
  }),
}))
vi.mock('@/utils/toLoginPage', () => ({ toLoginPage: session.login }))

describe('property image upload', () => {
  beforeEach(() => {
    session.token = 'old-token'
  })

  it('uses the authenticated upload interceptor and returns the stored URL', async () => {
    vi.mocked(uni.uploadFile).mockImplementationOnce((options) => {
      expect(options.url).toBe('/miniapp/property/images')
      expect(options.name).toBe('file')
      options.success?.({ statusCode: 200, data: JSON.stringify({ code: '0', data: { url: 'https://example.com/a.png' } }) })
      return {} as UniApp.UploadTask
    })
    await expect(uploadPropertyImage('/tmp/a.png')).resolves.toBe('https://example.com/a.png')
  })

  it('rejects a business failure instead of treating HTTP 200 as success', async () => {
    vi.mocked(uni.uploadFile).mockImplementationOnce((options) => {
      options.success?.({ statusCode: 200, data: JSON.stringify({ code: '500', msg: '图片内容无效' }) })
      return {} as UniApp.UploadTask
    })
    await expect(uploadPropertyImage('/tmp/a.png')).rejects.toThrow('图片内容无效')
  })

  it('does not clear a newer login when an older upload returns unauthorized', async () => {
    vi.mocked(uni.uploadFile).mockImplementationOnce((options) => {
      session.token = 'new-token'
      options.success?.({ statusCode: 401, data: JSON.stringify({ code: '401', msg: '请先登录' }) })
      return {} as UniApp.UploadTask
    })
    await expect(uploadPropertyImage('/tmp/a.png')).rejects.toThrow('请先登录')
    expect(session.clear).not.toHaveBeenCalled()
    expect(session.login).not.toHaveBeenCalled()
  })
})
