import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_AUTH_REDIRECT, navigateAfterAuthenticated, resolveAuthRedirect } from './navigation'

describe('resolveAuthRedirect', () => {
  it('uses the home page when a redirect is absent or malformed', () => {
    expect(resolveAuthRedirect()).toBe(DEFAULT_AUTH_REDIRECT)
    expect(resolveAuthRedirect('%E0%A4%A')).toBe(DEFAULT_AUTH_REDIRECT)
  })

  it('accepts only internal uni-app routes', () => {
    expect(resolveAuthRedirect(encodeURIComponent('/pages/me/me?tab=profile'))).toBe('/pages/me/me?tab=profile')
    expect(resolveAuthRedirect('https%3A%2F%2Fevil.example')).toBe(DEFAULT_AUTH_REDIRECT)
    expect(resolveAuthRedirect('%2F%2Fevil.example')).toBe(DEFAULT_AUTH_REDIRECT)
  })

  it('uses the platform-appropriate navigation method after authentication', () => {
    navigateAfterAuthenticated('/pages/index/index')
    expect(uni.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' })

    navigateAfterAuthenticated('/pages/auth/privacy')
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/auth/privacy' })
  })

  it('returns to the source page when the login page was opened from it', () => {
    vi.stubGlobal('getCurrentPages', vi.fn().mockReturnValue([
      { route: 'pages/position/detail' },
      { route: 'pages/auth/login' },
    ]))

    navigateAfterAuthenticated('/pages/position/detail?id=1')
    expect(uni.navigateBack).toHaveBeenCalledWith({ delta: 1 })
  })
})
