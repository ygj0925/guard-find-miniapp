import type { PriceType, PropertySort, PropertyType, RentalMode } from '@/api/property'

export interface PropertyFilterDraft {
  keyword: string
  city: string
  propertyType: 'all' | PropertyType
  priceType: 'all' | PriceType
  rentalMode: 'all' | RentalMode
  minPrice: string
  maxPrice: string
  sort: PropertySort
  priceUnit: 'all' | 'month' | 'day'
  recommended: boolean
  activityId: string
}

export function defaultPropertyFilters(): PropertyFilterDraft {
  return { keyword: '', city: '', propertyType: 'all', priceType: 'all', rentalMode: 'all', minPrice: '', maxPrice: '', sort: 'newest', priceUnit: 'all', recommended: false, activityId: '' }
}

function parsePrice(value: string): number | undefined {
  const text = value.trim()
  if (!text)
    return undefined
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text))
    throw new Error('价格应为非负金额，最多两位小数')
  return Number(text)
}

export function buildPropertyFilters(draft: PropertyFilterDraft) {
  const keyword = draft.keyword.trim()
  const city = draft.city.trim()
  if (keyword.length > 64)
    throw new Error('关键词最多64个字')
  if (city.length > 50)
    throw new Error('城市最多50个字')
  const minPrice = parsePrice(draft.minPrice)
  const maxPrice = parsePrice(draft.maxPrice)
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
    throw new Error('最低价格不能高于最高价格')
  return {
    keyword: keyword || undefined,
    city: city || undefined,
    propertyType: draft.propertyType === 'all' ? undefined : draft.propertyType,
    priceType: draft.priceType === 'all' ? undefined : draft.priceType,
    rentalMode: draft.priceType === 'rent' && draft.rentalMode !== 'all' ? draft.rentalMode : undefined,
    priceUnit: draft.priceType === 'rent' && draft.priceUnit !== 'all' ? draft.priceUnit : undefined,
    recommended: draft.recommended || undefined,
    activityId: draft.activityId || undefined,
    minPrice,
    maxPrice,
    sort: draft.sort,
  }
}
