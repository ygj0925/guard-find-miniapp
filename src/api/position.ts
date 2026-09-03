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
  /** 招聘类别文本，如 社招 / 校招，用于社会招聘、校园招聘的快捷过滤。 */
  category?: string
  educationInfos?: string[]
  workExperiences?: string[]
  locIds?: string[]
}

export interface HotPositionListQuery {
  pageNum: number
  pageSize: number
}

export interface PositionListItem {
  positionId: string
  /** 上游职位 jobId，投递时必须一并提交。 */
  jobId: string | number
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
  /** 是否已投递；未返回时视为未投递，兼容旧版后端响应。 */
  applied?: boolean
  applyRecordId?: number
}

export interface PositionApplyForm {
  /** 简历雪花 ID，必须使用字符串避免 JavaScript 精度丢失。 */
  resumeId: string
  jobId: string | number
}

export interface PositionApplyResult {
  status: string
  applyId: string
  message: string
}

export interface PositionApplyRecord {
  id: number
  resumeId: string
  positionId: string
  importStatus: string
  failedReason?: string
  jobTitle: string
  processName: string
  phaseName: string
  statusName: string
  createTime: string
}

export interface PositionApplyProgressItem {
  processName: string
  phaseName: string
  statusName: string
  createTime: string
}

export interface PositionApplyProgress {
  apply: PositionApplyRecord
  progressList: PositionApplyProgressItem[]
}

export function getPositionFilterOptions() {
  return http.get<PositionFilterOptions>('/miniapp/positions/filter-options')
}

export function getPositions(query: PositionListQuery) {
  return http.get<PositionListPage>('/miniapp/positions', query)
}

export function getHotPositions(query: HotPositionListQuery) {
  return http.get<PositionListPage>('/miniapp/positions/hot', query)
}

export function getPositionDetail(positionId: string) {
  return http.get<PositionDetail>(`/miniapp/positions/${encodeURIComponent(positionId)}`)
}

export function applyPosition(positionId: string, data: PositionApplyForm) {
  return http.post<PositionApplyResult>(`/miniapp/positions/${encodeURIComponent(positionId)}/apply`, data)
}

export function getPositionApplies() {
  return http.get<PositionApplyRecord[]>('/miniapp/position-applies')
}

export function getPositionApplyProgress(id: number) {
  return http.get<PositionApplyProgress>(`/miniapp/position-applies/${id}/progress`)
}
