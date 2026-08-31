export type WechatAuthorizationResult =
  | { status: 'binding_required'; code: string }
  | { status: 'unsupported'; message: string }
  | { status: 'failed'; message: string }

export interface WechatAuthorizationDependencies {
  isWechatMiniProgram?: () => boolean
  getCode?: () => Promise<string>
}

function detectWechatMiniProgram() {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  return false
}

async function requestWechatCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (response) => {
        if (response.code) {
          resolve(response.code)
          return
        }
        reject(new Error('微信未返回登录凭证'))
      },
      fail: error => reject(new Error(error.errMsg || '微信授权失败，请重试')),
    })
  })
}

/**
 * Obtains a WeChat Mini Program code without mutating auth state. The code is
 * later submitted with the phone verification code, so the backend can link
 * the WeChat identity to the phone-based account.
 */
export async function startWechatAuthorization(
  dependencies: WechatAuthorizationDependencies = {},
): Promise<WechatAuthorizationResult> {
  const isWechatMiniProgram = dependencies.isWechatMiniProgram ?? detectWechatMiniProgram
  if (!isWechatMiniProgram()) {
    return {
      status: 'unsupported',
      message: '请在微信小程序中使用微信登录',
    }
  }

  try {
    const code = await (dependencies.getCode ?? requestWechatCode)()
    return {
      status: 'binding_required',
      code,
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '微信授权失败，请重试'
    return {
      status: 'failed',
      message,
    }
  }
}
