import { http } from '@/http/http'

export interface MapProperty { id: string, title: string, city: string, district: string, community: string, price: number, priceType: 'rent' | 'sale', priceUnit: string | null, latitude: number, longitude: number, locationLabel: string }
export interface CommunitySuggestion { city: string, district: string, community: string, propertyCount: number }
export interface MapFilters { city?: string, district?: string, community?: string, keyword?: string, priceType?: string, priceUnit?: string, minPrice?: number, maxPrice?: number, south?: number, north?: number, west?: number, east?: number }
export function fetchMapProperties(params: MapFilters) {
  return http.get<{ list: MapProperty[], truncated: boolean, coordinateSystem: string }>('/miniapp/property/map', params)
}
export function fetchCommunities(params: MapFilters) {
  return http.get<CommunitySuggestion[]>('/miniapp/property/communities', params)
}
export function fetchRegionSource() {
  return http.get<{ publisher: string, version: string, sourceUrl: string, scope: string }>('/miniapp/region/source')
}
