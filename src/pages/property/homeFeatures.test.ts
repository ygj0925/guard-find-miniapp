import { flushPromises, mount } from '@vue/test-utils'
import { vi } from 'vitest'
import Support from '../message/support.vue'
import Activities from './activities.vue'

const state = vi.hoisted(() => ({
  home: vi.fn(),
  properties: vi.fn(),
  login: vi.fn(),
  loggedIn: false,
  load: undefined as undefined | ((query: { id?: string }) => void),
  show: undefined as undefined | (() => void),
  more: undefined as undefined | (() => void),
  unload: undefined as undefined | (() => void),
}))
vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (fn: typeof state.load) => { state.load = fn },
  onShow: (fn: typeof state.show) => { state.show = fn },
  onReachBottom: (fn: typeof state.more) => { state.more = fn },
  onUnload: (fn: typeof state.unload) => { state.unload = fn },
  onPullDownRefresh: vi.fn(),
}))
vi.mock('@/api/propertyHome', () => ({ fetchPropertyHome: state.home }))
vi.mock('@/api/property', () => ({ fetchProperties: state.properties }))
vi.mock('@/store/token', () => ({ useTokenStore: () => ({ updateNowTime: () => ({ hasLogin: state.loggedIn }) }) }))
vi.mock('@/utils/toLoginPage', () => ({ toLoginPage: state.login }))

const activity = { id: 'event', title: '验收活动', description: '<script>plain text</script>', propertyIds: ['1'] }
const emptyHome = { supportPhone: null, serviceHours: null, banners: [], activities: [] }
let wrapper: ReturnType<typeof mount> | undefined
function button(text: string) {
  return wrapper!.findAll('button').find(item => item.text() === text)!
}
async function openActivities(id?: string) {
  wrapper = mount(Activities, {
    global: { stubs: { PropertyCard: { props: ['item'], template: '<div>{{ item.title }}</div>' } } },
  })
  state.load?.({ id })
  await flushPromises()
}
async function openSupport() {
  wrapper = mount(Support)
  state.show?.()
  await flushPromises()
}
beforeEach(() => {
  vi.stubGlobal('definePage', vi.fn())
  vi.stubGlobal('uni', { navigateTo: vi.fn(), switchTab: vi.fn(), makePhoneCall: vi.fn(), stopPullDownRefresh: vi.fn() })
  state.home.mockReset().mockResolvedValue(emptyHome)
  state.properties.mockReset().mockResolvedValue({ list: [], total: 0 })
  state.login.mockReset()
  state.loggedIn = false
  state.load = undefined
  state.show = undefined
  state.more = undefined
  state.unload = undefined
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('优惠活动', () => {
  it('无活动显示真实空态，不查询全部房源', async () => {
    await openActivities()
    expect(wrapper!.text()).toContain('暂无正在进行的优惠活动')
    expect(state.properties).not.toHaveBeenCalled()
  })
  it('无效或过期深链不回退全部房源', async () => {
    await openActivities('expired')
    expect(wrapper!.text()).toContain('活动不存在或已结束')
    expect(state.properties).not.toHaveBeenCalled()
  })
  it('列表入口正确编码 ID，详情描述仅作为文本展示', async () => {
    state.home.mockResolvedValue({ ...emptyHome, activities: [activity] })
    await openActivities()
    await wrapper!.get('button').trigger('tap')
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/property/activities?id=event' })
    state.load?.({ id: 'event' })
    await flushPromises()
    expect(state.properties).toHaveBeenCalledWith({ page: 1, size: 10, activityId: 'event', sort: 'newest' })
    expect(wrapper!.text()).toContain(activity.description)
    expect(wrapper!.find('script').exists()).toBe(false)
    expect(wrapper!.text()).toContain('暂无可展示的活动房源')
  })
  it('分页失败保留活动房源，重试仍带相同活动 ID', async () => {
    state.home.mockResolvedValue({ ...emptyHome, activities: [activity] })
    state.properties.mockResolvedValueOnce({ list: [{ id: '1', title: '房源1' }], total: 2 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ list: [{ id: '2', title: '房源2' }], total: 2 })
    await openActivities('event')
    state.more?.()
    await flushPromises()
    expect(wrapper!.text()).toContain('房源1')
    expect(wrapper!.text()).toContain('更多房源加载失败')
    await button('重试加载').trigger('tap')
    await flushPromises()
    expect(state.properties).toHaveBeenLastCalledWith({ page: 2, size: 10, activityId: 'event', sort: 'newest' })
    expect(wrapper!.text()).toContain('房源2')
  })
  it('配置失败可重试，卸载后旧配置响应不发起房源请求', async () => {
    state.home.mockRejectedValueOnce(new Error('offline'))
    await openActivities('event')
    expect(wrapper!.text()).toContain('活动加载失败')
    let complete!: (home: typeof emptyHome) => void
    state.home.mockReturnValueOnce(new Promise((resolve) => {
      complete = resolve
    }))
    await button('重新加载').trigger('tap')
    state.unload?.()
    complete({ ...emptyHome, activities: [activity] } as unknown as typeof emptyHome)
    await flushPromises()
    expect(state.properties).not.toHaveBeenCalled()
  })
})

describe('客服中心', () => {
  it('空配置不编造电话，未登录在线咨询引导登录', async () => {
    await openSupport()
    expect(wrapper!.text()).toContain('电话暂未配置')
    await button('联系公寓管家').trigger('tap')
    expect(state.login).toHaveBeenCalledOnce()
    expect(uni.navigateTo).not.toHaveBeenCalled()
    expect(uni.makePhoneCall).not.toHaveBeenCalled()
  })
  it('配置电话号码和时间可拨打，登录后进入真实客服聊天', async () => {
    state.loggedIn = true
    state.home.mockResolvedValue({ ...emptyHome, supportPhone: '400-123-4567', serviceHours: '09:00-18:00' })
    await openSupport()
    expect(wrapper!.text()).toContain('09:00-18:00')
    await button('拨打咨询电话').trigger('tap')
    expect(uni.makePhoneCall).toHaveBeenCalledWith({ phoneNumber: '400-123-4567' })
    await button('联系公寓管家').trigger('tap')
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/message/chat?mode=support' })
  })
  it('配置读取失败显示重试并恢复空态', async () => {
    state.home.mockRejectedValueOnce(new Error('offline'))
    await openSupport()
    expect(wrapper!.text()).toContain('咨询信息加载失败')
    await button('重新加载').trigger('tap')
    await flushPromises()
    expect(wrapper!.text()).toContain('电话暂未配置')
    expect(state.home).toHaveBeenCalledTimes(2)
  })
})
