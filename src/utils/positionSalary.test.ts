import { describe, expect, it } from 'vitest'
import { formatPositionSalary } from './positionSalary'

describe('formatPositionSalary', () => {
  it('treats zero salary ranges as negotiable', () => {
    expect(formatPositionSalary({
      salaryMin: 0,
      salaryMax: 0,
      salaryUnit: '月薪',
    })).toBe('面议')
  })

  it('formats a monthly salary range in the shared position-list format', () => {
    expect(formatPositionSalary({
      salaryMin: 15000,
      salaryMax: 25000,
      salaryUnit: '月薪',
    })).toBe('15K-25K/月')
  })
})
