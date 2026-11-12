import { flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BookingsPage from './bookings.vue'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  detail: vi.fn(),
  login: vi.fn(),
  hasLogin: true,
}))
vi.mock('@/api/property', () => ({
  createBooking: mocks.create,
  fetchPropertyDetail: mocks.detail,
  fetchBookings: vi.fn(),
  changeBookingStatus: vi.fn(),
}))
vi.mock('@/store/token', () => ({
  useTokenStore: () => ({ updateNowTime: () => ({ hasLogin: mocks.hasLogin }) }),
}))
vi.mock('@/utils/toLoginPage', () => ({ toLoginPage: mocks.login }))

let wrapper: ReturnType<typeof mount> | undefined
let load: ((query: { propertyId: string }) => void) | undefined
let show: (() => void) | undefined
const valid = {
  date: '2026-11-05',
  time: '10:31',
  contactName: '张三',
  contactPhone: '13800138000',
  remark: '希望上午看房',
}
const payload = {
  bookingTime: '2026-11-05 10:31:00',
  contactName: valid.contactName,
  contactPhone: valid.contactPhone,
  remark: valid.remark,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  // 使用本地时间构造当前时刻，避免测试隐含 UTC 假设。
  vi.setSystemTime(new Date(2026, 10, 5, 10, 30, 0))
  mocks.create.mockReset().mockResolvedValue('booking-1')
  mocks.detail.mockReset().mockResolvedValue({ id: 'property-1', title: '测试房源', images: [] })
  mocks.login.mockReset()
  mocks.hasLogin = true
  load = undefined
  show = undefined
  vi.stubGlobal('definePage', vi.fn())
  // 此页面依赖构建时自动导入，Vitest 中显式提供 Vue 和页面生命周期。
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('onLoad', (callback: typeof load) => {
    load = callback
  })
  vi.stubGlobal('onShow', (callback: typeof show) => {
    show = callback
  })
  vi.stubGlobal('onUnload', vi.fn())
  vi.stubGlobal('onReachBottom', vi.fn())
  vi.stubGlobal('uni', { ...uni, setNavigationBarTitle: vi.fn() })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function open() {
  wrapper = mount(BookingsPage, {
    global: {
      stubs: { picker: { template: '<div class="picker-stub"><slot /></div>' } },
    },
  })
  load?.({ propertyId: 'property-1' })
  show?.()
  await flushPromises()
  expect(mocks.detail).toHaveBeenCalledWith('property-1')
}

async function fill(values = valid) {
  const pickers = wrapper!.findAll('.picker-stub')
  await pickers[0].trigger('change', { detail: { value: values.date } })
  await pickers[1].trigger('change', { detail: { value: values.time } })
  await wrapper!.get('input[aria-label="联系人姓名"]').setValue(values.contactName)
  await wrapper!.get('input[aria-label="联系电话"]').setValue(values.contactPhone)
  await wrapper!.get('textarea').setValue(values.remark)
}

async function submit() {
  // 绕过 test-utils 对 disabled 按钮的事件过滤，验证组件自身的提交守卫。
  wrapper!.get('.booking-submit-bar button').element.dispatchEvent(new Event('tap'))
  await flushPromises()
}

function expectRejected() {
  expect(mocks.create).not.toHaveBeenCalled()
  expect(uni.showToast).toHaveBeenCalledWith({ title: '请填写未来看房时间和联系方式', icon: 'none' })
  expect(uni.navigateBack).not.toHaveBeenCalled()
}

describe('预约提交时间契约', () => {
  it('通过组件提交 yyyy-MM-dd HH:mm:ss 空格格式，不发送 T 或时区', async () => {
    await open()
    await fill()
    await submit()
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('property-1', payload)
    expect(uni.showToast).toHaveBeenCalledWith({ title: '预约已提交，待管家确认', icon: 'none' })
    expect(uni.navigateBack).toHaveBeenCalledOnce()
  })

  it('仅使用 T 格式解析本地未来时间，兼容不接受空格日期的运行时', async () => {
    await open()
    await fill()
    const NativeDate = Date
    const parsed: string[] = []
    vi.stubGlobal('Date', new Proxy(NativeDate, {
      construct(DateConstructor, args) {
        if (typeof args[0] === 'string') {
          parsed.push(args[0])
          // 模拟仅接受 ISO 本地时间的跨平台解析器。
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(args[0]))
            return new DateConstructor(Number.NaN)
        }
        return Reflect.construct(DateConstructor, args)
      },
    }))
    await submit()
    expect(parsed).toEqual(['2026-11-05T10:31:00'])
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('property-1', payload)
  })

  it.each([
    ['同日过去时间', '2026-11-05', '10:29'],
    ['当前时刻', '2026-11-05', '10:30'],
    ['过去日期', '2026-11-04', '23:59'],
    ['无效日期', 'invalid', '10:31'],
  ])('拒绝%s且不调用预约 API', async (_label, date, time) => {
    await open()
    await fill({ ...valid, date, time })
    await submit()
    expectRejected()
  })

  it.each([
    ['date', ''],
    ['time', ''],
    ['contactName', '   '],
    ['contactPhone', '   '],
  ])('拒绝未填写的 %s', async (field, value) => {
    await open()
    await fill({ ...valid, [field]: value })
    await submit()
    expectRejected()
  })

  it('完全未填写时拒绝提交，不将日期选择器默认值当作已填写', async () => {
    await open()
    expect(wrapper!.findAll('.picker-stub')[0].attributes('start')).toBe(valid.date)
    await submit()
    expectRejected()
  })

  it('提交失败保留全部字段并恢复按钮，重试仍发送空格格式', async () => {
    mocks.create.mockRejectedValueOnce(new Error('HTTP 400'))
    await open()
    await fill()
    await submit()
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('property-1', payload)
    expect(wrapper!.text()).toContain('提交失败，填写的信息已保留，请重试。')
    expect(wrapper!.text()).toContain(valid.date)
    expect(wrapper!.text()).toContain(valid.time)
    expect((wrapper!.get('input[aria-label="联系人姓名"]').element as HTMLInputElement).value).toBe(valid.contactName)
    expect((wrapper!.get('input[aria-label="联系电话"]').element as HTMLInputElement).value).toBe(valid.contactPhone)
    expect((wrapper!.get('textarea').element as HTMLTextAreaElement).value).toBe(valid.remark)
    expect(wrapper!.get('.booking-submit-bar button').attributes('disabled')).toBeUndefined()
    expect(uni.navigateBack).not.toHaveBeenCalled()
    expect(uni.showToast).not.toHaveBeenCalled()
    await submit()
    expect(mocks.create).toHaveBeenCalledTimes(2)
    expect(mocks.create).toHaveBeenNthCalledWith(2, 'property-1', payload)
    expect(wrapper!.text()).not.toContain('提交失败')
    expect(uni.navigateBack).toHaveBeenCalledOnce()
  })
})

