import type { Handwriting, SigningProfile } from '@/api/leases'
import { isSuccessResultCode } from '@/http/tools/enum'

export function hasHandwriting(value: Handwriting) {
  const points = value.strokes.flat()
  if (points.length < 8 || points.length > 12000 || value.strokes.length > 120)
    return false
  let distance = 0
  for (const stroke of value.strokes) {
    if (stroke.length < 2 || stroke.length > 2500)
      return false
    for (let i = 1; i < stroke.length; i++)
      distance += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y)
  }
  return points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 400)
    && Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)) >= 40
    && Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) >= 25 && distance >= 100
}
export function uploadPersonalSeal(filePath: string): Promise<SigningProfile> {
  return new Promise((resolve, reject) => uni.uploadFile({
    url: '/miniapp/property/signing-profile/seal',
    filePath,
    name: 'file',
    success(response) {
      try {
        const body = JSON.parse(response.data) as {
          code?: number | string
          msg?: string
          data?: SigningProfile
        }
        if (response.statusCode !== 200 || body.code === undefined || String(body.code).trim() === '' || !isSuccessResultCode(Number(body.code)) || !body.data?.seal?.id)
          throw new Error(body.msg || '印章上传失败')
        resolve(body.data)
      }
      catch (error) {
        reject(error)
      }
    },
    fail: () => reject(new Error('印章上传失败，请重试')),
  }))
}
export async function openLeasePdf(file: {
  filename: string
  base64: string
}, valid: () => boolean = () => true) {
  if (!valid())
    return
  // #ifdef H5
  const binary = atob(file.base64)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  // #endif
  // #ifdef MP-WEIXIN
  const path = `${wx.env.USER_DATA_PATH}/lease-${Date.now()}.pdf`
  await new Promise<void>((resolve, reject) => uni.getFileSystemManager().writeFile({ filePath: path, data: file.base64, encoding: 'base64', success: () => resolve(), fail: reject }))
  try {
    if (!valid()) {
      uni.getFileSystemManager().unlink({ filePath: path, fail: () => {} })
      return
    }
    await uni.openDocument({ filePath: path, fileType: 'pdf', showMenu: true })
  }
  catch (error) {
    uni.getFileSystemManager().unlink({ filePath: path, fail: () => { } })
    throw error
  }
  // #endif
}
