/**
 * 房源接口(guard-find-backend /miniapp/property)。
 */
import { http } from '@/http/http'

export type PropertyStatus = 1 | 2 | 3
export type PropertyType = 'house' | 'apartment' | 'villa' | 'shop'
export type PriceType = 'rent' | 'sale'
export type RentalMode = 'whole' | 'shared'

export interface Property {
  id: string | number
  userId?: string | number | null
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
  city?: string
  propertyType?: string
  priceType?: string
  rentalMode?: string
}) {
  return http.get<PageResult<Property>>('/miniapp/property/list', params)
}

/** 房源详情(浏览计数自增,登录用户回填 isFavorited 并记录足迹) */
export function fetchPropertyDetail(id: string | number | string) {
  return http.get<Property>(`/miniapp/property/${id}`)
}

export type PropertyInput = Pick<
  Property,
  | 'title'
  | 'description'
  | 'propertyType'
  | 'layout'
  | 'areaSqm'
  | 'floorInfo'
  | 'orientation'
  | 'decoration'
  | 'price'
  | 'priceType'
  | 'community'
  | 'availableFrom'
  | 'rentalMode'
  | 'address'
  | 'district'
  | 'city'
  | 'facilities'
  | 'contactName'
  | 'contactPhone'
  | 'status'
  | 'images'
>
export function saveProperty(id: string, data: PropertyInput) {
  return id
    ? http.put<void>(`/miniapp/property/${id}`, data)
    : http.post<string>('/miniapp/property', data)
}
export function fetchPersonalProperties(
  kind: 'mine' | 'favorites' | 'history',
  page: number,
) {
  return http.get<PageResult<Property>>(`/miniapp/property/${kind}`, {
    page,
    size: 10,
  })
}
export function toggleFavorite(id: Property['id']) {
  return http.post<{ favorited: boolean }>(`/miniapp/property/${id}/favorite`)
}
export function deleteProperty(id: Property['id']) {
  return http.delete<void>(`/miniapp/property/${id}`)
}
export function changePropertyStatus(
  id: Property['id'],
  status: PropertyStatus,
) {
  return http.post<void>(`/miniapp/property/${id}/status`, undefined, {
    status,
  })
}
export interface BookingInput {
  bookingTime: string
  contactName: string
  contactPhone: string
  remark: string
}
export interface Booking extends BookingInput {
  id: string | number
  propertyId: string | number
  propertyTitle: string
  userId: string | number
  ownerId?: string | number | null
  status: number
}
export function createBooking(id: Property['id'], data: BookingInput) {
  return http.post<string>(`/miniapp/property/${id}/booking`, data)
}
export function fetchBookings(role: 'guest' | 'owner', page: number) {
  return http.get<PageResult<Booking>>('/miniapp/property/bookings', {
    role,
    page,
    size: 10,
  })
}
export function changeBookingStatus(id: Booking['id'], status: number) {
  return http.post<void>(`/miniapp/property/booking/${id}/status`, undefined, {
    status,
  })
}
