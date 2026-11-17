import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Page from './leases.vue'

const mocks = vi.hoisted(() => ({ list: vi.fn(), login: vi.fn(), hooks: {} as Record<string, () => void> }))
let token: { validToken: string, updateNowTime: () => typeof token }
vi.mock('@/api/leases', async importOriginal => ({ ...await importOriginal<typeof import('@/api/leases')>(), fetchLeases: mocks.list }))
vi.mock('@/store/token', () => ({ useTokenStore: () => token }))
vi.mock('@/utils/toLoginPage', () => ({ toLoginPage: mocks.login }))
const lease = { id: '500', title: '本人租约', propertyTitle: '测试房源', status: 'SIGNED', isTenant: true, endDate: '2026-12-31', daysRemaining: 30 }
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  token = reactive({ validToken: 'first', updateNowTime: () => token })
  mocks.list.mockReset().mockResolvedValue({ list: [lease], total: 1 })
  mocks.login.mockReset()
  mocks.hooks = {}
  vi.stubGlobal('definePage', vi.fn())
  for (const name of ['onShow', 'onHide', 'onUnload', 'onReachBottom', 'onPullDownRefresh']) {
    vi.stubGlobal(name, (cb: () => void) => {
      mocks.hooks[name] = cb
    })
  }
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})
async function open() {
  wrapper = mount(Page)
  mocks.hooks.onShow()
  await flushPromises()
}
function button(label: string) {
  return wrapper!.findAll('button').find(node => node.text() === label)!
}

it('paginates without duplicate rows and opens the selected private contract', async () => {
  mocks.list.mockResolvedValueOnce({ list: [lease], total: 2 }).mockResolvedValueOnce({ list: [lease, { ...lease, id: '501', title: '第二份租约' }], total: 2 })
  await open()
  await button('加载更多').trigger('tap')
  await flushPromises()
  expect(mocks.list).toHaveBeenLastCalledWith({ page: 2, size: 10, status: undefined })
  expect(wrapper!.findAll('button').filter(node => node.text().includes('本人租约'))).toHaveLength(1)
  await wrapper!.findAll('button').find(node => node.text().includes('第二份租约'))!.trigger('tap')
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/property/lease-detail?id=501' })
})
it('changing filter discards the old response instead of overriding new results', async () => {
  let resolve!: (value: unknown) => void
  mocks.list.mockReturnValueOnce(new Promise((done) => {
    resolve = done
  })).mockResolvedValueOnce({ list: [{ ...lease, title: '待签署租约', status: 'PENDING_SIGNATURE' }], total: 1 })
  await open()
  await button('待签署').trigger('tap')
  await flushPromises()
  resolve({ list: [lease], total: 1 })
  await flushPromises()
  expect(wrapper!.text()).toContain('待签署租约')
  expect(wrapper!.text()).not.toContain('本人租约')
})
it('does not fetch private data for guests or retain contracts after logout', async () => {
  token.validToken = ''
  await open()
  expect(mocks.list).not.toHaveBeenCalled()
  await button('去登录').trigger('tap')
  expect(mocks.login).toHaveBeenCalledOnce()
  token.validToken = 'second'
  await flushPromises()
  expect(wrapper!.text()).toContain('本人租约')
  token.validToken = ''
  await flushPromises()
  expect(wrapper!.text()).not.toContain('本人租约')
})
it('retries a failed refresh as page one even when all prior records were loaded', async () => {
  await open()
  mocks.list.mockRejectedValueOnce(new Error('offline'))
  mocks.hooks.onShow()
  await flushPromises()
  await button('重新加载').trigger('tap')
  await flushPromises()
  expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, size: 10, status: undefined })
  expect(mocks.list).toHaveBeenCalledTimes(3)
})
it('keeps current contracts and offers retry after a pagination failure', async () => {
  mocks.list.mockResolvedValueOnce({ list: [lease], total: 2 }).mockRejectedValueOnce(new Error('offline'))
  await open()
  await button('加载更多').trigger('tap')
  await flushPromises()
  expect(wrapper!.text()).toContain('本人租约')
  expect(wrapper!.text()).toContain('合同加载失败')
  expect(button('重新加载')).toBeDefined()
})
