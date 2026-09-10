import { describe, expect, it, vi } from 'vitest'
import { startWechatAuthorization } from './wechat-auth'

describe('startWechatAuthorization', () => {
  it('returns unsupported outside WeChat Mini Program', async () => {
    const result = await startWechatAuthorization({
      isWechatMiniProgram: () => false,
    })

    expect(result).toEqual({
      status: 'unsupported',
      message: '请在微信小程序中使用微信登录',
    })
  })

  it('returns a fresh WeChat login code without mutating auth state', async () => {
    const getCode = vi.fn(async () => 'mock-wechat-code')
    const result = await startWechatAuthorization({
      isWechatMiniProgram: () => true,
      getCode,
    })

    expect(result).toEqual({
      status: 'binding_required',
      code: 'mock-wechat-code',
    })
    expect(getCode).toHaveBeenCalledOnce()
  })

  it('surfaces authorization failures', async () => {
    const result = await startWechatAuthorization({
      isWechatMiniProgram: () => true,
      getCode: async () => Promise.reject(new Error('用户取消授权')),
    })

    expect(result).toEqual({
      status: 'failed',
      message: '用户取消授权',
    })
  })
})
