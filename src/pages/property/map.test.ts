import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import MapPage from './map.vue'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), communities: vi.fn(), load: undefined as undefined | ((query: Record<string, string>) => void), unload: undefined as undefined | (() => void) }))
vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (fn: typeof mocks.load) => {
    mocks.load = fn
  },
  onUnload: (fn: typeof mocks.unload) => {
    mocks.unload = fn
  },
}))
vi.mock('@/api/propertyMap', () => ({ fetchMapProperties: mocks.fetch, fetchCommunities: mocks.communities, fetchRegionSource: vi.fn().mockResolvedValue({ version: '2024-12-31' }) }))
vi.mock('@/api/property', () => ({ fetchRegionTree: vi.fn().mockResolvedValue([]) }))
const item = { id: '9007199254740993', title: '南向两室', city: '上海市', community: '泊之湾', price: 2000, priceType: 'rent', priceUnit: 'month', latitude: 31.2, longitude: 121.5, locationLabel: '小区南门' }
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  vi.stubGlobal('definePage', vi.fn())
  vi.stubGlobal('uni', { navigateTo: vi.fn(), openLocation: vi.fn(), showToast: vi.fn(), getLocation: vi.fn() })
  mocks.fetch.mockReset().mockResolvedValue({ list: [item], truncated: false })
  mocks.communities.mockReset().mockResolvedValue([])
})
afterEach(() => {
  mocks.unload?.()
  wrapper?.unmount()
  vi.unstubAllGlobals()
})
async function open() {
  wrapper = mount(MapPage)
  mocks.load?.({ city: '上海市' })
  await flushPromises()
}
function button(label: string) {
  return wrapper.findAll('button').find(node => node.text() === label)!
}
it('opens the precise property ID and navigates to the public entrance', async () => {
  await open()
  await button('查看房源').trigger('tap')
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/property/detail?id=9007199254740993' })
  await button('导航到这里').trigger('tap')
  expect(uni.openLocation).toHaveBeenCalledWith(expect.objectContaining({ latitude: 31.2, longitude: 121.5, address: '小区南门' }))
})
it('ignores late searches and makes truncation explicit', async () => {
  let resolve!: (value: unknown) => void
  mocks.fetch.mockReturnValueOnce(new Promise((done) => {
    resolve = done
  }))
  await open()
  mocks.fetch.mockResolvedValueOnce({ list: [{ ...item, title: '新结果' }], truncated: true })
  await button('搜索').trigger('tap')
  await flushPromises()
  resolve({ list: [{ ...item, title: '旧结果' }], truncated: false })
  await flushPromises()
  expect(wrapper.text()).toContain('新结果')
  expect(wrapper.text()).not.toContain('旧结果')
  expect(wrapper.text()).toContain('超过 200')
})
it('does not request location before the user asks and offers recovery after failure', async () => {
  mocks.fetch.mockRejectedValueOnce(new Error('offline'))
  await open()
  expect(uni.getLocation).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('加载失败')
  await button('重试').trigger('tap')
  await flushPromises()
  expect(wrapper.text()).toContain('南向两室')
  await button('我的附近').trigger('tap')
  expect(uni.getLocation).toHaveBeenCalledWith(expect.objectContaining({ type: 'gcj02' }))
})
it('rejects reversed price ranges before sending a request', async () => {
  await open()
  await wrapper.get('input[aria-label="最低价格"]').setValue('9000')
  await wrapper.get('input[aria-label="最高价格"]').setValue('1000')
  await button('搜索').trigger('tap')
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('最低价格不能高于最高价格')
})
it('selecting a community searches its exact city and district', async () => {
  await open()
  vi.useFakeTimers()
  mocks.communities.mockResolvedValue([{ city: '上海市', district: '浦东新区', community: '泊之湾', propertyCount: 3 }])
  await wrapper.get('input[placeholder="搜索小区、房源或位置"]').setValue('泊之')
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
  await wrapper.get('.suggestion').trigger('tap')
  await flushPromises()
  expect(mocks.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ city: '上海市', district: '浦东新区', community: '泊之湾', keyword: undefined }))
  vi.useRealTimers()
})
