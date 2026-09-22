import { describe, expect, it } from 'vitest'
import { createMiniProgramShare, createMiniProgramTimelineShare } from './miniProgramShare'

describe('createMiniProgramShare', () => {
  it('preserves the configured title and page path', () => {
    expect(createMiniProgramShare('生生智家 - 职位', '/pages/position/index')).toEqual({
      title: '生生智家 - 职位',
      path: '/pages/position/index',
    })
  })

  it('creates timeline data without an empty query', () => {
    expect(createMiniProgramTimelineShare('生生智家')).toEqual({
      title: '生生智家',
    })
  })

  it('preserves a timeline query when one is provided', () => {
    expect(createMiniProgramTimelineShare('研发工程师', 'id=position-1')).toEqual({
      title: '研发工程师',
      query: 'id=position-1',
    })
  })
})
