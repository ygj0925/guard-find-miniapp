/**
 * 房源接口(guard-find-server /app/property)。
 */
import { http } from '@/http/http'

export type PropertyStatus = 1 | 2 | 3
export type PropertyType = 'house' | 'apartment' | 'villa' | 'shop'
export type PriceType = 'rent' | 'sale'
export type RentalMode = 'whole' | 'shared'

export interface Property {
  id: number
  userId: number
  ownerNickname: string | null
  ownerAvatar: string | null
  ownerIsManager: boolean | null
  title: string
  description: string | null
  propertyType: PropertyType
  layout: string | null
  areaSqm: number | null
  floorInfo: string | null
  orientation: string | null
  decoration: string | null
  price: number
  priceType: PriceType
  community: string | null
  availableFrom: string | null
  rentalMode: RentalMode | null
  address: string
  district: string | null
  city: string | null
  facilities: string[]
  contactName: string | null
  contactPhone: string | null
  status: PropertyStatus
  viewCount: number
  isFavorited?: boolean | null
  images: string[]
  createTime?: string
}

export interface PageResult<T> {
  total: number
  list: T[]
}

export const PROPERTY_TYPE_LABEL: Record<string, string> = {
  house: '住宅',
  apartment: '公寓',
  villa: '别墅',
  shop: '商铺',
}

/** 房源广场:已上架房源,支持类型/租售/租赁方式筛选 */
export function fetchProperties(params: {
  page: number
  size: number
  propertyType?: string
  priceType?: string
  rentalMode?: string
}) {
  return http.get<PageResult<Property>>('/app/property/list', params)
}

/** 房源详情(浏览计数自增,登录用户回填 isFavorited 并记录足迹) */
export function fetchPropertyDetail(id: number | string) {
  return http.get<Property>(`/app/property/${id}`)
}
