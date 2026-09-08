import { http } from '@/http/http'

/** AI 聊天页快捷问题，对应后端 MiniappRecommendMessageResp。 */
export interface MiniappRecommendMessage {
  id: string | number
  topic: string
  displayMessage: string
  actualMessage: string
}

/** 查询后台已启用的快捷问题，返回顺序由后端配置决定。 */
export function getMiniappRecommendMessages() {
  return http.get<MiniappRecommendMessage[]>(
    '/miniapp/recommend-messages',
    undefined,
    undefined,
    { hideErrorToast: true },
  )
}
