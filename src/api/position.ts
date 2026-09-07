import { http } from '@/http/http'

export interface PositionFilterOption {
  value: string
  label: string
}

export interface PositionFilterOptions {
  kinds: PositionFilterOption[]
  educationInfos: PositionFilterOption[]
  workExperiences: PositionFilterOption[]
  locations: PositionFilterOption[]
}

export interface PositionListQuery {
  pageNum: number
  pageSize: number
  kinds?: number[]
  educationInfos?: string[]
  workExperiences?: string[]
  locIds?: string[]
}

export interface PositionAppliesItem {
  id: string
  resumeId: string
  positionId: string
  jobId: string
  applicantName: string
  applicantPhone: string
  resumeName: string
  importStatus: string
  failedReason: string
  jobTitle: string
  processName: string
  phaseName: string
  statusName: string
  createTime: string
}

export interface PositionListItem {
  positionId: string
  positionName: string
  jobType: string
  recruitmentTargetType: string
  availableCityList: string[]
  edu: string
  salaryMin?: number
  salaryMax?: number
  salaryUnit: string
  status: string
  location: string
  experience: string
  tags: string[]
}

export interface PositionListPage {
  list: PositionListItem[]
  total: number
}

export interface PositionRecruiter {
  name: string
  role: string
  avatar: string
  activeText: string
}

export interface PositionDetail extends PositionListItem {
  company?: string
  companyIndustry?: string
  companyStage?: string
  companySize?: string
  companyLogo?: string
  address?: string
  longitude?: number
  latitude?: number
  recruiter?: PositionRecruiter
  /** 上游当前可能返回换行分隔的字符串，页面会统一归一化。 */
  responsibilities?: string[] | string
  requirements?: string[] | string
}

export function getPositionFilterOptions() {
  return http.get<PositionFilterOptions>('/miniapp/positions/filter-options')
}

export function getPositions(query: PositionListQuery) {
  return http.get<PositionListPage>('/miniapp/positions', query)
}

export function getPositionDetail(positionId: string) {
  return http.get<PositionDetail>(`/miniapp/positions/${encodeURIComponent(positionId)}`)
}

export function getPositionApplies() {
  return http.get<PositionAppliesItem[]>(`/miniapp/position-applies`)
}
