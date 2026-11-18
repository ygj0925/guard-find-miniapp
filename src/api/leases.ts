import { http } from '@/http/http'

export interface SignaturePoint {
  x: number
  y: number
}
export interface Handwriting {
  strokes: SignaturePoint[][]
}
export interface LeaseSignature {
  id: string
  signerRole: 'TENANT' | 'LANDLORD'
  signedName: string
  signedAt: string
  contentHash: string
  signatureHash: string
  recordHash: string
  handwriting: Handwriting
  imageBase64: string
  sealBase64?: string
}
export interface SigningAsset {
  id: string
  imageBase64: string
  handwriting?: Handwriting
}
export interface SigningProfile {
  handwriting?: SigningAsset
  seal?: SigningAsset
}
export type LeaseStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'TERMINATED' | 'VOID' | 'EXPIRED' | 'SIGNING_EXPIRED'
export type LeaseAction = 'SIGN' | 'DECLINE' | 'RENEW_REQUEST' | 'RENEW_CANCEL' | 'MOVE_OUT_REQUEST' | 'MOVE_OUT_CANCEL'
export interface LeaseLog {
  id: string
  action: string
  actorType: string
  reason?: string
  createTime: string
}
export interface LeaseDetail {
  publishedVersion?: number
  unresolvedReviews?: number
  reviews?: LeaseReview[]
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
  signatures?: LeaseSignature[]
  signingConsent?: string
  signatureDeadline?: string
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
  handwriting?: Handwriting
  saveSignature?: boolean
  sealId?: string
  /** Identity verification session used for a required signing gate. */
  verificationId?: string
}
export const leaseStatusLabels: Record<LeaseStatus, string> = {
  DRAFT: '草稿',
  PENDING_SIGNATURE: '待双方签署',
  SIGNED: '双方已签署',
  EXPIRED: '租期已结束',
  TERMINATED: '已终止',
  VOID: '已作废',
  SIGNING_EXPIRED: '签署已超时',
}
export const leaseActionLabels: Record<string, string> = {
  REVIEW_CREATE: '提出审阅意见',
  REVIEW_REPLY: '回复审阅意见',
  REVIEW_CONFIRM: '确认意见已解决',
  REVIEW_REOPEN: '继续反馈审阅意见',
  BILL_CREATE: '创建费用账单',
  BILL_GENERATE: '生成周期账单',
  BILL_SUBMIT: '登记线下付款',
  BILL_WITHDRAW: '撤回付款登记',
  BILL_CONFIRM: '确认收到款项',
  BILL_REJECT: '退回付款登记',
  BILL_VOID: '作废费用账单',
  CHECK_IN_CREATE: '发起入住交接',
  CHECK_IN_CONFIRM: '确认入住交接',
  CHECK_IN_DISPUTE: '入住交接异议',
  CHECK_IN_VOID: '作废入住交接',
  CHECK_OUT_CREATE: '发起退租交接',
  CHECK_OUT_CONFIRM: '确认退租交接',
  CHECK_OUT_DISPUTE: '退租交接异议',
  CHECK_OUT_VOID: '作废退租交接',
  SETTLEMENT_CREATE: '发起押金结算',
  SETTLEMENT_CONFIRM: '确认押金结算',
  SETTLEMENT_DISPUTE: '押金结算异议',
  SETTLEMENT_VOID: '作废押金结算',
  SETTLEMENT_REFUND: '登记押金退款',
  SETTLEMENT_RECEIVED: '承租人确认押金到账',
  PROPERTY_REOPEN: '确认房源重新开放',
  CREATE: '创建合同',
  EDIT: '修改草稿',
  UPDATE: '修改草稿',
  PUBLISH: '发送签署',
  SIGN: '确认签署',
  RECALL: '撤回待签合同',
  REMIND_SIGN: '发送待签提醒',
  DECLINE: '拒绝签署',
  VOID: '作废合同',
  TERMINATE: '终止合同',
  RENEW_REQUEST: '申请续租',
  RENEW_CANCEL: '撤销续租申请',
  RENEW_APPROVE: '同意续租并创建新合同',
  RENEW_REJECT: '拒绝续租申请',
  MOVE_OUT_REQUEST: '提交退租意向',
  MOVE_OUT_RESOLVE: '处理退租意向',
  MOVE_OUT_CANCEL: '撤回退租意向',
  SIGNING_EXPIRED: '签署超时失效',
  REMIND: '租期提醒',
  EXPIRE: '租期结束',
}
export const renewalLabels = { NONE: '未申请续租', PENDING: '续租申请待处理', APPROVED: '续租申请已通过', REJECTED: '续租申请未通过', CANCELED: '续租申请已撤销' }
export function fetchLeases(params: {
  page: number
  size: number
  status?: string
}) {
  return http.get<{
    list: LeaseDetail[]
    total: number
  }>('/miniapp/property/leases', params)
}
export function fetchLease(id: string) {
  return http.get<LeaseDetail>(`/miniapp/property/leases/${encodeURIComponent(id)}`)
}
export function actOnLease(id: string, data: LeaseActionInput) {
  return http.post<void>(`/miniapp/property/leases/${encodeURIComponent(id)}/action`, data)
}
export const fetchSigningProfile = () => http.get<SigningProfile>('/miniapp/property/signing-profile')
export interface LeaseReview {
  id: string
  authorRole: 'TENANT' | 'LANDLORD'
  clauseLabel: string
  content: string
  reply?: string
  status: 'OPEN' | 'REPLIED' | 'RESOLVED'
  version: number
  currentRound: boolean
  canConfirm: boolean
  createTime: string
}
export interface LeaseReviewInput {
  action: 'CREATE' | 'CONFIRM' | 'REOPEN'
  publishedVersion?: number
  contentHash: string
  reviewId?: string
  version?: number
  clauseLabel?: string
  content?: string
}
export const reviewLease = (id: string, input: LeaseReviewInput) => http.post<void>(`/miniapp/property/leases/${encodeURIComponent(id)}/reviews`, input)
export const removeSigningAsset = (kind: 'HANDWRITING' | 'SEAL') => http.delete<void>(`/miniapp/property/signing-profile/${kind}`)
export function fetchLeasePdf(id: string) {
  return http.get<{
    filename: string
    base64: string
  }>(`/miniapp/property/leases/${encodeURIComponent(id)}/pdf`)
}
