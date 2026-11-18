import type { Handwriting, LeaseDetail } from '@/api/leases'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Flow from './LeaseSigningFlow.vue'

const mocks = vi.hoisted(() => ({ action: vi.fn(), profile: vi.fn(), remove: vi.fn() }))
let token: {
  validToken: string
  updateNowTime: () => typeof token
}
vi.mock('@/store/token', () => ({ useTokenStore: () => token }))
vi.mock('@/api/leases', async original => ({ ...await original<typeof import('@/api/leases')>(), actOnLease: mocks.action, fetchSigningProfile: mocks.profile, removeSigningAsset: mocks.remove }))
const lease = { id: '51', title: '租赁合同', tenantName: '张三', landlordName: '李四', monthlyRent: 3000, deposit: 3000, propertyTitle: '测试公寓', propertyAddress: '上海市测试路', status: 'PENDING_SIGNATURE', isTenant: true, isLandlord: false, version: 4, contentHash: 'frozen-hash', terms: '完整条款' } as LeaseDetail
const handwriting: Handwriting = { strokes: [[{ x: 80, y: 80 }, { x: 250, y: 80 }, { x: 120, y: 140 }, { x: 250, y: 280 }, { x: 310, y: 130 }, { x: 420, y: 270 }, { x: 460, y: 100 }, { x: 600, y: 240 }]] }
let wrapper: ReturnType<typeof mount> | undefined
const button = (label: string) => wrapper!.findAll('button').find(item => item.text() === label)!
async function consent(index = 0) {
  await wrapper!.findAll('.consent-group')[index].trigger('change', { detail: { value: ['yes'] } })
}
function open(value = lease) {
  wrapper = mount(Flow, { props: { lease: value, active: true }, global: { stubs: { 'checkbox-group': { template: '<div class="consent-group"><slot /></div>' }, 'checkbox': true, 'HandwritingPad': { name: 'HandwritingPad', props: ['modelValue'], template: '<div class="pad" />' }, 'LeaseContractDocument': true, 'PrivateSignatureImage': true, 'IdentityVerificationPanel': true } } })
}
async function signingStep() {
  await consent()
  await button('下一步：核对信息').trigger('tap')
  await consent()
  await button('下一步：手写签署').trigger('tap')
  await flushPromises()
}
async function draw() {
  wrapper!.findComponent({ name: 'HandwritingPad' }).vm.$emit('update:modelValue', handwriting)
  await flushPromises()
}
beforeEach(() => {
  token = reactive({ validToken: 'owner-token', updateNowTime: () => token })
  mocks.action.mockReset().mockResolvedValue({})
  mocks.profile.mockReset().mockResolvedValue({})
  mocks.remove.mockReset().mockResolvedValue({})
  vi.stubGlobal('uni', { ...uni, pageScrollTo: vi.fn(), showModal: vi.fn().mockResolvedValue({ confirm: true }) })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})
it('requires reading, information confirmation, handwriting and consent before a frozen-version submission', async () => {
  open()
  await button('下一步：核对信息').trigger('tap')
  expect(wrapper!.text()).toContain('请阅读合同全文并勾选确认')
  await signingStep()
  await button('确认签署合同').trigger('tap')
  expect(mocks.action).not.toHaveBeenCalled()
  await consent(1)
  await button('确认签署合同').trigger('tap')
  expect(wrapper!.text()).toContain('不能提交空白')
  await draw()
  await button('确认签署合同').trigger('tap')
  await flushPromises()
  expect(mocks.action).toHaveBeenCalledWith('51', { action: 'SIGN', version: 4, contentHash: 'frozen-hash', signedName: '张三', accepted: true, handwriting, saveSignature: false })
  expect(wrapper!.emitted('signed')).toHaveLength(1)
})
it('keeps a contract with unresolved review issues in the reading step', async () => {
  open({ ...lease, unresolvedReviews: 1 })
  await consent()
  await button('下一步：核对信息').trigger('tap')
  expect(wrapper!.text()).toContain('合同还有未解决的审阅意见')
  expect(mocks.action).not.toHaveBeenCalled()
  expect(wrapper!.find('.pad').exists()).toBe(false)
})
it('only saves the signature and applies a seal after their separate explicit selections', async () => {
  mocks.profile.mockResolvedValue({ handwriting: { id: '71', handwriting }, seal: { id: '81', imageBase64: 'png' } })
  open()
  await signingStep()
  await button('使用我保存的签名').trigger('tap')
  await consent(0)
  await consent(1)
  await consent(2)
  await button('确认签署合同').trigger('tap')
  await flushPromises()
  expect(mocks.action).toHaveBeenCalledWith('51', expect.objectContaining({ handwriting, saveSignature: true, sealId: '81' }))
})
it('preserves handwritten input on failure and does not submit a canceled confirmation', async () => {
  open()
  await signingStep()
  await draw()
  await consent(1)
  mocks.action.mockRejectedValueOnce(new Error('合同已更新，请刷新'))
  await button('确认签署合同').trigger('tap')
  await flushPromises()
  expect(wrapper!.text()).toContain('合同已更新，请刷新')
  expect(wrapper!.findComponent({ name: 'HandwritingPad' }).props('modelValue')).toEqual(handwriting)
  vi.mocked(uni.showModal).mockResolvedValueOnce({ confirm: false, cancel: true, errMsg: '' })
  await button('确认签署合同').trigger('tap')
  await flushPromises()
  expect(mocks.action).toHaveBeenCalledTimes(1)
})
it('blocks another account from completing a pending confirmation and clears private signing inputs', async () => {
  open()
  await signingStep()
  await draw()
  await consent(1)
  let resolve!: (result: UniApp.ShowModalRes) => void
  vi.mocked(uni.showModal).mockReturnValueOnce(new Promise((done) => {
    resolve = done
  }))
  await button('确认签署合同').trigger('tap')
  token.validToken = 'different-account'
  resolve({ confirm: true, cancel: false, errMsg: '' })
  await flushPromises()
  expect(mocks.action).not.toHaveBeenCalled()
  expect(wrapper!.find('.pad').exists()).toBe(false)
})
it('drops a saved-signature response after leaving the signing screen', async () => {
  let resolve!: (result: unknown) => void
  mocks.profile.mockReturnValueOnce(new Promise((done) => {
    resolve = done
  }))
  open()
  await signingStep()
  await wrapper!.setProps({ active: false })
  resolve({ handwriting: { id: '71', handwriting } })
  await flushPromises()
  expect(wrapper!.text()).not.toContain('使用我保存的签名')
})
it('does not offer signing to a participant who has already signed', () => {
  open({ ...lease, tenantSignedAt: '2026-11-18 00:00:00' })
  expect(wrapper!.text()).toContain('无需继续签署')
  expect(button('下一步：核对信息')).toBeUndefined()
})
it('allows manual signing when saved profile loading fails', async () => {
  mocks.profile.mockRejectedValue(new Error('offline'))
  open()
  await signingStep()
  await draw()
  await consent(1)
  expect(wrapper!.text()).toContain('可重试或直接手写')
  await button('确认签署合同').trigger('tap')
  await flushPromises()
  expect(mocks.action).toHaveBeenCalledOnce()
})