describe('预约提交状态与导航', () => {
  it('提交未完成时重复 tap 不重复调用 API，表单和按钮禁用，完成后恢复', async () => {
    let complete!: (value: string) => void
    mocks.create.mockReturnValueOnce(new Promise<string>((resolve) => {
      complete = resolve
    }))
    await open()
    await fill()
    await submit()
    const controls = wrapper!.findAll('input, textarea, .booking-submit-bar button')
    const pickers = wrapper!.findAll('.picker-stub')
    expect(controls).toHaveLength(4)
    expect(pickers).toHaveLength(2)
    for (const control of controls)
      expect(control.attributes('disabled')).toBeDefined()
    for (const picker of pickers)
      expect(picker.attributes('disabled')).toBe('true')
    expect(wrapper!.get('.booking-submit-bar button').text()).toBe('正在提交')
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('property-1', payload)
    await submit()
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('property-1', payload)
    expect(uni.showToast).not.toHaveBeenCalled()
    expect(uni.navigateBack).not.toHaveBeenCalled()

    complete('booking-1')
    await flushPromises()
    for (const control of controls)
      expect(control.attributes('disabled')).toBeUndefined()
    for (const picker of pickers)
      expect(picker.attributes('disabled')).toBe('false')
    expect(wrapper!.get('.booking-submit-bar button').text()).toBe('提交预约')
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(uni.showToast).toHaveBeenCalledWith({ title: '预约已提交，待管家确认', icon: 'none' })
    expect(uni.navigateBack).toHaveBeenCalledOnce()
  })

  it('房源详情未完成时拒绝提交，加载成功后可提交', async () => {
    const property = { id: 'property-1', title: '测试房源', images: [] }
    let complete!: (value: typeof property) => void
    mocks.detail.mockReturnValueOnce(new Promise<typeof property>((resolve) => {
      complete = resolve
    }))
    await open()
    await fill()
    expect(wrapper!.text()).toContain('正在获取预约房源')
    expect(wrapper!.get('.booking-submit-bar button').attributes('disabled')).toBeDefined()
    await submit()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(uni.showToast).not.toHaveBeenCalled()
    expect(uni.navigateBack).not.toHaveBeenCalled()

    complete(property)
    await flushPromises()
    expect(wrapper!.text()).not.toContain('正在获取预约房源')
    expect(wrapper!.text()).toContain(property.title)
    expect(wrapper!.get('.booking-submit-bar button').attributes('disabled')).toBeUndefined()
    await submit()
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('property-1', payload)
    expect(uni.navigateBack).toHaveBeenCalledOnce()
  })

  it('房源详情失败后禁用提交，点击重新加载房源成功后可提交', async () => {
    mocks.detail.mockRejectedValueOnce(new Error('房源加载失败'))
    await open()
    await fill()
    expect(wrapper!.text()).toContain('房源加载失败')
    expect(wrapper!.get('.booking-submit-bar button').attributes('disabled')).toBeDefined()
    await submit()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(uni.showToast).not.toHaveBeenCalled()
    expect(uni.navigateBack).not.toHaveBeenCalled()

    const retry = wrapper!.get('button.app-secondary-button')
    expect(retry.text()).toBe('重新加载房源')
    await retry.trigger('tap')
    await flushPromises()
    expect(mocks.detail).toHaveBeenCalledTimes(2)
    expect(mocks.detail).toHaveBeenNthCalledWith(2, 'property-1')
    expect(wrapper!.text()).not.toContain('房源加载失败')
    expect(wrapper!.text()).toContain('测试房源')
    expect(wrapper!.get('.booking-submit-bar button').attributes('disabled')).toBeUndefined()
    await submit()
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('property-1', payload)
    expect(uni.navigateBack).toHaveBeenCalledOnce()
  })

  it('提交成功后 navigateBack 失败时仅 redirectTo 预约列表', async () => {
    await open()
    await fill()
    await submit()
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('property-1', payload)
    expect(uni.showToast).toHaveBeenCalledWith({ title: '预约已提交，待管家确认', icon: 'none' })
    expect(uni.navigateBack).toHaveBeenCalledOnce()
    expect(uni.redirectTo).not.toHaveBeenCalled()

    const back = vi.mocked(uni.navigateBack).mock.calls[0][0]!
    expect(back.fail).toEqual(expect.any(Function))
    back.fail!({ errMsg: 'navigateBack:fail' })
    expect(uni.redirectTo).toHaveBeenCalledExactlyOnceWith({ url: '/pages/property/bookings' })
    expect(uni.navigateBack).toHaveBeenCalledOnce()
    expect(uni.navigateTo).not.toHaveBeenCalled()
    expect(uni.switchTab).not.toHaveBeenCalled()
    expect(uni.reLaunch).not.toHaveBeenCalled()
  })

  it('未登录时拒绝提交并调用登录引导', async () => {
    mocks.hasLogin = false
    await open()
    await fill()
    expect(mocks.login).not.toHaveBeenCalled()
    await submit()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.login).toHaveBeenCalledOnce()
    expect(uni.showToast).not.toHaveBeenCalled()
    expect(uni.navigateBack).not.toHaveBeenCalled()
    expect(uni.redirectTo).not.toHaveBeenCalled()
  })
})
