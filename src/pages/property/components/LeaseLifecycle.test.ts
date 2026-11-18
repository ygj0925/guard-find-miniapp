import type { LeaseDetail } from '@/api/leases'
import type { LeaseBill, LeaseDocument } from '@/api/leaseLifecycle'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Panel from './LeaseLifecycle.vue'

const mocks = vi.hoisted(() => ({ read: vi.fn(), bill: vi.fn(), document: vi.fn() }))
vi.mock('@/api/leaseLifecycle', async original => ({ ...await original<typeof import('@/api/leaseLifecycle')>(), fetchLeaseLifecycle: mocks.read, actOnBill: mocks.bill, actOnDocument: mocks.document }))
let token: { validToken: string, updateNowTime: () => typeof token }
vi.mock('@/store/token', () => ({ useTokenStore: () => token }))
const lease = { id: '501', isTenant: true, isLandlord: false } as LeaseDetail
const bill: LeaseBill = { id: '601', kind: 'RENT', title: '十一月租金', periodStart: '2026-11-01', periodEnd: '2026-11-30', dueDate: '2026-11-01', amount: 2000, status: 'UNPAID', version: 3 }
const doc: LeaseDocument = { id: '701', kind: 'CHECK_IN', status: 'PENDING', version: 2, contentHash: 'frozen', content: { date: '2026-11-01', inventory: '桌椅', condition: '完好', note: '现场核实', keys: 2, water: '10', electricity: '20', gas: '未配备' } }
let wrapper: ReturnType<typeof mount> | undefined
const button = (text: string) => wrapper!.findAll('button').find(item => item.text() === text)!
beforeEach(() => {
  token = reactive({ validToken: 'first', updateNowTime: () => token })
  mocks.read.mockReset().mockResolvedValue({ bills: [bill], documents: [doc], amountDue: 2000, amountPaid: 0, amountPending: 0 })
  mocks.bill.mockReset().mockResolvedValue(undefined)
  mocks.document.mockReset().mockResolvedValue(undefined)
  vi.spyOn(uni, 'showModal').mockResolvedValue({ confirm: true, cancel: false, errMsg: '' })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
})
async function open(participant = lease) {
  wrapper = mount(Panel, { props: { lease: participant, active: true }, global: { stubs: { picker: { template: '<div><slot /></div>' } } } })
  await flushPromises()
}
it('keeps actual payer and receiver actions separate and submits bill version with payment details', async () => {
  await open()
  expect(button('确认已收到款项')).toBeUndefined()
  await button('登记已线下付款').trigger('tap')
  await button('确认提交记录').trigger('tap')
  expect(mocks.bill).not.toHaveBeenCalled()
  await wrapper!.get('textarea').setValue('银行流水123')
  await button('确认提交记录').trigger('tap')
  await flushPromises()
  expect(mocks.bill).toHaveBeenCalledWith('501', '601', expect.objectContaining({ action: 'SUBMIT', version: 3, reference: '银行流水123' }))
  expect(wrapper!.emitted('changed')).toHaveLength(1)
})
it('allows landlord receipt confirmation but not tenant payment registration', async () => {
  mocks.read.mockResolvedValue({ bills: [{ ...bill, status: 'PENDING_CONFIRMATION' }], documents: [], amountDue: 2000, amountPaid: 0, amountPending: 2000 })
  await open({ ...lease, isTenant: false, isLandlord: true })
  expect(button('登记已线下付款')).toBeUndefined()
  await button('确认已收到款项').trigger('tap')
  await flushPromises()
  expect(mocks.bill).toHaveBeenCalledWith('501', '601', { action: 'CONFIRM', version: 3 })
})
it('binds handover confirmation to the displayed frozen document', async () => {
  await open()
  await button('交接记录').trigger('tap')
  expect(wrapper!.text()).toContain('桌椅')
  await button('核对无误，确认记录').trigger('tap')
  await flushPromises()
  expect(mocks.document).toHaveBeenCalledWith('501', '701', { action: 'CONFIRM', version: 2, contentHash: 'frozen' })
})
it('retains payment explanation after a rejected request', async () => {
  await open()
  await button('登记已线下付款').trigger('tap')
  await wrapper!.get('textarea').setValue('付款记录不丢失')
  mocks.bill.mockRejectedValueOnce(new Error('记录已更新，请刷新'))
  await button('确认提交记录').trigger('tap')
  await flushPromises()
  expect(wrapper!.text()).toContain('记录已更新')
  expect((wrapper!.get('textarea').element as HTMLTextAreaElement).value).toBe('付款记录不丢失')
})
it('does not submit when the account changes during confirmation', async () => {
  let resolve!: (result: UniApp.ShowModalRes) => void
  vi.mocked(uni.showModal).mockReturnValueOnce(new Promise((done) => {
    resolve = done
  }))
  await open()
  await button('交接记录').trigger('tap')
  await button('核对无误，确认记录').trigger('tap')
  token.validToken = ''
  resolve({ confirm: true, cancel: false, errMsg: '' })
  await flushPromises()
  expect(mocks.document).not.toHaveBeenCalled()
  expect(wrapper!.text()).not.toContain('桌椅')
})
it('discards records from a hidden page', async () => {
  let resolve!: (result: unknown) => void
  mocks.read.mockReturnValueOnce(new Promise((done) => {
    resolve = done
  }))
  await open()
  await wrapper!.setProps({ active: false })
  resolve({ bills: [bill], documents: [], amountDue: 2000, amountPaid: 0, amountPending: 0 })
  await flushPromises()
  expect(wrapper!.text()).not.toContain('十一月租金')
})
