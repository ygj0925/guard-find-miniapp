import { buildPropertyFilters, defaultPropertyFilters } from './propertyFilters'

describe('房源搜索条件', () => {
  it('默认不提交全部筛选值，保留最新排序', () => {
    expect(buildPropertyFilters(defaultPropertyFilters())).toEqual({
      keyword: undefined,
      city: undefined,
      propertyType: undefined,
      priceType: undefined,
      rentalMode: undefined,
      priceUnit: undefined,
      recommended: undefined,
      activityId: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sort: 'newest',
    })
  })

  it('去除文字首尾空白，保留零价格和同价范围', () => {
    const result = buildPropertyFilters({ ...defaultPropertyFilters(), keyword: ' 泊之湾 ', city: ' 上海 ', minPrice: '0', maxPrice: '0' })
    expect(result).toMatchObject({ keyword: '泊之湾', city: '上海', minPrice: 0, maxPrice: 0 })
  })

  it('只在出租时提交租赁方式', () => {
    const draft = { ...defaultPropertyFilters(), priceType: 'rent' as const, rentalMode: 'whole' as const }
    expect(buildPropertyFilters(draft).rentalMode).toBe('whole')
    expect(buildPropertyFilters({ ...draft, priceType: 'sale' }).rentalMode).toBeUndefined()
  })

  it.each(['-1', '1e3', '12abc', '0.001', '10000000000', 'Infinity'])('拒绝无效金额 %s', (minPrice) => {
    expect(() => buildPropertyFilters({ ...defaultPropertyFilters(), minPrice })).toThrow('价格应为非负金额')
  })

  it('支持单边区间和两位小数', () => {
    expect(buildPropertyFilters({ ...defaultPropertyFilters(), maxPrice: '3000.50' })).toMatchObject({ minPrice: undefined, maxPrice: 3000.5 })
  })

  it('区间反向时不发起查询', () => {
    expect(() => buildPropertyFilters({ ...defaultPropertyFilters(), minPrice: '4000', maxPrice: '3000' })).toThrow('最低价格不能高于最高价格')
  })

  it('限制文字长度', () => {
    expect(() => buildPropertyFilters({ ...defaultPropertyFilters(), keyword: 'a'.repeat(65) })).toThrow('最多64个字')
  })

  it('结果是查询快照，不随未提交的输入改变', () => {
    const draft = { ...defaultPropertyFilters(), keyword: '公寓', minPrice: '2000', sort: 'priceAsc' as const }
    const applied = buildPropertyFilters(draft)
    draft.keyword = '未搜索的内容'
    draft.minPrice = '5000'
    expect(applied).toMatchObject({ keyword: '公寓', minPrice: 2000, sort: 'priceAsc' })
  })
})
