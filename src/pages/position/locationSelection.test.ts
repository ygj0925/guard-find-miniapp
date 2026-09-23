import { describe, expect, it } from 'vitest'
import { collectSelectedLocationIds } from '@/api/position'

const locations = [
  { value: '', label: '全国' },
  {
    value: '31',
    label: '上海市',
    children: [
      { value: '3101', label: '市辖区', children: [{ value: '310101', label: '黄浦区' }, { value: '310104', label: '徐汇区' }] },
      { value: '3102', label: '郊区' },
    ],
  },
  { value: '32', label: '江苏省', children: [{ value: '3201', label: '南京市' }] },
]

describe('collectSelectedLocationIds', () => {
  it('sends all selected child ids and their fully selected parent ids', () => {
    expect(collectSelectedLocationIds(locations, ['310101', '310104', '3102']))
      .toEqual(['310101', '310104', '3101', '3102', '31'])
  })

  it('does not send partially selected parents or nationwide', () => {
    expect(collectSelectedLocationIds(locations, ['310101', '3201']))
      .toEqual(['310101', '3201', '32'])
  })

  it('returns no ids for nationwide (no restriction)', () => {
    expect(collectSelectedLocationIds(locations, [])).toEqual([])
  })
})
