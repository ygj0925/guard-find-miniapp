import { http } from '@/http/http'

export interface PositionFilterOption {
  value: string
  label: string
}

export interface PositionLocationOption extends PositionFilterOption {
  children?: PositionLocationOption[]
}

export interface PositionFilterOptions {
  kinds: PositionFilterOption[]
  educationInfos: PositionFilterOption[]
  workExperiences: PositionFilterOption[]
  locations: PositionLocationOption[]
}

export interface PositionListQuery {
  pageNum: number
  pageSize: number
  /** 职位搜索关键字。 */
  keyword?: string
  kinds?: number[]
  educationInfos?: string[]
  workExperiences?: string[]
  locIds?: string[]
  /** 招聘分类编码列表：1=社会招聘，2=校园招聘。 */
  categories?: string[]
}

export interface HotPositionListQuery {
  pageNum: number
  pageSize: number
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
  /** 上游职位 jobId，投递时必须一并提交。 */
  jobId: string | number
  positionName: string
  source?: string
  jobType: string
  recruitmentTargetType: string
  categories?: string[]
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
  applyRecordId?: string | number
}

export interface PositionApplyForm {
  /** 简历雪花 ID，必须使用字符串避免 JavaScript 精度丢失。 */
  resumeId: string
  /** 上游职位 jobId，投递时必须一并提交。 */
  jobId: string | number
}

export interface PositionApplyResult {
  status: string
  /** 投递记录可能是雪花 ID，必须保持字符串语义。 */
  applyId: string
  message: string
}

export interface PositionApplyRecord {
  id: string | number
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

export function getPositionApplyProgress(id: string | number) {
  return http.get<PositionApplyProgress>(`/miniapp/position-applies/${encodeURIComponent(String(id))}/progress`)
}
