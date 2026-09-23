import { describe, expect, it } from 'vitest'
import { isPageBackSwipe } from './aiSwipe'

describe('ai page left swipe', () => {
  it('accepts a deliberate horizontal left swipe', () => {
    expect(isPageBackSwipe({ x: 320, y: 400 }, { x: 210, y: 420 })).toBe(true)
  })

  it('accepts the native-style swipe from the left edge', () => {
    expect(isPageBackSwipe({ x: 20, y: 400 }, { x: 130, y: 420 })).toBe(true)
  })

  it('ignores right swipes and short movements', () => {
    expect(isPageBackSwipe({ x: 210, y: 400 }, { x: 320, y: 420 })).toBe(false)
    expect(isPageBackSwipe({ x: 320, y: 400 }, { x: 260, y: 420 })).toBe(false)
  })

  it('ignores vertical scrolling', () => {
    expect(isPageBackSwipe({ x: 320, y: 400 }, { x: 210, y: 500 })).toBe(false)
  })
})
