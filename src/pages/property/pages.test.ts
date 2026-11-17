import type { Property } from '@/api/property'
import type { Component } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DetailPage from './detail.vue'
import EditPage from './edit.vue'
import ManagerPage from './manager.vue'
import PersonalPage from './personal.vue'

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  detail: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  status: vi.fn(),
  remove: vi.fn(),
  favorite: vi.fn(),
  region: vi.fn(),
  upload: vi.fn(),
  login: vi.fn(),
  hooks: {} as Record<string, (...args: unknown[]) => unknown>,
}))
let token: { validToken: string, hasLogin: boolean, updateNowTime: () => typeof token }
vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (cb: (...args: unknown[]) => unknown) => { mocks.hooks.load = cb },
  onShow: (cb: (...args: unknown[]) => unknown) => { mocks.hooks.show = cb },
  onHide: (cb: (...args: unknown[]) => unknown) => { mocks.hooks.hide = cb },
  onUnload: (cb: (...args: unknown[]) => unknown) => { mocks.hooks.unload = cb },
  onReachBottom: (cb: (...args: unknown[]) => unknown) => { mocks.hooks.bottom = cb },
}))
vi.mock('@/api/operations', async importOriginal => ({...await importOriginal<typeof import('@/api/operations')>(),fetchReception:vi.fn().mockResolvedValue({availability:'ACTIVE'}),startConsult:vi.fn().mockResolvedValue(undefined)}))
vi.mock('@/api/login', () => ({ getUserInfo: mocks.me }))
vi.mock('@/http/http', () => ({ http: {} }))
// 使用实际的标签/计价工具，避免测试和实现各自复制一套契约。
vi.mock('@/api/property', async importOriginal => ({
  ...await importOriginal<typeof import('@/api/property')>(),
  fetchPropertyDetail: mocks.detail,
  fetchPersonalProperties: mocks.list,
  saveProperty: mocks.save,
  changePropertyStatus: mocks.status,
  deleteProperty: mocks.remove,
  toggleFavorite: mocks.favorite,
  fetchRegionTree: mocks.region,
}))
vi.mock('@/api/propertyImage', () => ({ uploadPropertyImage: mocks.upload }))
vi.mock('@/store/token', () => ({ useTokenStore: () => token }))
vi.mock('@/store/user', () => ({ useUserStore: () => ({ fetchUserInfo: vi.fn() }) }))
vi.mock('@/utils/toLoginPage', () => ({ toLoginPage: mocks.login }))

