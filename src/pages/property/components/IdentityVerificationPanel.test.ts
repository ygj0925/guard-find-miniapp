import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import Panel from './IdentityVerificationPanel.vue'

const mocks = vi.hoisted(() => ({ status: vi.fn(), consent: vi.fn(), session: vi.fn() }))
let token: { validToken: string; updateNowTime: () => typeof token }
vi.mock('@/store/token', () => ({ useTokenStore: () => token }))
vi.mock('@/api/identityVerification', () => ({
  fetchIdentityVerificationStatus: mocks.status,
  grantIdentityVerificationConsent: mocks.consent,
  createIdentityVerificationSession: mocks.session,
}))

beforeEach(() => {
  token = reactive({ validToken: 'token', updateNowTime: () => token })
  mocks.status.mockReset().mockResolvedValue({ mode: 'DISABLED', status: 'NOT_REQUIRED', required: false })
  mocks.consent.mockReset().mockResolvedValue({ mode: 'PROVIDER', status: 'PENDING', required: true, sessionId: 'abc', consentVersion: 'privacy-1' })
  mocks.session.mockReset().mockResolvedValue({ mode: 'PROVIDER', status: 'PENDING', required: true, sessionId: 'abc', launchUrl: 'https://verify.example/session', consentVersion: 'privacy-1' })
  vi.stubGlobal('uni', { navigateTo: vi.fn() })
})

it('keeps the existing account signing flow available when verification is disabled', async () => {
  const wrapper = mount(Panel, { props: { active: true, name: '张三' } })
  await flushPromises()
  expect(wrapper.text()).toContain('实名认证服务尚未启用')
  expect(wrapper.text()).not.toContain('完成实名认证后才能提交签名')
  expect(wrapper.emitted('state')?.at(-1)?.[0]).toMatchObject({ status: 'NOT_REQUIRED', required: false })
})

it('requires separate consent before starting a provider session', async () => {
  mocks.status.mockResolvedValueOnce({ mode: 'PROVIDER', status: 'PENDING_CONSENT', required: true, consentVersion: 'privacy-1' })
  const wrapper = mount(Panel, { props: { active: true, name: '张三' }, global: { stubs: { 'checkbox-group': { template: '<div class="consent"><slot /></div>' }, checkbox: true } } })
  await flushPromises()
  expect(wrapper.text()).toContain('单独征得你的同意')
  await wrapper.find('.consent').trigger('change', { detail: { value: [] } })
  await wrapper.find('button').trigger('tap')
  expect(mocks.consent).not.toHaveBeenCalled()
  await wrapper.find('.consent').trigger('change', { detail: { value: ['yes'] } })
  await wrapper.find('button').trigger('tap')
  await flushPromises()
  expect(mocks.consent).toHaveBeenCalledWith('privacy-1')
  expect(mocks.session).toHaveBeenCalledTimes(1)
  expect(mocks.session).toHaveBeenCalledWith({ consentVersion: 'privacy-1' })
  expect(vi.mocked(uni.navigateTo)).toHaveBeenCalledWith({ url: expect.stringContaining('identity-verify') })
})
