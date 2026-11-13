import { http } from '@/http/http'

export interface HomeBanner {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  targetType: 'all' | 'recommended' | 'activity' | 'property'
  targetId: string | null
  enabled: boolean
}

export interface PropertyActivity {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  startsAt: string | null
  endsAt: string | null
  enabled: boolean
  propertyIds: (string | number)[]
}

export interface PropertyHome {
  supportPhone: string | null
  serviceHours: string | null
  banners: HomeBanner[]
  activities: PropertyActivity[]
}

export function fetchPropertyHome() {
  return http.get<PropertyHome>('/miniapp/property/home')
}
