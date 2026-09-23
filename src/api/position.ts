import { http } from '@/http/http'

export interface PositionFilterOption {
  value: string
  label: string
}

export interface PositionLocationOption extends PositionFilterOption {
  children?: PositionLocationOption[]
}

/** Include a parent location when all its selectable descendants are selected. */
export function collectSelectedLocationIds(options: PositionLocationOption[], selectedLeafIds: string[]): string[] {
  const selectedLeaves = new Set(selectedLeafIds)
  const selectedIds = new Set<string>()

  function visit(option: PositionLocationOption): boolean {
    if (!option.value || option.label.trim() === '全国')
      return false

    const children = (option.children || []).filter(child => child.value && child.label.trim() !== '全国')
    const allSelected = children.length
      ? children.map(visit).every(Boolean)
      : selectedLeaves.has(option.value)
    if (allSelected)
      selectedIds.add(option.value)
    return allSelected
  }

  options.forEach(visit)
  return Array.from(selectedIds)
}

export interface PositionFilterOptions {
  kinds: PositionFilterOption[]
  /** 招聘分类由后端筛选字典提供，包含社会、校园和实习生招聘等。 */
  categories: PositionFilterOption[]
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
  failedReason?: string
  /**
   * 招聘职位名称
   */
  jobTitle: string
  /**
   * 招聘流程名称
   */
  processName: string
  /**
   * 当前流程阶段名称
   */
  phaseName: string
  /**
   * 当前阶段状态名称
   */
  statusName: string
  /**
   * 投递时间
   */
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
  /** 招聘者头像，来自麟才岗位列表/热门岗位接口。 */
  publisherAvatar?: string
  /** 招聘者姓名，来自麟才岗位列表/热门岗位接口。 */
  publisherName?: string
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

export type PositionApplyStatus = 'SUCCESS' | 'PROCESSING' | 'FAILED'

export interface PositionApplyResult {
  status: PositionApplyStatus | string
  /** 本地投递记录 ID，雪花 ID 必须保持字符串语义。 */
  applyRecordId: string
  /** 兼容旧后端字段，新的后端使用 applyRecordId。 */
  applyId?: string
  message: string
}

export interface PositionApplyRecord {
  id: string | number
  resumeId: string
  resumeName?: string
  positionId: string
  importStatus: string
  failedReason?: string
  /** 招聘职位名称（部分接口返回 positionName，兼容两种字段名） */
  jobTitle?: string
  positionName?: string
  processName: string
  phaseName: string
  statusName: string
  createTime: string
  salaryMin?: number
  salaryMax?: number
  salaryUnit?: string
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

export interface PositionShares {
  id: string
  positionCount: number
  createTime: string
}

export interface PositionShareListData {
  list: PositionShareItem[]
  total: number
}

export interface PositionShareItem {
  id: string
  positionCount: number
  positions: PositionListItem[]
  createTime: string
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

/**
 * 查询投递记录
 */
export function getPositionApplies() {
  return http.get<PositionApplyRecord[]>('/miniapp/position-applies')
}

export function getPositionApplyProgress(id: string | number) {
  return http.get<PositionApplyProgress>(`/miniapp/position-applies/${encodeURIComponent(String(id))}/progress`)
}

/**
 * 查询职位分享记录-我的分享
 */
export interface PositionSharesQuery {
  pageNum: number
  pageSize: number
}

export function getPositionShares(query: PositionSharesQuery) {
  return http.get<PositionShareListData>(`/miniapp/position-shares`, query)
}

/*
创建职位分享
*/
export function createPositionShares(positionIds: string[]) {
  return http.post<PositionShares>(`/miniapp/position-shares`, { positionIds })
}

/*
查询分享记录中的职位-用于分享卡片点击后的职位列表展示
*/
export function getPositionShareList(shareId: string) {
  return http.get<PositionListItem[]>(`/miniapp/position-shares/${shareId}/positions`)
}