const Picker = { template: '<view class="picker-stub"><slot /></view>', props: ['range', 'value', 'disabled'] }
let wrapper: ReturnType<typeof mount> | undefined
function property(patch: Partial<Property> = {}): Property {
  return {
    id: 'p1',
    userId: 7,
    ownerNickname: '管家',
    ownerAvatar: null,
    ownerIsManager: true,
    title: '测试房源',
    description: null,
    propertyType: 'apartment',
    layout: '一室一厅',
    areaSqm: 40,
    floorInfo: null,
    orientation: null,
    decoration: null,
    price: 180,
    priceType: 'rent',
    priceUnit: 'day',
    rentalMode: 'short',
    recommended: false,
    community: null,
    availableFrom: null,
    address: '测试地址',
    district: null,
    city: null,
    facilities: [],
    contactName: null,
    contactPhone: null,
    status: 2,
    viewCount: 0,
    images: [],
    ...patch,
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
beforeEach(() => {
  token = reactive({ validToken: 'first', hasLogin: true, updateNowTime: () => token })
  mocks.hooks = {}
  mocks.me.mockReset().mockResolvedValue({ isPropertyManager: false })
  mocks.detail.mockReset().mockResolvedValue(property())
  mocks.list.mockReset().mockResolvedValue({ list: [property()], total: 1 })
  mocks.save.mockReset().mockResolvedValue(undefined)
  mocks.status.mockReset().mockResolvedValue(undefined)
  mocks.remove.mockReset().mockResolvedValue(undefined)
  mocks.favorite.mockReset().mockResolvedValue({ favorited: false })
  mocks.region.mockReset().mockResolvedValue([])
  mocks.upload.mockReset().mockResolvedValue('https://example.com/new.jpg')
  mocks.login.mockReset()
  vi.stubGlobal('definePage', vi.fn())
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('onLoad', (cb: (...args: unknown[]) => unknown) => {
    mocks.hooks.load = cb
  })
  vi.stubGlobal('onUnload', (cb: (...args: unknown[]) => unknown) => {
    mocks.hooks.unload = cb
  })
  vi.stubGlobal('onShareAppMessage', (cb: (...args: unknown[]) => unknown) => {
    mocks.hooks.share = cb
  })
  vi.stubGlobal('onShareTimeline', (cb: (...args: unknown[]) => unknown) => {
    mocks.hooks.timeline = cb
  })
  vi.stubGlobal('uni', { ...uni, setNavigationBarTitle: vi.fn() })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})
async function open(Page: Component, query: Record<string, string> = {}) {
  wrapper = mount(Page, { global: { stubs: { 'picker': Picker, 'swiper': true, 'swiper-item': true } } })
  mocks.hooks.load?.(query)
  mocks.hooks.show?.()
  await flushPromises()
}
async function tap(label: string) {
  const button = wrapper!.findAll('button').find(node => node.attributes('aria-label') === label || node.text().startsWith(label))
  expect(button, `button ${label}`).toBeDefined()
  button!.element.dispatchEvent(new Event('tap'))
  await flushPromises()
}
function expectNoPublishing() {
  for (const label of ['我的房源', '发布房源', '业主预约'])
    expect(wrapper!.findAll('button').some(node => node.text().startsWith(label))).toBe(false)
}

describe('房源管理身份边界', () => {
  it('未登录只提供主动登录引导，不调用 me、不自动跳转', async () => {
    token.validToken = ''
    token.hasLogin = false
    await open(ManagerPage)
    expect(wrapper!.text()).toContain('登录后使用房源服务')
    expectNoPublishing()
    expect(mocks.me).not.toHaveBeenCalled()
    expect(mocks.login).not.toHaveBeenCalled()
    mocks.hooks.show()
    await flushPromises()
    expect(mocks.login).not.toHaveBeenCalled()
    await tap('去登录')
    expect(mocks.login).toHaveBeenCalledOnce()
  })
  it.each([false, undefined, null, 1, 'true'])('只有 boolean true 可管理，%s 不放行', async (flag) => {
    mocks.me.mockResolvedValue({ isPropertyManager: flag })
    await open(ManagerPage)
    expect(wrapper!.text()).toContain('房源由公寓管家统一维护')
    expectNoPublishing()
    await tap('在线咨询')
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/message/chat?mode=support' })
    await tap('查看房源')
    expect(uni.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' })
  })
  it('核验前不展示入口，明确管家后导航到现有页面', async () => {
    const pending = deferred<{ isPropertyManager: boolean }>()
    mocks.me.mockReturnValueOnce(pending.promise)
    await open(ManagerPage)
    expect(wrapper!.text()).toContain('正在核验管理身份')
    expectNoPublishing()
    pending.resolve({ isPropertyManager: true })
    await flushPromises()
    expect(mocks.me).toHaveBeenCalledWith({ header: { Authorization: 'Bearer first' }, hideErrorToast: true })
    for (const [label, url] of [
      ['我的房源', '/pages/property/personal?kind=mine'],
      ['发布房源', '/pages/property/edit'],
      ['业主预约', '/pages/property/bookings?role=owner'],
    ]) {
      await tap(label)
      expect(uni.navigateTo).toHaveBeenLastCalledWith({ url })
    }
  })
  it('加载失败关闭权限，点击重试可恢复，不循环登录', async () => {
    mocks.me.mockRejectedValueOnce(new Error('network')).mockResolvedValue({ isPropertyManager: true })
    await open(ManagerPage)
    expect(wrapper!.text()).toContain('管理身份核验失败')
    expectNoPublishing()
    expect(mocks.login).not.toHaveBeenCalled()
    await tap('重新核验')
    expect(mocks.me).toHaveBeenCalledTimes(2)
    expect(wrapper!.text()).toContain('公寓管家工作台')
  })
  it('每次 onShow 重新核验，旧 page 请求不能恢复管理权限', async () => {
    const old = deferred<{ isPropertyManager: boolean }>()
    mocks.me.mockReturnValueOnce(old.promise)
    await open(ManagerPage)
    mocks.hooks.hide()
    mocks.hooks.show()
    await flushPromises()
    old.resolve({ isPropertyManager: true })
    await flushPromises()
    expectNoPublishing()
    expect(mocks.me).toHaveBeenCalledTimes(2)
  })
  it.each(['resolve', 'reject'] as const)('token 往返切换后丢弃旧响应 %s', async (result) => {
    const old = deferred<{ isPropertyManager: boolean }>()
    mocks.me.mockReturnValueOnce(old.promise)
    await open(ManagerPage)
    token.validToken = 'second'
    token.validToken = 'first'
    await nextTick()
    if (result === 'resolve')
      old.resolve({ isPropertyManager: true })
    else
      old.reject(new Error('401'))
    await flushPromises()
    expectNoPublishing()
    expect(mocks.login).not.toHaveBeenCalled()
  })
  it('onUnload 后的成功不更新页面，咨询也要求有效登录', async () => {
    const pending = deferred<{ isPropertyManager: boolean }>()
    mocks.me.mockReturnValueOnce(pending.promise)
    await open(ManagerPage)
    mocks.hooks.unload()
    pending.resolve({ isPropertyManager: true })
    await flushPromises()
    expectNoPublishing()
    token.validToken = ''
    token.hasLogin = false
    await tap('在线咨询')
    expect(mocks.login).toHaveBeenCalledOnce()
    expect(uni.navigateTo).not.toHaveBeenCalled()
  })
})

describe('编辑计价契约与深链守卫', () => {
  it.each([false, undefined, 'true'])('非明确管家 %s 不渲染可写表单', async (flag) => {
    mocks.me.mockResolvedValue({ isPropertyManager: flag })
    await open(EditPage, { id: 'p1' })
    expect(wrapper!.find('input').exists()).toBe(false)
    expect(mocks.detail).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('me 失败可重试但不放行，登录缺失不自动导航', async () => {
    mocks.me.mockRejectedValueOnce(new Error('network')).mockResolvedValue({ isPropertyManager: true })
    await open(EditPage)
    expect(wrapper!.text()).toContain('管理身份核验失败')
    expect(wrapper!.find('input').exists()).toBe(false)
    await tap('重新加载')
    expect(wrapper!.find('input').exists()).toBe(true)
    token.validToken = ''
    token.hasLogin = false
    await nextTick()
    expect(wrapper!.find('input').exists()).toBe(false)
    expect(mocks.login).not.toHaveBeenCalled()
  })
  it('新表单默认月租，单间/月、短租/天随模式同步，出售清空单位与模式', async () => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    await open(EditPage)
    expect(wrapper!.text()).toContain('租金（元/月）*')
    await wrapper!.get('input[maxlength="100"]').setValue('新房源')
    await wrapper!.get('input[maxlength="200"]').setValue('测试地址')
    await tap('存为草稿')
    expect(mocks.save).toHaveBeenLastCalledWith('', expect.objectContaining({ priceUnit: 'month', rentalMode: null }))
    const modes: [number, Property['rentalMode'], string][] = [[4, 'short', 'day'], [3, 'room', 'month'], [2, 'shared', 'month'], [1, 'whole', 'month'], [0, null, 'month']]
    for (const [index, mode, unit] of modes) {
      await wrapper!.findAll('.picker-stub')[2].trigger('change', { detail: { value: index } })
      expect(wrapper!.text()).toContain(unit === 'day' ? '租金（元/天）*' : '租金（元/月）*')
      await tap('存为草稿')
      expect(mocks.save).toHaveBeenLastCalledWith('', expect.objectContaining({ priceUnit: unit, rentalMode: mode }))
    }
    await wrapper!.findAll('.picker-stub')[2].trigger('change', { detail: { value: 4 } })
    await wrapper!.findAll('.picker-stub')[1].trigger('change', { detail: { value: 1 } })
    expect(wrapper!.text()).toContain('总价（元）*')
    await tap('保存并上架')
    expect(mocks.save).toHaveBeenLastCalledWith('', expect.objectContaining({ priceType: 'sale', priceUnit: null, rentalMode: null, status: 2 }))
  })
  it('旧短租房源回填按 mode 归一为天，同账号 onShow 不覆盖已填内容', async () => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    mocks.detail.mockResolvedValue(property({ priceUnit: 'month' }))
    await open(EditPage, { id: 'p1' })
    expect(wrapper!.text()).toContain('民宿短租')
    expect(wrapper!.text()).toContain('租金（元/天）*')
    await wrapper!.get('input[maxlength="100"]').setValue('保留标题')
    mocks.hooks.show()
    await flushPromises()
    await tap('存为草稿')
    expect(mocks.save).toHaveBeenLastCalledWith('p1', expect.objectContaining({ title: '保留标题', priceUnit: 'day' }))
    expect(mocks.detail).toHaveBeenCalledOnce()
  })
  it('旧 token 的 me/detail 回应不能打开表单', async () => {
    const pending = deferred<Property>()
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    mocks.detail.mockReturnValueOnce(pending.promise)
    await open(EditPage, { id: 'p1' })
    token.validToken = 'second'
    token.validToken = 'first'
    pending.resolve(property())
    await flushPromises()
    expect(wrapper!.find('input').exists()).toBe(false)
  })
  it.each([
    ['denied', 'checking'],
    ['denied', 'after-verification'],
    ['error', 'checking'],
    ['error', 'after-verification'],
  ])('同 token 重验 %s，选图返回 %s 不上传；恢复时保留输入且可重新选图', async (result, timing) => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    await open(EditPage, { id: 'p1' })
    await wrapper!.get('input[maxlength="100"]').setValue('保留输入')
    await tap('选择图片')
    const selection = vi.mocked(uni.chooseImage).mock.calls[0][0]!
    const check = deferred<{ isPropertyManager: boolean }>()
    mocks.me.mockReturnValueOnce(check.promise)
    mocks.hooks.show()
    if (timing === 'checking')
      selection.success!({ tempFilePaths: ['/tmp/old.jpg'], tempFiles: [], errMsg: 'ok' })
    await flushPromises()
    expect(mocks.upload).not.toHaveBeenCalled()
    if (result === 'denied')
      check.resolve({ isPropertyManager: false })
    else
      check.reject(new Error('network'))
    await flushPromises()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(wrapper!.find('input').exists()).toBe(false)
    mocks.hooks.show()
    await flushPromises()
    if (timing === 'after-verification')
      selection.success!({ tempFilePaths: ['/tmp/old.jpg'], tempFiles: [], errMsg: 'ok' })
    await flushPromises()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(wrapper!.get('input[maxlength="100"]').element).toHaveProperty('value', '保留输入')
    expect(mocks.detail).toHaveBeenCalledOnce()
    await tap('选择图片')
    expect(uni.chooseImage).toHaveBeenCalledTimes(2)
    vi.mocked(uni.chooseImage).mock.calls[1][0]!.success!({ tempFilePaths: ['/tmp/new.jpg'], tempFiles: [], errMsg: 'ok' })
    await flushPromises()
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith('/tmp/new.jpg')
    expect(wrapper!.get('textarea[maxlength="9009"]').element).toHaveProperty('value', 'https://example.com/new.jpg')
  })
  it.each(['before-show', 'checking', 'verified'])('微信选图返回时机 %s：等待最新管家重验后正常上传', async (timing) => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    await open(EditPage)
    await wrapper!.get('input[maxlength="100"]').setValue('保留标题')
    await tap('选择图片')
    const selection = vi.mocked(uni.chooseImage).mock.calls[0][0]!
    const check = deferred<{ isPropertyManager: boolean }>()
    mocks.me.mockReturnValueOnce(check.promise)
    const selected = () => selection.success!({ tempFilePaths: ['/tmp/new.jpg'], tempFiles: [], errMsg: 'ok' })
    if (timing === 'before-show')
      selected()
    mocks.hooks.show()
    if (timing === 'checking')
      selected()
    await flushPromises()
    expect(mocks.upload).not.toHaveBeenCalled()
    check.resolve({ isPropertyManager: true })
    await flushPromises()
    if (timing === 'verified') {
      selected()
      await flushPromises()
    }
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith('/tmp/new.jpg')
    expect(wrapper!.get('textarea[maxlength="9009"]').element).toHaveProperty('value', 'https://example.com/new.jpg')
    expect(wrapper!.get('input[maxlength="100"]').element).toHaveProperty('value', '保留标题')
    expect(wrapper!.text()).toContain('选择图片（1/9）')
  })
  it('重叠 onShow 时选图等待最新核验，旧核验通过不提前上传', async () => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    await open(EditPage)
    await tap('选择图片')
    const first = deferred<{ isPropertyManager: boolean }>()
    const latest = deferred<{ isPropertyManager: boolean }>()
    mocks.me.mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise)
    mocks.hooks.show()
    vi.mocked(uni.chooseImage).mock.calls[0][0]!.success!({ tempFilePaths: ['/tmp/photo.jpg'], tempFiles: [], errMsg: 'ok' })
    mocks.hooks.show()
    first.resolve({ isPropertyManager: true })
    await flushPromises()
    expect(mocks.upload).not.toHaveBeenCalled()
    latest.resolve({ isPropertyManager: false })
    await flushPromises()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it('最新核验先通过时不被未完成旧核验阻塞，旧拒绝不能取消合法上传', async () => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    await open(EditPage)
    await tap('选择图片')
    const old = deferred<{ isPropertyManager: boolean }>()
    const latest = deferred<{ isPropertyManager: boolean }>()
    const upload = deferred<string>()
    mocks.upload.mockReturnValueOnce(upload.promise)
    mocks.me.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
    mocks.hooks.show()
    vi.mocked(uni.chooseImage).mock.calls[0][0]!.success!({ tempFilePaths: ['/tmp/new.jpg'], tempFiles: [], errMsg: 'ok' })
    mocks.hooks.show()
    latest.resolve({ isPropertyManager: true })
    await flushPromises()
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith('/tmp/new.jpg')
    old.resolve({ isPropertyManager: false })
    await flushPromises()
    expect(wrapper!.text()).toContain('图片上传中')
    upload.resolve('https://example.com/fresh.jpg')
    await flushPromises()
    expect(wrapper!.get('textarea[maxlength="9009"]').element).toHaveProperty('value', 'https://example.com/fresh.jpg')
  })
  it.each(['token', 'unload', 'unmount'])('%s 使旧选择回调失效，不上传', async (boundary) => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    await open(EditPage)
    await tap('选择图片')
    const selection = vi.mocked(uni.chooseImage).mock.calls[0][0]!
    if (boundary === 'token') {
      token.validToken = 'second'
      token.validToken = 'first'
      mocks.hooks.show()
      await flushPromises()
    }
    else if (boundary === 'unload') {
      mocks.hooks.unload()
    }
    else {
      wrapper!.unmount()
      wrapper = undefined
    }
    selection.success!({ tempFilePaths: ['/tmp/old.jpg'], tempFiles: [], errMsg: 'ok' })
    await flushPromises()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it('选图取消在 onShow 核验中也能清 uploading，核验通过后可再次选择', async () => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    await open(EditPage)
    await tap('选择图片')
    const check = deferred<{ isPropertyManager: boolean }>()
    mocks.me.mockReturnValueOnce(check.promise)
    mocks.hooks.show()
    vi.mocked(uni.chooseImage).mock.calls[0][0]!.fail!({ errMsg: 'cancel' })
    check.resolve({ isPropertyManager: true })
    await flushPromises()
    await tap('选择图片')
    expect(uni.chooseImage).toHaveBeenCalledTimes(2)
  })
  it.each(['recheck', 'token', 'unload'])('%s 后旧上传不回填、不继续下一张，也不清新上传状态', async (boundary) => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    const old = deferred<string>()
    const fresh = deferred<string>()
    mocks.upload.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
    await open(EditPage)
    await tap('选择图片')
    vi.mocked(uni.chooseImage).mock.calls[0][0]!.success!({ tempFilePaths: ['/tmp/old.jpg', '/tmp/old2.jpg'], tempFiles: [], errMsg: 'ok' })
    await flushPromises()
    expect(mocks.upload).toHaveBeenCalledOnce()
    if (boundary === 'token') {
      token.validToken = 'second'
      token.validToken = 'first'
    }
    if (boundary === 'unload') {
      mocks.hooks.unload()
    }
    else {
      mocks.hooks.show()
      await flushPromises()
      await tap('选择图片')
      vi.mocked(uni.chooseImage).mock.calls[1][0]!.success!({ tempFilePaths: ['/tmp/new.jpg'], tempFiles: [], errMsg: 'ok' })
      await flushPromises()
    }
    old.resolve('https://example.com/old.jpg')
    await flushPromises()
    expect(wrapper!.get('textarea[maxlength="9009"]').element).toHaveProperty('value', '')
    expect(mocks.upload).toHaveBeenCalledTimes(boundary === 'unload' ? 1 : 2)
    if (boundary !== 'unload') {
      expect(wrapper!.text()).toContain('图片上传中')
      fresh.resolve('https://example.com/fresh.jpg')
      await flushPromises()
      expect(wrapper!.get('textarea[maxlength="9009"]').element).toHaveProperty('value', 'https://example.com/fresh.jpg')
    }
  })
  it.each(['resolve', 'reject'])('新核验清 saving；旧保存 %s 不提示/导航，也不解锁新保存', async (result) => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    const old = deferred<void>()
    const fresh = deferred<void>()
    mocks.save.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
    await open(EditPage, { id: 'p1' })
    await tap('存为草稿')
    mocks.hooks.show()
    await flushPromises()
    await tap('存为草稿')
    expect(mocks.save).toHaveBeenCalledTimes(2)
    if (result === 'resolve')
      old.resolve(undefined)
    else
      old.reject(new Error('old save'))
    await flushPromises()
    expect(uni.showToast).not.toHaveBeenCalled()
    expect(uni.navigateBack).not.toHaveBeenCalled()
    expect(wrapper!.findAll('button').find(node => node.text() === '存为草稿')!.attributes('disabled')).toBeDefined()
    await tap('存为草稿')
    expect(mocks.save).toHaveBeenCalledTimes(2)
    fresh.resolve(undefined)
    await flushPromises()
    expect(uni.navigateBack).toHaveBeenCalledOnce()
  })
})

