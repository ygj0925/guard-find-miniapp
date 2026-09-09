import { http } from '@/http/http'

/**
 * 消息业务类型，对应后端 MiniappMessageBizTypeEnum，小程序按它渲染不同的 UI 卡片。
 *
 * - APPLY_PROGRESS：投递进度变更，麟才回调候选人状态流转时发送
 * - OFFER_CONFIRM：Offer 待确认，提醒候选人在截止时间前确认（后端预留，暂未发送）
 * - PRE_ONBOARD：预入职通知，告知报到日期与入职准备事项（后端预留，暂未发送）
 */
export type MiniappMessageBizType = 'APPLY_PROGRESS' | 'OFFER_CONFIRM' | 'PRE_ONBOARD'

/** 投递进度变更的业务数据。 */
export interface ApplyProgressData {
  /** 投递记录主键，用于跳转进度页 */
  applyId: number | string
  positionName: string
  /** 新阶段名称，如"第四轮面试" */
  phaseName: string
  /** 新状态名称，如"本轮待定" */
  statusName: string
}

/** Offer 待确认的业务数据（后端预留类型）。 */
export interface OfferConfirmData {
  offerId: number | string
  positionName: string
  /** 确认截止日期 */
  deadline: string
}

/** 预入职通知的业务数据（后端预留类型）。 */
export interface PreOnboardData {
  applyId: number | string
  positionName: string
  /** 报到日期 */
  onboardDate: string
}

/** 各业务类型 data 的联合，取值前先用 bizType 判别。 */
export type MiniappMessageData = ApplyProgressData | OfferConfirmData | PreOnboardData

/**
 * 小程序消息列表项，对应后端 MiniappMessageResp。
 *
 * bizType/data 成对出现：结构化消息两者都有，结构化改造前的历史消息两者都为空。
 *
 * 这里刻意不用可辨识联合——Vue 的 ref() 会对联合类型做深层展开，导致 data 无法再按 bizType 收窄，
 * 反而要在每个使用处加断言。改为可选字段后，渲染处用 dataOf() 之类的辅助函数按类型取值即可。
 */
export interface MiniappMessage {
  id: number | string
  title: string
  type: number
  /** 业务类型，历史纯文本消息为空 */
  bizType?: MiniappMessageBizType
  /** 业务数据，字段随 bizType 不同；历史纯文本消息为空 */
  data?: MiniappMessageData
  path?: string
  isRead: boolean
  readTime?: string
  createTime: string
}

/** 小程序消息详情，对应后端 MiniappMessageDetailResp。 */
export interface MiniappMessageDetail {
  id: number | string
  title: string
  /** 纯文本内容，仅结构化改造前的历史消息有值；结构化消息为空，改用 bizType + data 渲染 */
  content?: string
  type: number
  bizType?: MiniappMessageBizType
  data?: MiniappMessageData
  path?: string
  createTime: string
}

export interface MiniappMessagePageData {
  list: MiniappMessage[]
  total: number
}

/** 查询未读消息数量，onShow、收到 WS 信号、轮询时均调用。 */
export function getMiniappMessageUnreadCount() {
  return http.get<number>('/miniapp/messages/unread', undefined, undefined, { hideErrorToast: true })
}

/** 分页查询消息列表，isRead 为空则不过滤。 */
export function getMiniappMessagePage(params: { page: number, size: number, isRead?: boolean }) {
  return http.get<MiniappMessagePageData>('/miniapp/messages', params)
}

/** 查询消息详情，后端会同时标记该消息已读。 */
export function getMiniappMessageDetail(id: number | string) {
  return http.get<MiniappMessageDetail>(`/miniapp/messages/${id}`)
}

/** 全部消息标记已读。 */
export function readAllMiniappMessages() {
  return http<void>({
    url: '/miniapp/messages/read',
    method: 'PATCH' as any,
  })
}
