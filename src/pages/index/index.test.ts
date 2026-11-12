import type { Property } from '@/api/property'
import { flushPromises, mount } from '@vue/test-utils'
import { vi } from 'vitest'
import IndexPage from './index.vue'

const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  load: undefined as undefined | (() => void),
  more: undefined as undefined | (() => void),
  unload: undefined as undefined | (() => void),
}))
vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (fn: () => void) => { state.load = fn },
  onReachBottom: (fn: () => void) => { state.more = fn },
  onUnload: (fn: () => void) => { state.unload = fn },
  onPullDownRefresh: vi.fn(),
  onShow: vi.fn(),
  onShareAppMessage: vi.fn(),
  onShareTimeline: vi.fn(),
}))
vi.mock('@/api/property', () => ({ fetchProperties: state.fetch, PROPERTY_TYPE_LABEL: { house: '住宅', apartment: '公寓' } }))
vi.mock('@/utils/messageBadge', () => ({ refreshMessageBadge: vi.fn() }))

function property(id: string): Property {
  return { id, title: `房源${id}`, price: 2000, priceType: 'rent', propertyType: 'apartment', images: [] } as unknown as Property
}
function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find(item => item.text() === text)!
}
async function render() {
  const wrapper = mount(IndexPage, {
    global: {
      stubs: { picker: { template: '<div class="picker-stub"><slot /></div>' } },
    },
  })
  state.load?.()
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.stubGlobal('definePage', vi.fn())
  state.fetch.mockReset().mockResolvedValue({ list: [property('1')], total: 3 })
})
afterEach(() => vi.unstubAllGlobals())

describe('首页搜索与分页', () => {
  it('分页只使用已提交条件，不使用尚未搜索的文字', async () => {
    const wrapper = await render()
    await wrapper.get('input[aria-label="房源关键词"]').setValue('未提交')
    state.more?.()
    await flushPromises()
    expect(state.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, keyword: undefined }))
    await button(wrapper, '搜索').trigger('tap')
    await flushPromises()
    expect(state.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, keyword: '未提交' }))
    wrapper.unmount()
  })

  it('反向价格区间保留现有列表并显示错误', async () => {
    const wrapper = await render()
    await button(wrapper, '城市 · 价格区间').trigger('tap')
    await wrapper.get('input[aria-label="最低价格"]').setValue('4000')
    await wrapper.get('input[aria-label="最高价格"]').setValue('2000')
    await button(wrapper, '应用筛选').trigger('tap')
    expect(state.fetch).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('最低价格不能高于最高价格')
    expect(wrapper.text()).toContain('房源1')
    wrapper.unmount()
  })

  it('组合筛选后重置所有条件与排序', async () => {
    const wrapper = await render()
    await wrapper.get('input[aria-label="房源关键词"]').setValue(' 泊之湾 ')
    await button(wrapper, '城市 · 价格区间').trigger('tap')
    await wrapper.get('input[aria-label="城市筛选"]').setValue('上海')
    await wrapper.get('input[aria-label="最低价格"]').setValue('0')
    await wrapper.findAll('.picker-stub')[1].trigger('change', { detail: { value: 2 } })
    await flushPromises()
    expect(state.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, keyword: '泊之湾', city: '上海', minPrice: 0, sort: 'priceDesc' }))
    await button(wrapper, '重置筛选').trigger('tap')
    await flushPromises()
    expect(state.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, keyword: undefined, city: undefined, minPrice: undefined, sort: 'newest' }))
    wrapper.unmount()
  })

  it('旧查询返回时不会覆盖新的搜索结果', async () => {
    const wrapper = await render()
    let resolveOld!: (result: { list: Property[], total: number }) => void
    state.fetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveOld = resolve
    }))
    await wrapper.get('input[aria-label="房源关键词"]').setValue('旧查询')
    await button(wrapper, '搜索').trigger('tap')
    state.fetch.mockResolvedValueOnce({ list: [property('新')], total: 1 })
    await wrapper.get('input[aria-label="房源关键词"]').setValue('新查询')
    await button(wrapper, '搜索').trigger('tap')
    await flushPromises()
    resolveOld({ list: [property('旧')], total: 1 })
    await flushPromises()
    expect(wrapper.text()).toContain('房源新')
    expect(wrapper.text()).not.toContain('房源旧')
    wrapper.unmount()
  })

  it('空结果支持返回全部房源，网络失败支持重试', async () => {
    state.fetch.mockResolvedValueOnce({ list: [], total: 0 })
    const wrapper = await render()
    expect(wrapper.text()).toContain('房源还在准备中')
    state.fetch.mockRejectedValueOnce(new Error('network'))
    await wrapper.get('input[aria-label="房源关键词"]').setValue('查询')
    await button(wrapper, '搜索').trigger('tap')
    await flushPromises()
    expect(wrapper.text()).toContain('房源加载失败')
    state.fetch.mockResolvedValueOnce({ list: [], total: 0 })
    await button(wrapper, '重新加载').trigger('tap')
    await flushPromises()
    expect(wrapper.text()).toContain('没有找到符合条件的房源')
    await button(wrapper, '查看全部房源').trigger('tap')
    await flushPromises()
    expect(state.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: undefined }))
    wrapper.unmount()
  })
})
