import { http } from '@/http/http'

export type LeaseStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'TERMINATED' | 'VOID' | 'EXPIRED'
export type LeaseAction = 'SIGN' | 'DECLINE' | 'RENEW_REQUEST' | 'RENEW_CANCEL' | 'MOVE_OUT_REQUEST'
export interface LeaseLog {
  id: string
  action: string
  actorType: string
  reason?: string
  createTime: string
}
export interface LeaseDetail {
  id: string
  propertyId: string
  propertyTitle: string
  propertyAddress: string
  tenantId: string
  landlordId: string
  title: string
  landlordName: string
  tenantName: string
  startDate: string
  endDate: string
  monthlyRent: number
  deposit: number
  terms: string
  status: LeaseStatus
  version: number
  contentHash: string
  tenantSignedAt?: string
  landlordSignedAt?: string
  tenantSignedName?: string
  landlordSignedName?: string
  previousLeaseId?: string
  renewalLeaseId?: string
  renewalLeaseStatus?: LeaseStatus
  renewalStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'
  requestedEndDate?: string
  renewalReason?: string
  moveOutStatus: 'NONE' | 'PENDING' | 'RESOLVED'
  daysRemaining: number
  renewalWindowDays?: number
  canRenew?: boolean
  isTenant: boolean
  isLandlord: boolean
  logs: LeaseLog[]
}
export interface LeaseActionInput {
  action: LeaseAction
  version: number
  reason?: string
  signedName?: string
  accepted?: boolean
  contentHash?: string
  requestedEndDate?: string
}
export const leaseStatusLabels: Record<LeaseStatus, string> = {
  DRAFT: '草稿',
  PENDING_SIGNATURE: '待双方签署',
  SIGNED: '双方已签署',
  EXPIRED: '租期已结束',
  TERMINATED: '已终止',
  VOID: '已作废',
}
export const leaseActionLabels: Record<string, string> = {
  CREATE: '创建合同',
  EDIT: '修改草稿',
  UPDATE: '修改草稿',
  PUBLISH: '发送签署',
  SIGN: '确认签署',
  DECLINE: '拒绝签署',
  VOID: '作废合同',
  TERMINATE: '终止合同',
  RENEW_REQUEST: '申请续租',
  RENEW_CANCEL: '撤销续租申请',
  RENEW_APPROVE: '同意续租并创建新合同',
  RENEW_REJECT: '拒绝续租申请',
  MOVE_OUT_REQUEST: '提交退租意向',
  MOVE_OUT_RESOLVE: '处理退租意向',
  REMIND: '租期提醒',
  EXPIRE: '租期结束',
}
export const renewalLabels = { NONE: '未申请续租', PENDING: '续租申请待处理', APPROVED: '续租申请已通过', REJECTED: '续租申请未通过', CANCELED: '续租申请已撤销' }

export function fetchLeases(params: { page: number, size: number, status?: string }) {
  return http.get<{ list: LeaseDetail[], total: number }>('/miniapp/property/leases', params)
}
export function fetchLease(id: string) {
  return http.get<LeaseDetail>(`/miniapp/property/leases/${encodeURIComponent(id)}`)
}
export function actOnLease(id: string, data: LeaseActionInput) {
  return http.post<void>(`/miniapp/property/leases/${encodeURIComponent(id)}/action`, data)
}
