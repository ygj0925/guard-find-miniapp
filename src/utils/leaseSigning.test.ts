import { describe, expect, it } from 'vitest'
import { hasHandwriting } from './leaseSigning'

describe('signature validation', () => {
  it('rejects a blank pad, taps and straight accidental marks', () => {
    expect(hasHandwriting({ strokes: [] })).toBe(false)
    expect(hasHandwriting({ strokes: [[{ x: 100, y: 100 }]] })).toBe(false)
    expect(hasHandwriting({ strokes: [Array.from({ length: 10 }, (_, i) => ({ x: i * 50, y: 100 }))] })).toBe(false)
  })
  it('requires finite points inside the signature canvas', () => {
    expect(hasHandwriting({ strokes: [Array.from({ length: 10 }, (_, i) => ({ x: i * 100, y: i * 50 }))] })).toBe(false)
    expect(hasHandwriting({ strokes: [Array.from({ length: 10 }, () => ({ x: Number.NaN, y: 100 }))] })).toBe(false)
  })
})
