import { http } from '@/http/http'

/** 开发环境 OpenAPI：MiniappBannerResp。 */
export interface MiniappBanner {
  id: number
  imageUrl?: string
  hoverText?: string
  targetUrl?: string
}

export function getMiniappBanners() {
  return http.get<MiniappBanner[]>(
    '/miniapp/banners',
    undefined,
    undefined,
    { hideErrorToast: true },
  )
}
