import type { Property } from '@/api/property'
import { flushPromises, mount } from '@vue/test-utils'
import { vi } from 'vitest'
import PropertyCard from './PropertyCard.vue'

const state = vi.hoisted(() => ({ favorite: vi.fn(), login: vi.fn(), token: '' }))
vi.mock('@/api/property', async original => ({ ...await original<typeof import('@/api/property')>(), toggleFavorite: state.favorite }))
vi.mock('@/store/token', () => ({ useTokenStore: () => ({ updateNowTime: () => ({ hasLogin: !!state.token, validToken: state.token }) }) }))
vi.mock('@/utils/toLoginPage', () => ({ toLoginPage: state.login }))
const item = { id: '1', title: '测试短租', price: 200, priceType: 'rent', priceUnit: 'day', images: [], facilities: [], recommended: true } as unknown as Property
beforeEach(() => {
  state.token = ''
  state.favorite.mockReset()
  state.login.mockReset()
  vi.stubGlobal('uni', { showToast: vi.fn(), navigateTo: vi.fn() })
})
afterEach(() => vi.unstubAllGlobals())

describe('房源卡片', () => {
  it('展示真实推荐标记与日租单位', () => {
    const wrapper = mount(PropertyCard, { props: { item } })
    expect(wrapper.text()).toContain('优选')
    expect(wrapper.text()).toContain('/天')
    wrapper.unmount()
  })
  it('未登录收藏仅引导登录', async () => {
    const wrapper = mount(PropertyCard, { props: { item } })
    await wrapper.get('button[aria-label="收藏房源"]').trigger('tap')
    expect(state.login).toHaveBeenCalledOnce()
    expect(state.favorite).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('保存后采用服务器收藏状态并禁止重复操作', async () => {
    state.token = 'a'
    let resolve!: (r: { favorited: boolean }) => void
    state.favorite.mockImplementation(() => new Promise((r) => {
      resolve = r
    }))
    const wrapper = mount(PropertyCard, { props: { item } })
    await wrapper.get('button[aria-label="收藏房源"]').trigger('tap')
    await wrapper.get('button[aria-label="收藏房源"]').trigger('tap')
    expect(state.favorite).toHaveBeenCalledOnce()
    resolve({ favorited: false })
    await flushPromises()
    expect(wrapper.emitted('favorite')).toEqual([['1', false]])
    wrapper.unmount()
  })
  it('旧登录会话返回时不回填收藏', async () => {
    state.token = 'a'
    let resolve!: (r: { favorited: boolean }) => void
    state.favorite.mockImplementation(() => new Promise((r) => {
      resolve = r
    }))
    const wrapper = mount(PropertyCard, { props: { item } })
    await wrapper.get('button[aria-label="收藏房源"]').trigger('tap')
    state.token = 'b'
    resolve({ favorited: true })
    await flushPromises()
    expect(wrapper.emitted('favorite')).toBeUndefined()
    wrapper.unmount()
  })
  it('不推荐的出售房源不显示优选且使用总价单位', () => {
    const wrapper = mount(PropertyCard, { props: { item: { ...item, priceType: 'sale', priceUnit: null, recommended: false } } })
    expect(wrapper.text()).not.toContain('优选')
    expect(wrapper.text()).not.toContain('/月')
    expect(wrapper.text()).toContain('元')
    wrapper.unmount()
  })
})
