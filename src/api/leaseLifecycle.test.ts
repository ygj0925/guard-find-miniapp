import { afterEach, expect, it, vi } from 'vitest'
import { uploadLeaseFile } from './leaseLifecycle'

afterEach(() => vi.restoreAllMocks())
function respond(body: unknown, statusCode = 200) {
  vi.spyOn(uni, 'uploadFile').mockImplementationOnce((options) => {
    options.success?.({ data: JSON.stringify(body), statusCode, errMsg: '' })
    return {} as UniApp.UploadTask
  })
}
it('returns a private attachment identifier after a successful upload', async () => {
  respond({ code: 200, data: { id: '9000000000000001' } })
  await expect(uploadLeaseFile('501', '/tmp/photo.png')).resolves.toBe('9000000000000001')
  expect(uni.uploadFile).toHaveBeenCalledWith(expect.objectContaining({ url: '/miniapp/property/leases/501/files' }))
})
it.each([
  { data: { id: '601' } },
  { code: '', data: { id: '601' } },
  { code: 200, data: { id: 601 } },
  { code: 200, data: { id: 'https://public.example/image.png' } },
])('rejects malformed upload responses %#', async (body) => {
  respond(body)
  await expect(uploadLeaseFile('501', '/tmp/photo.png')).rejects.toThrow()
})
it('never treats an HTTP failure as a successful receipt upload', async () => {
  respond({ code: 200, data: { id: '601' } }, 500)
  await expect(uploadLeaseFile('501', '/tmp/photo.png')).rejects.toThrow()
})
