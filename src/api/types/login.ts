/** /miniapp/auth/login 返回的单 token */
export interface IAuthLoginRes {
  token: string
  /** 有效期(秒) */
  expiresIn?: number
}

/** /miniapp/auth/me 返回的当前用户 */
export interface IUserInfoRes {
  userId: string | number
  username: string
  nickname: string
  avatar?: string
  /** 房源管家(运营方)身份:仅管家可发布与维护房源 */
  isPropertyManager?: boolean
}
