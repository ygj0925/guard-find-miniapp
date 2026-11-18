import type { LeaseDetail } from '@/api/leases'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Page from './lease-detail.vue'

const mocks = vi.hoisted(() => ({ detail: vi.fn(), action: vi.fn(), login: vi.fn(), hooks: {} as Record<string, (query?: Record<string, string>) => void> }))
let token: { validToken: string, updateNowTime: () => typeof token }
vi.mock('@/api/leases', async importOriginal => ({ ...await importOriginal<typeof import('@/api/leases')>(), fetchLease: mocks.detail, actOnLease: mocks.action }))
vi.mock('@/store/token', () => ({ useTokenStore: () => token }))
vi.mock('@/utils/toLoginPage', () => ({ toLoginPage: mocks.login }))
const detail: LeaseDetail = {
  id: '501',
  propertyId: '100',
  propertyTitle: '测试公寓',
  propertyAddress: '上海市测试路1号',
  tenantId: '1',
  landlordId: '2',
  tenantName: '张三',
  landlordName: '李四',
  title: '租赁合同',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  monthlyRent: 3000,
  deposit: 3000,
  terms: '完整合同条款：租赁用途为居住。',
  status: 'PENDING_SIGNATURE',
  version: 4,
  contentHash: 'frozen-content-hash',
  renewalStatus: 'NONE',
  moveOutStatus: 'NONE',
  daysRemaining: 30,
  isTenant: true,
  isLandlord: false,
  logs: [],
}
let wrapper: ReturnType<typeof mount> | undefined
const checkboxGroup = { template: '<div class="agreement"><slot /></div>' }
const picker = { template: '<div class="picker"><slot /></div>' }
beforeEach(() => {
  token = reactive({ validToken: 'first', updateNowTime: () => token })
  mocks.detail.mockReset().mockResolvedValue({ ...detail })
  mocks.action.mockReset().mockResolvedValue(undefined)
  mocks.login.mockReset()
  mocks.hooks = {}
  vi.stubGlobal('definePage', vi.fn())
  for (const name of ['onLoad', 'onShow', 'onHide', 'onUnload'])
    vi.stubGlobal(name, (cb: (query?: Record<string, string>) => void) => { mocks.hooks[name] = cb })
  vi.spyOn(uni, 'showModal').mockResolvedValue({ confirm: true, cancel: false, errMsg: '' })
  vi.stubGlobal('uni', { ...uni, setClipboardData: vi.fn(), showToast: vi.fn(), showModal: uni.showModal })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
async function open(id = '501') {
  wrapper = mount(Page, { global: { stubs: { 'checkbox-group': checkboxGroup, 'checkbox': true, picker } } })
  mocks.hooks.onLoad({ id })
  mocks.hooks.onShow()
  await flushPromises()
}
function button(label: string) {
  return wrapper!.findAll('button').find(node => node.text() === label)!
}
it('opens the dedicated reading and handwritten-signing flow without submitting from the detail page', async () => {
  vi.spyOn(uni, 'navigateTo')
  await open()
  expect(wrapper!.find('input').exists()).toBe(false)
  await button('阅读并手写签署').trigger('tap')
  expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/property/lease-sign?id=501' })
  expect(mocks.action).not.toHaveBeenCalled()
})
it('shows only the unsigned participant action and copies full immutable contract text', async () => {
  mocks.detail.mockResolvedValueOnce({ ...detail, tenantSignedAt: '2026-11-17 10:00:00', tenantSignedName: '张三' })
  await open()
  expect(button('阅读并手写签署')).toBeUndefined()
  expect(wrapper!.text()).toContain('等待另一方签署')
  await button('复制合同全文与签署记录').trigger('tap')
  expect(uni.setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: expect.stringContaining('完整合同条款') }))
  expect(uni.setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: expect.stringContaining('frozen-content-hash') }))
})
it('validates renewal dates and preserves failed request inputs', async () => {
  mocks.detail.mockResolvedValueOnce({ ...detail, status: 'SIGNED', canRenew: true })
  await open()
  await button('申请续租').trigger('tap')
  await wrapper!.get('textarea').setValue('继续居住一年')
  await wrapper!.get('.picker').trigger('change', { detail: { value: '2026-12-31' } })
  await button('确认提交申请').trigger('tap')
  expect(mocks.action).not.toHaveBeenCalled()
  await wrapper!.get('.picker').trigger('change', { detail: { value: '2027-12-31' } })
  mocks.action.mockRejectedValueOnce(new Error('暂时失败'))
  await button('确认提交申请').trigger('tap')
  await flushPromises()
  expect(mocks.action).toHaveBeenCalledWith('501', { action: 'RENEW_REQUEST', version: 4, reason: '继续居住一年', requestedEndDate: '2027-12-31' })
  expect((wrapper!.get('textarea').element as HTMLTextAreaElement).value).toBe('继续居住一年')
})
it('does not offer renewal to landlords and explains draft renewal is being prepared', async () => {
  mocks.detail.mockResolvedValueOnce({ ...detail, status: 'SIGNED', isTenant: false, isLandlord: true, canRenew: true, renewalStatus: 'APPROVED', renewalLeaseId: '502', renewalLeaseStatus: 'DRAFT' })
  await open()
  expect(button('申请续租')).toBeUndefined()
  expect(button('查看续租合同')).toBeUndefined()
  expect(wrapper!.text()).toContain('续租合同正在准备')
})
it('shows pending renewal cancellation and a move-out intention without claiming termination', async () => {
  mocks.detail.mockResolvedValueOnce({ ...detail, status: 'SIGNED', renewalStatus: 'PENDING', canRenew: false, moveOutStatus: 'PENDING' })
  await open()
  expect(button('申请续租')).toBeUndefined()
  expect(button('撤销续租申请')).toBeDefined()
  expect(wrapper!.text()).toContain('合同尚未终止')
})
it('cancels a pending renewal with its version and reloads the available actions', async () => {
  mocks.detail.mockResolvedValueOnce({ ...detail, status: 'SIGNED', renewalStatus: 'PENDING', canRenew: false })
  await open()
  await button('撤销续租申请').trigger('tap')
  await wrapper!.get('textarea').setValue('暂不续租')
  mocks.detail.mockResolvedValueOnce({ ...detail, status: 'SIGNED', renewalStatus: 'CANCELED', canRenew: true })
  await button('确认提交申请').trigger('tap')
  await flushPromises()
  expect(mocks.action).toHaveBeenCalledWith('501', { action: 'RENEW_CANCEL', version: 4, reason: '暂不续租' })
  expect(button('撤销续租申请')).toBeUndefined()
  expect(button('申请续租')).toBeDefined()
})
it.each(['SIGNED', 'EXPIRED'])('permits a new move-out intention after resolution for %s contracts', async (status) => {
  mocks.detail.mockResolvedValueOnce({ ...detail, status, renewalStatus: 'NONE', moveOutStatus: 'RESOLVED', canRenew: false })
  await open()
  await button('提交退租意向').trigger('tap')
  await wrapper!.get('textarea').setValue('计划搬离，请联系协商')
  await button('确认提交申请').trigger('tap')
  await flushPromises()
  expect(mocks.action).toHaveBeenCalledWith('501', { action: 'MOVE_OUT_REQUEST', version: 4, reason: '计划搬离，请联系协商' })
  expect(uni.showModal).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('不会立即终止合同') }))
})
it.each(['', 'bad-id', '0'])('does not request an invalid contract id %s', async (id) => {
  await open(id)
  expect(mocks.detail).not.toHaveBeenCalled()
  expect(wrapper!.text()).toContain('链接无效')
})
it('guides a guest to login without requesting a private contract', async () => {
  token.validToken = ''
  await open()
  expect(mocks.detail).not.toHaveBeenCalled()
  await button('去登录').trigger('tap')
  expect(mocks.login).toHaveBeenCalledOnce()
})
it('drops unloaded and previous-account results and clears private text on logout', async () => {
  let resolve!: (value: LeaseDetail) => void
  mocks.detail.mockReturnValueOnce(new Promise((done) => {
    resolve = done
  }))
  await open()
  mocks.hooks.onHide()
  resolve(detail)
  await flushPromises()
  expect(wrapper!.text()).not.toContain(detail.terms)
  mocks.hooks.onShow()
  await flushPromises()
  expect(wrapper!.text()).toContain(detail.terms)
  token.validToken = ''
  await flushPromises()
  expect(wrapper!.text()).not.toContain(detail.terms)
})
it('does not sign if account changes while confirming', async () => {
  let resolve!: (value: UniApp.ShowModalRes) => void
  vi.mocked(uni.showModal).mockReturnValueOnce(new Promise((done) => {
    resolve = done
  }))
  await open()
  await button('信息有误 / 拒绝签署').trigger('tap')
  await wrapper!.get('textarea').setValue('身份信息有误')
  await button('确认提交申请').trigger('tap')
  token.validToken = ''
  resolve({ confirm: true, cancel: false, errMsg: '' })
  await flushPromises()
  expect(mocks.action).not.toHaveBeenCalled()
})
