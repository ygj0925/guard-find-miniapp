import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Page from './notices.vue'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), hooks: {} as Record<string, () => void> }))
let token: { validToken: string, updateNowTime: () => typeof token }
vi.mock('@/http/http', () => ({ http: { get: mocks.get, post: mocks.post } }))
vi.mock('@/store/token', () => ({ useTokenStore: () => token }))
vi.mock('@/utils/toLoginPage', () => ({ toLoginPage: vi.fn() }))
let wrapper: ReturnType<typeof mount> | undefined
const notice = { id: '1', businessId: '501', businessType: 'PROPERTY_LEASE', title: '租约即将到期', content: '请查看合同', isRead: 0 }
beforeEach(() => {
  token = reactive({ validToken: 'first', updateNowTime: () => token })
  mocks.get.mockReset().mockResolvedValue({ list: [notice], total: 1 })
  mocks.post.mockReset().mockResolvedValue(undefined)
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
it.each(['PROPERTY_LEASE', 'PROPERTY_BOOKING'])('opens the correct detail for %s even if marking read fails', async (type) => {
  mocks.get.mockResolvedValueOnce({ list: [{ ...notice, businessType: type }], total: 1 })
  mocks.post.mockRejectedValueOnce(new Error('offline'))
  await open()
  await wrapper!.get('button').trigger('tap')
  await flushPromises()
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: `/pages/property/${type === 'PROPERTY_LEASE' ? 'lease' : 'booking'}-detail?id=501` })
})
it('retries a refresh from page one instead of skipping to page two', async () => {
  await open()
  mocks.get.mockRejectedValueOnce(new Error('offline'))
  mocks.hooks.onShow()
  await flushPromises()
  await wrapper!.findAll('button').find(item => item.text() === '重新加载')!.trigger('tap')
  await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/miniapp/notices', { page: 1, size: 20 })
})
it('hides private notifications on logout and ignores an old read response', async () => {
  let resolve!: () => void
  mocks.post.mockReturnValueOnce(new Promise<void>((done) => {
    resolve = done
  }))
  await open()
  await wrapper!.get('button').trigger('tap')
  token.validToken = ''
  resolve()
  await flushPromises()
  expect(uni.navigateTo).not.toHaveBeenCalled()
  expect(wrapper!.text()).not.toContain('租约即将到期')
})
