import { expect, it } from 'vitest'
import { regionCityNames, regionColumns } from './regions'

it('preserves official municipality codes while providing three picker columns', () => {
  const tree = [{ code: 110000, name: '北京市', children: [{ code: 110101, name: '东城区', children: [] }] }]
  const result = regionColumns(tree)
  expect(result[0].children[0].name).toBe('北京市')
  expect(result[0].children[0].children[0].code).toBe(110101)
  expect(tree[0].children[0].name).toBe('东城区')
})
it('keeps city-only and province-only official entries selectable without inventing codes', () => {
  const tree = [{ code: 810000, name: '香港特别行政区', children: [] }, { code: 440000, name: '广东省', children: [{ code: 441900, name: '东莞市', children: [] }] }]
  const result = regionColumns(tree)
  expect(result[0].children[0].children[0].code).toBe(810000)
  expect(result[1].children[0].children[0].code).toBe(441900)
  expect(regionCityNames(tree)).toEqual(['香港特别行政区', '东莞市'])
})
it('offers province-administered counties as cities without inventing intermediary codes', () => {
  expect(regionCityNames([{ code: 420000, name: '湖北省', children: [{ code: 429004, name: '仙桃市', children: [] }] }])).toEqual(['仙桃市'])
})