describe('个人旧列表守卫与计价', () => {
  it.each([false, undefined, 'true'])('mine 深链仅向明确管家展示维护入口（%s 不放行）', async (flag) => {
    mocks.me.mockResolvedValue({ isPropertyManager: flag })
    await open(PersonalPage, { kind: 'mine' })
    expect(wrapper!.text()).toContain('房源由公寓管家统一维护')
    expect(wrapper!.text()).not.toContain('发布房源')
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it('身份失败有重试，成功后的维护按钮能操作', async () => {
    mocks.me.mockRejectedValueOnce(new Error('network')).mockResolvedValue({ isPropertyManager: true })
    await open(PersonalPage)
    expect(wrapper!.text()).toContain('管理身份核验失败')
    expect(mocks.list).not.toHaveBeenCalled()
    await tap('重新核验')
    expect(mocks.list).toHaveBeenCalledWith('mine', 1)
    await tap('编辑')
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/property/edit?id=p1' })
    await tap('下架')
    expect(mocks.status).toHaveBeenCalledWith('p1', 3)
  })
  it.each(['favorites', 'history'])('%s 不增加管家身份限制，显示真实单位及标签', async (kind) => {
    await open(PersonalPage, { kind })
    expect(mocks.me).not.toHaveBeenCalled()
    expect(mocks.list).toHaveBeenCalledWith(kind, 1)
    expect(wrapper!.text()).toContain('/天')
    expect(wrapper!.text()).toContain('民宿短租')
    expect(wrapper!.text()).not.toContain('发布房源')
    if (kind === 'favorites') {
      await wrapper!.get('button[aria-label="取消收藏"]').trigger('tap')
      await flushPromises()
      expect(mocks.favorite).toHaveBeenCalledWith('p1')
    }
  })
  it('onShow 重验并丢弃换账号后的旧 mine 列表', async () => {
    const old = deferred<{ list: Property[], total: number }>()
    mocks.me.mockResolvedValueOnce({ isPropertyManager: true })
    mocks.list.mockReturnValueOnce(old.promise)
    await open(PersonalPage)
    token.validToken = 'second'
    mocks.hooks.show()
    await flushPromises()
    old.resolve({ list: [property()], total: 1 })
    await flushPromises()
    expect(wrapper!.text()).not.toContain('发布房源')
    expect(wrapper!.text()).not.toContain('测试房源')
    expect(mocks.me).toHaveBeenCalledTimes(2)
  })
  it('删除确认框回调不能跨账号删除', async () => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    await open(PersonalPage)
    await tap('删除')
    const modal = vi.mocked(uni.showModal).mock.calls[0][0]!
    token.validToken = 'second'
    modal.success!({ confirm: true, cancel: false, errMsg: 'ok' })
    await flushPromises()
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it.each(['mine', 'favorites', 'history'])('%s 未登录不请求私人列表，仅主动登录引导', async (kind) => {
    token.validToken = ''
    token.hasLogin = false
    await open(PersonalPage, { kind })
    expect(wrapper!.text()).toContain('登录后查看')
    expect(mocks.me).not.toHaveBeenCalled()
    expect(mocks.list).not.toHaveBeenCalled()
    expect(mocks.login).not.toHaveBeenCalled()
    mocks.hooks.bottom()
    await flushPromises()
    expect(mocks.list).not.toHaveBeenCalled()
    await tap('去登录')
    expect(mocks.login).toHaveBeenCalledOnce()
    if (kind !== 'mine') {
      token.hasLogin = true
      token.validToken = 'second'
      mocks.hooks.show()
      await flushPromises()
      expect(wrapper!.text()).toContain('测试房源')
      expect(mocks.me).not.toHaveBeenCalled()
    }
  })
  it.each([
    ['favorites', 'resolve'],
    ['favorites', 'reject'],
    ['history', 'resolve'],
    ['history', 'reject'],
  ])('%s token 往返切换清列表/分页，旧分页 %s 不回填、不报错', async (kind, result) => {
    const old = deferred<{ list: Property[], total: number }>()
    mocks.list.mockResolvedValueOnce({ list: [property({ title: '旧账号房源' })], total: 2 }).mockReturnValueOnce(old.promise)
    await open(PersonalPage, { kind })
    mocks.hooks.bottom()
    await flushPromises()
    token.validToken = 'second'
    token.validToken = 'first'
    await nextTick()
    expect(wrapper!.text()).not.toContain('旧账号房源')
    expect(wrapper!.text()).not.toContain('共 2 套')
    expect(wrapper!.text()).not.toContain('正在加载')
    mocks.hooks.show()
    await flushPromises()
    if (result === 'resolve')
      old.resolve({ list: [property({ id: 'old', title: '迟到旧房源' })], total: 2 })
    else
      old.reject(new Error('old list'))
    await flushPromises()
    expect(mocks.list.mock.calls.map(call => call.slice(0, 2))).toEqual([[kind, 1], [kind, 2], [kind, 1]])
    expect(wrapper!.text()).toContain('测试房源')
    expect(wrapper!.text()).not.toContain('迟到旧房源')
    expect(wrapper!.text()).not.toContain('加载失败')
    expect(mocks.me).not.toHaveBeenCalled()
  })
  it.each(['favorites', 'history'])('%s 卸载后的列表响应被丢弃', async (kind) => {
    const pending = deferred<{ list: Property[], total: number }>()
    mocks.list.mockReturnValueOnce(pending.promise)
    await open(PersonalPage, { kind })
    mocks.hooks.unload()
    pending.resolve({ list: [property()], total: 1 })
    await flushPromises()
    expect(wrapper!.text()).not.toContain('测试房源')
    mocks.hooks.show()
    expect(mocks.list).toHaveBeenCalledOnce()
  })
  it('mine hide 失效列表及删除确认守卫；普通私人列表 hide 不增加管理核验', async () => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    await open(PersonalPage)
    await tap('删除')
    const modal = vi.mocked(uni.showModal).mock.calls[0][0]!
    mocks.hooks.hide()
    modal.success!({ confirm: true, cancel: false, errMsg: 'ok' })
    await nextTick()
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(wrapper!.text()).not.toContain('测试房源')
    expect(wrapper!.text()).not.toContain('发布房源')
    wrapper!.unmount()
    await open(PersonalPage, { kind: 'favorites' })
    mocks.hooks.hide()
    await nextTick()
    expect(wrapper!.text()).toContain('测试房源')
    expect(mocks.me).toHaveBeenCalledOnce()
  })
  it.each([
    ['token', false],
    ['token', true],
    ['refresh', false],
    ['refresh', true],
    ['unload', false],
    ['unload', true],
    ['unmount', false],
    ['unmount', true],
  ] as const)('取消收藏 %s 后旧响应 favorited=%s 不改列表、不提示、不刷新', async (boundary, favorited) => {
    const old = deferred<{ favorited: boolean }>()
    mocks.favorite.mockReturnValueOnce(old.promise)
    await open(PersonalPage, { kind: 'favorites' })
    await tap('取消收藏')
    if (boundary === 'token') {
      token.validToken = 'second'
      token.validToken = 'first'
    }
    if (boundary === 'token' || boundary === 'refresh') {
      mocks.list.mockResolvedValue({ list: [property({ title: '当前列表' })], total: 1 })
      mocks.hooks.show()
      await flushPromises()
    }
    else if (boundary === 'unload') {
      mocks.hooks.unload()
    }
    else {
      wrapper!.unmount()
      wrapper = undefined
    }
    const calls = mocks.list.mock.calls.length
    old.resolve({ favorited })
    await flushPromises()
    expect(mocks.list).toHaveBeenCalledTimes(calls)
    expect(uni.showToast).not.toHaveBeenCalled()
    if (boundary === 'token' || boundary === 'refresh') {
      expect(wrapper!.text()).toContain('当前列表')
      expect(wrapper!.text()).toContain('共 1 套')
    }
    else if (boundary === 'unload') {
      expect(wrapper!.text()).toContain('测试房源')
    }
  })
  it('换 token 后尚未重渲染的旧收藏按钮也不能发起请求', async () => {
    await open(PersonalPage, { kind: 'favorites' })
    const button = wrapper!.get('button[aria-label="取消收藏"]')
    token.validToken = 'second'
    button.element.dispatchEvent(new Event('tap'))
    await flushPromises()
    expect(mocks.favorite).not.toHaveBeenCalled()
  })
  it.each([
    ['mine', 'resolve', 'token'],
    ['mine', 'reject', 'token'],
    ['favorites', 'resolve', 'token'],
    ['favorites', 'reject', 'token'],
    ['mine', 'resolve', 'hide'],
    ['mine', 'reject', 'hide'],
  ])('%s 旧 busy finally（%s，%s）不能解锁新操作', async (kind, result, boundary) => {
    mocks.me.mockResolvedValue({ isPropertyManager: true })
    const old = deferred<{ favorited: boolean }>()
    const fresh = deferred<{ favorited: boolean }>()
    const operation = kind === 'mine' ? mocks.status : mocks.favorite
    operation.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
    await open(PersonalPage, { kind })
    const label = kind === 'mine' ? '下架' : '取消收藏'
    await tap(label)
    if (boundary === 'token')
      token.validToken = 'second'
    else
      mocks.hooks.hide()
    mocks.hooks.show()
    await flushPromises()
    await tap(label)
    expect(operation).toHaveBeenCalledTimes(2)
    if (result === 'resolve')
      old.resolve({ favorited: false })
    else
      old.reject(new Error('old operation'))
    await flushPromises()
    expect(uni.showToast).not.toHaveBeenCalled()
    const button = wrapper!.findAll('button').find(node => node.attributes('aria-label') === label || node.text() === label)!
    expect(button.attributes('disabled')).toBeDefined()
    await tap(label)
    expect(operation).toHaveBeenCalledTimes(2)
    fresh.resolve({ favorited: false })
    await flushPromises()
    expect(uni.showToast).toHaveBeenCalledOnce()
  })
})

describe('详情与列表共用单位/标签，分享不硬编码月租', () => {
  it.each([
    ['short', 'day', 'rent', '/天', '民宿短租'],
    ['room', 'month', 'rent', '/月', '单间'],
    ['whole', null, 'rent', '/月', '整租'],
    ['shared', 'month', 'rent', '/月', '合租'],
    [null, null, 'sale', '元', ''],
  ] as const)('%s %s %s', async (mode, unit, priceType, suffix, label) => {
    mocks.detail.mockResolvedValue(property({ rentalMode: mode, priceUnit: unit, priceType }))
    await open(DetailPage, { id: 'p1' })
    expect(wrapper!.get('.text-28px').element.parentElement!.textContent).toContain(suffix)
    if (label)
      expect(wrapper!.text()).toContain(label)
    expect(mocks.hooks.share()).toEqual(expect.objectContaining({ title: `测试房源 ¥180${suffix}`, path: '/pages/property/detail?id=p1' }))
    expect(mocks.hooks.timeline()).toEqual(expect.objectContaining({ title: `测试房源 ¥180${suffix}`, query: 'id=p1' }))
    wrapper!.unmount()
    mocks.list.mockResolvedValue({ list: [property({ rentalMode: mode, priceUnit: unit, priceType })], total: 1 })
    await open(PersonalPage, { kind: 'history' })
    expect(wrapper!.get('.text-18px').element.parentElement!.textContent).toContain(suffix)
    if (label)
      expect(wrapper!.text()).toContain(label)
  })
})
