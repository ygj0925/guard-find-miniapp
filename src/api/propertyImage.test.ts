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
    session.clear.mockReset().mockImplementation(async (token: string) => token === session.token)
    session.login.mockClear()
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
    expect(session.clear).toHaveBeenCalledWith('old-token')
    expect(session.login).not.toHaveBeenCalled()
  })

  it.each([true, false])('waits for conditional session cleanup before redirecting (%s)', async (cleared) => {
    let finishCleanup!: (value: boolean) => void
    session.clear.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      finishCleanup = resolve
    }))
    vi.mocked(uni.uploadFile).mockImplementationOnce((options) => {
      options.success?.({ statusCode: 200, data: JSON.stringify({ code: '401', msg: '请先登录' }) })
      return {} as UniApp.UploadTask
    })
    await expect(uploadPropertyImage('/tmp/a.png')).rejects.toThrow('请先登录')
    expect(session.clear).toHaveBeenCalledWith('old-token')
    expect(session.login).not.toHaveBeenCalled()
    finishCleanup(cleared)
    await Promise.resolve()
    expect(session.login).toHaveBeenCalledTimes(cleared ? 1 : 0)
  })

  it('handles HTTP unauthorized even when the body has a different code', async () => {
    vi.mocked(uni.uploadFile).mockImplementationOnce((options) => {
      options.success?.({ statusCode: 401, data: JSON.stringify({ code: '500' }) })
      return {} as UniApp.UploadTask
    })
    await expect(uploadPropertyImage('/tmp/a.png')).rejects.toThrow('登录已过期')
    expect(session.clear).toHaveBeenCalledWith('old-token')
    expect(session.login).toHaveBeenCalledOnce()
  })

  it.each(['', '<html>Unauthorized</html>', 'null'])('handles HTTP 401 with an unusable body (%s)', async (data) => {
    vi.mocked(uni.uploadFile).mockImplementationOnce((options) => {
      options.success?.({ statusCode: 401, data })
      return {} as UniApp.UploadTask
    })
    await expect(uploadPropertyImage('/tmp/a.png')).rejects.toThrow('登录已过期，请重新登录')
    expect(session.clear).toHaveBeenCalledWith('old-token')
    expect(session.login).toHaveBeenCalledOnce()
  })

  it.each(['', '<html>Unauthorized</html>', 'null'])('keeps a newer login when an old upload returns HTTP 401 (%s)', async (data) => {
    vi.mocked(uni.uploadFile).mockImplementationOnce((options) => {
      session.token = 'new-token'
      options.success?.({ statusCode: 401, data })
      return {} as UniApp.UploadTask
    })
    await expect(uploadPropertyImage('/tmp/a.png')).rejects.toThrow('登录已过期，请重新登录')
    expect(session.clear).toHaveBeenCalledWith('old-token')
    expect(session.login).not.toHaveBeenCalled()
  })

  it.each(['', '<html>Unauthorized</html>', 'null'])('rejects unusable HTTP 200 bodies without clearing the session (%s)', async (data) => {
    vi.mocked(uni.uploadFile).mockImplementationOnce((options) => {
      options.success?.({ statusCode: 200, data })
      return {} as UniApp.UploadTask
    })
    await expect(uploadPropertyImage('/tmp/a.png')).rejects.toThrow()
    expect(session.clear).not.toHaveBeenCalled()
    expect(session.login).not.toHaveBeenCalled()
  })

  it.each([null, false, '', ' '])('rejects an invalid success code (%s)', async (code) => {
    vi.mocked(uni.uploadFile).mockImplementationOnce((options) => {
      options.success?.({ statusCode: 200, data: JSON.stringify({ code, data: { url: 'https://example.com/a.png' } }) })
      return {} as UniApp.UploadTask
    })
    await expect(uploadPropertyImage('/tmp/a.png')).rejects.toThrow('图片上传失败')
    expect(session.clear).not.toHaveBeenCalled()
    expect(session.login).not.toHaveBeenCalled()
  })

  it.each([42, {}, [], '   ', '/tmp/avatar.png', 'javascript:alert(1)', 'https://example.com/a b.png'])('rejects an invalid stored URL (%j)', async (url) => {
    vi.mocked(uni.uploadFile).mockImplementationOnce((options) => {
      options.success?.({ statusCode: 200, data: JSON.stringify({ code: '0', data: { url } }) })
      return {} as UniApp.UploadTask
    })
    await expect(uploadPropertyImage('/tmp/a.png')).rejects.toThrow('图片上传失败')
    expect(session.clear).not.toHaveBeenCalled()
    expect(session.login).not.toHaveBeenCalled()
  })

  it.each([0, 200, '0', '200'])('accepts a supported success code (%s)', async (code) => {
    vi.mocked(uni.uploadFile).mockImplementationOnce((options) => {
      options.success?.({ statusCode: 200, data: JSON.stringify({ code, data: { url: 'http://localhost:8000/avatar.png' } }) })
      return {} as UniApp.UploadTask
    })
    await expect(uploadPropertyImage('/tmp/a.png')).resolves.toBe('http://localhost:8000/avatar.png')
  })
})
