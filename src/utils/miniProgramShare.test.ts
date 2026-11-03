import { describe, expect, it } from 'vitest'
import { createMiniProgramShare, createMiniProgramTimelineShare } from './miniProgramShare'

describe('createMiniProgramShare', () => {
  it('preserves the configured title and page path', () => {
    expect(createMiniProgramShare('上海泊之湾公寓', '/pages/index/index')).toEqual({
      title: '上海泊之湾公寓',
      path: '/pages/index/index',
    })
  })

  it('creates timeline data without an empty query', () => {
    expect(createMiniProgramTimelineShare('上海泊之湾公寓')).toEqual({
      title: '上海泊之湾公寓',
    })
  })

  it('preserves a timeline query when one is provided', () => {
    expect(createMiniProgramTimelineShare('上海泊之湾公寓 · 房源详情', 'id=property-1')).toEqual({
      title: '上海泊之湾公寓 · 房源详情',
      query: 'id=property-1',
    })
  })
})
