import type { LeaseDetail } from '@/api/leases'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Panel from './LeaseReviewPanel.vue'

const mocks = vi.hoisted(() => ({ review: vi.fn() }))
let token: { validToken: string, updateNowTime: () => typeof token }
vi.mock('@/store/token', () => ({ useTokenStore: () => token }))
vi.mock('@/api/leases', () => ({ reviewLease: mocks.review }))
const lease = { id: '51', status: 'PENDING_SIGNATURE', isTenant: true, publishedVersion: 4, contentHash: 'hash', unresolvedReviews: 1, reviews: [{ id: '81', clauseLabel: '押金', content: '何时退款', reply: '7天内', status: 'REPLIED', canConfirm: true, currentRound: true, version: 2, authorRole: 'TENANT' }] } as LeaseDetail
let wrapper: ReturnType<typeof mount>
const button = (label: string) => wrapper.findAll('button').find(item => item.text() === label)!
beforeEach(() => {
  token = reactive({ validToken: 'owner', updateNowTime: () => token })
  mocks.review.mockReset().mockResolvedValue({})
  vi.stubGlobal('uni', { ...uni, showModal: vi.fn().mockResolvedValue({ confirm: true }) })
  wrapper = mount(Panel, { props: { lease, active: true } })
})
afterEach(() => {
  wrapper.unmount()
  vi.unstubAllGlobals()
})
it('binds confirmation to the reviewed publication and issue version', async () => {
  await button('确认已解决').trigger('tap')
  await flushPromises()
  expect(mocks.review).toHaveBeenCalledWith('51', { action: 'CONFIRM', publishedVersion: 4, contentHash: 'hash', reviewId: '81', version: 2 })
  expect(wrapper.emitted('changed')).toHaveLength(1)
})
it('does not submit a canceled confirmation or a late confirmation after account switching', async () => {
  vi.mocked(uni.showModal).mockResolvedValueOnce({ confirm: false } as never)
  await button('确认已解决').trigger('tap')
  await flushPromises()
  expect(mocks.review).not.toHaveBeenCalled()
  let resolve!: (value: never) => void
  vi.mocked(uni.showModal).mockImplementationOnce(() => new Promise(r => resolve = r) as never)
  await button('确认已解决').trigger('tap')
  token.validToken = 'other'
  resolve({ confirm: true } as never)
  await flushPromises()
  expect(mocks.review).not.toHaveBeenCalled()
})
it('keeps unresolved feedback for retry when the request fails', async () => {
  await button('仍有疑问').trigger('tap')
  await wrapper.find('textarea').setValue('请说明退款渠道')
  mocks.review.mockRejectedValueOnce(new Error('网络繁忙'))
  await button('继续反馈').trigger('tap')
  await flushPromises()
  expect(wrapper.text()).toContain('网络繁忙')
  expect(wrapper.find('textarea').element.value).toBe('请说明退款渠道')
  expect(wrapper.emitted('changed')).toBeUndefined()
})
