import { http } from '@/http/http'
import { isSuccessResultCode } from '@/http/tools/enum'

export interface LeaseBill {
  id: string
  kind: 'RENT' | 'DEPOSIT' | 'OTHER'
  title: string
  periodStart: string
  periodEnd: string
  dueDate: string
  amount: number
  status: 'UNPAID' | 'OVERDUE' | 'PENDING_CONFIRMATION' | 'PAID' | 'VOID'
  version: number
  paymentReference?: string
  paymentFileId?: string
  paidDate?: string
  confirmedAt?: string
}
export interface LeaseDocument {
  id: string
  kind: 'CHECK_IN' | 'CHECK_OUT' | 'SETTLEMENT'
  status: 'PENDING' | 'DISPUTED' | 'CONFIRMED' | 'REFUND_PENDING' | 'REFUNDED' | 'CLOSED' | 'VOID'
  version: number
  contentHash: string
  tenantConfirmedAt?: string
  landlordConfirmedAt?: string
  refundReference?: string
  refundDate?: string
  refundReceivedAt?: string
  content: {
    date: string
    note: string
    inventory?: string
    condition?: string
    water?: string
    electricity?: string
    gas?: string
    keys?: number
    depositHeld?: number
    deductionTotal?: number
    refundAmount?: number
    deductions?: { title: string, amount: number }[]
    photos?: string[]
  }
}
export interface LeaseLifecycle { bills: LeaseBill[], documents: LeaseDocument[], amountDue: number, amountPaid: number, amountPending: number }
export interface LifecycleAction { action: string, version: number, reference?: string, paidDate?: string, reason?: string, contentHash?: string, fileId?: string }
export const billLabels = { UNPAID: '待缴费', OVERDUE: '已逾期', PENDING_CONFIRMATION: '付款待确认', PAID: '已收款', VOID: '已作废' }
export const documentLabels = { CHECK_IN: '入住交接单', CHECK_OUT: '退租交接单', SETTLEMENT: '押金结算单' }
export const documentStateLabels = { PENDING: '待双方确认', DISPUTED: '有异议，待处理', CONFIRMED: '双方已确认', REFUND_PENDING: '待退押金', REFUNDED: '已登记退款，待收款确认', CLOSED: '结算完成', VOID: '已作废' }
export const fetchLeaseLifecycle = (id: string) => http.get<LeaseLifecycle>(`/miniapp/property/leases/${id}/lifecycle`)
export const actOnBill = (id: string, billId: string, data: LifecycleAction) => http.post<void>(`/miniapp/property/leases/${id}/bills/${billId}/action`, data)
export const actOnDocument = (id: string, documentId: string, data: LifecycleAction) => http.post<void>(`/miniapp/property/leases/${id}/documents/${documentId}/action`, data)
export const fetchLeaseFile = (id: string, fileId: string) => http.get<{ mimeType: string, data: string }>(`/miniapp/property/leases/${id}/files/${fileId}`)
export function uploadLeaseFile(id: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `/miniapp/property/leases/${id}/files`,
      name: 'file',
      filePath,
      timeout: 60000,
      success(response) {
        try {
          const result = JSON.parse(response.data) as { code: number | string, msg?: string, data?: { id?: string } }
          const uploadedId = result.data?.id
          if (response.statusCode < 200 || response.statusCode >= 300 || !['number', 'string'].includes(typeof result.code) || String(result.code).trim() === '' || !isSuccessResultCode(Number(result.code)) || typeof uploadedId !== 'string' || !/^[1-9]\d*$/.test(uploadedId))
            throw new Error(result.msg || '照片上传失败')
          resolve(uploadedId)
        }
        catch (error) { reject(error instanceof Error ? error : new Error('照片上传失败')) }
      },
      fail: () => reject(new Error('照片上传失败，请重试')),
    })
  })
}
