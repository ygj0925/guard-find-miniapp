import { describe, expect, it } from 'vitest'
import { getBannerPositionCategory } from './bannerPositionCategory'

describe('getBannerPositionCategory', () => {
  it('reads campus category from a position banner target', () => {
    expect(getBannerPositionCategory('pages/position/index?category=2')).toBe('2')
    expect(getBannerPositionCategory('/pages/position/index?source=banner&category=1')).toBe('1')
  })

  it('ignores unrelated routes and invalid categories', () => {
    expect(getBannerPositionCategory('pages/index/index?category=2')).toBe('')
    expect(getBannerPositionCategory('pages/position/index?category=3')).toBe('')
    expect(getBannerPositionCategory('pages/position/index?other=category=2')).toBe('')
  })
})
