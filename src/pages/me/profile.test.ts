import type { IUserInfoRes } from '@/api/types/login'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  upload: vi.fn(),
  setUserInfo: vi.fn(),
  login: vi.fn(),
  hooks: {} as { show: () => void, hide: () => void, unload: () => void },
}))
let token: { validToken: string, updateNowTime: () => typeof token }
vi.mock('@dcloudio/uni-app', () => ({
  onShow: (callback: () => void) => { mocks.hooks.show = callback },
  onHide: (callback: () => void) => { mocks.hooks.hide = callback },
  onUnload: (callback: () => void) => { mocks.hooks.unload = callback },
}))
vi.mock('@/http/http', () => ({ http: { get: mocks.get, put: mocks.put } }))
vi.mock('@/api/propertyImage', () => ({ uploadPropertyImage: mocks.upload }))
vi.mock('@/store/token', () => ({ useTokenStore: () => token }))
vi.mock('@/store/user', () => ({
  useUserStore: () => ({
    userInfo: { nickname: '缓存昵称', avatar: '/static/images/default-avatar.png' },
    setUserInfo: mocks.setUserInfo,
  }),
}))
vi.mock('@/utils/toLoginPage', () => ({ toLoginPage: mocks.login }))

const original: IUserInfoRes = { userId: 7, username: 'user7', nickname: '原昵称', avatar: '', isPropertyManager: false }
const updated: IUserInfoRes = { ...original, nickname: '新昵称', avatar: 'https://images.example.com/avatar.png' }
const options = { header: { Authorization: 'Bearer first' }, hideErrorToast: true }
let wrapper: ReturnType<typeof mount> | undefined

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
  token = reactive({ validToken: 'first', updateNowTime: () => token })
  mocks.get.mockReset().mockResolvedValue({ ...original })
  mocks.put.mockReset().mockResolvedValue({ ...updated })
  mocks.upload.mockReset().mockResolvedValue(updated.avatar)
  mocks.setUserInfo.mockReset()
  mocks.login.mockReset()
  vi.mocked(uni.chooseImage).mockReset()
  vi.stubGlobal('definePage', vi.fn())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function open() {
  const { default: Page } = await import('./profile.vue')
  wrapper = mount(Page)
  mocks.hooks.show()
  await flushPromises()
}

async function tap(label: string) {
  // 直接派发事件，也验证 handler 的 busy 守卫，而不只依赖原生 disabled。
  wrapper!.get(`button[aria-label="${label}"]`).element.dispatchEvent(new Event('tap'))
  await flushPromises()
}

async function name(value: string) {
  await wrapper!.get('input[type="text"]').trigger('input', { detail: { value } })
}

async function chooseWechat(path = 'wxfile://chosen.png') {
  await wrapper!.get('button[open-type="chooseAvatar"]').trigger('chooseavatar', { detail: { avatarUrl: path } })
  await flushPromises()
}

function expectNoCommitOrFeedback() {
  expect(mocks.setUserInfo).not.toHaveBeenCalled()
  expect(uni.showToast).not.toHaveBeenCalled()
  expect(uni.navigateBack).not.toHaveBeenCalled()
  expect(uni.switchTab).not.toHaveBeenCalled()
  expect(mocks.login).not.toHaveBeenCalled()
}

describe('profile page', () => {
  it('loads API data without committing or using the local store avatar', async () => {
    await open()
    expect(mocks.get).toHaveBeenCalledWith('/miniapp/auth/me', undefined, undefined, options)
    expect((wrapper!.get('input[type="text"]').element as HTMLInputElement).value).toBe('原昵称')
    expect(wrapper!.find('image').exists()).toBe(false)
    expect(mocks.setUserInfo).not.toHaveBeenCalled()
    await tap('保存资料')
    expect(mocks.put).toHaveBeenCalledWith('/miniapp/auth/me', { nickname: '原昵称', avatar: '' }, undefined, undefined, options)
  })

  it('shows loading and disables duplicate loads, then offers failure retry', async () => {
    const load = deferred<IUserInfoRes>()
    mocks.get.mockReturnValueOnce(load.promise)
    await open()
    expect(wrapper!.text()).toContain('正在加载资料')
    mocks.hooks.show()
    expect(mocks.get).toHaveBeenCalledOnce()
    load.reject(new Error('加载失败'))
    await flushPromises()
    expect(wrapper!.text()).toContain('加载失败')
    await tap('重试加载资料')
    expect(mocks.get).toHaveBeenCalledTimes(2)
    expect(wrapper!.find('input[type="text"]').exists()).toBe(true)
  })

  it('redirects unauthenticated visitors without requesting user info', async () => {
    token.validToken = ''
    await open()
    expect(mocks.login).toHaveBeenCalledOnce()
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('validates empty and overlong nicknames inline before PUT', async () => {
    await open()
    await name('   ')
    expect(wrapper!.text()).toContain('昵称不能为空')
    await tap('保存资料')
    expect(mocks.put).not.toHaveBeenCalled()
    await name('长'.repeat(65))
    await tap('保存资料')
    expect(wrapper!.text()).toContain('昵称不能超过64个字符')
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it('trims nickname, commits only the successful PUT response, then returns', async () => {
    const save = deferred<IUserInfoRes>()
    mocks.put.mockReturnValueOnce(save.promise)
    await open()
    await name('  新昵称  ')
    await tap('保存资料')
    expect(mocks.put).toHaveBeenCalledWith('/miniapp/auth/me', { nickname: '新昵称', avatar: '' }, undefined, undefined, options)
    expect(mocks.setUserInfo).not.toHaveBeenCalled()
    expect(wrapper!.get('button[aria-label="保存资料"]').attributes('disabled')).toBeDefined()
    await tap('保存资料')
    expect(mocks.put).toHaveBeenCalledOnce()
    save.resolve(updated)
    await flushPromises()
    expect(mocks.setUserInfo).toHaveBeenCalledWith(updated)
    expect(uni.navigateBack).toHaveBeenCalledWith(expect.objectContaining({ delta: 1 }))
    expect(mocks.setUserInfo.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(uni.navigateBack).mock.invocationCallOrder[0])
    await tap('保存资料')
    expect(mocks.put).toHaveBeenCalledOnce()
  })

  it('preserves nickname and uploaded avatar on failed save and permits retry', async () => {
    mocks.put.mockRejectedValueOnce(new Error('保存失败'))
    await open()
    await name('  保留输入  ')
    await chooseWechat()
    expect(mocks.setUserInfo).not.toHaveBeenCalled()
    await tap('保存资料')
    expect(wrapper!.text()).toContain('保存失败')
    expect((wrapper!.get('input[type="text"]').element as HTMLInputElement).value).toBe('  保留输入  ')
    expect(wrapper!.get('image').attributes('src')).toBe('wxfile://chosen.png')
    expect(mocks.setUserInfo).not.toHaveBeenCalled()
    expect(uni.navigateBack).not.toHaveBeenCalled()
    await tap('保存资料')
    expect(mocks.put).toHaveBeenCalledTimes(2)
    expect(mocks.put.mock.calls[1][1]).toEqual({ nickname: '保留输入', avatar: updated.avatar })
    expect(mocks.upload).toHaveBeenCalledOnce()
  })

  it('previews the chosen image while uploading, and keeps upload/save mutually exclusive', async () => {
    const upload = deferred<string>()
    const save = deferred<IUserInfoRes>()
    mocks.upload.mockReturnValueOnce(upload.promise)
    mocks.put.mockReturnValueOnce(save.promise)
    await open()
    await chooseWechat()
    expect(wrapper!.get('image').attributes('src')).toBe('wxfile://chosen.png')
    expect(wrapper!.get('input[type="text"]').attributes('disabled')).toBeDefined()
    await tap('保存资料')
    await chooseWechat('wxfile://duplicate.png')
    expect(mocks.upload).toHaveBeenCalledOnce()
    expect(mocks.put).not.toHaveBeenCalled()
    upload.resolve(updated.avatar!)
    await flushPromises()
    expect(mocks.setUserInfo).not.toHaveBeenCalled()
    await tap('保存资料')
    await tap('选择头像')
    await chooseWechat('wxfile://during-save.png')
    expect(uni.chooseImage).not.toHaveBeenCalled()
    expect(mocks.upload).toHaveBeenCalledOnce()
    expect(mocks.put.mock.calls[0][1]).toEqual({ nickname: '原昵称', avatar: updated.avatar })
    save.resolve(updated)
    await flushPromises()
  })

  it('preserves a failed upload preview and retries before permitting save', async () => {
    mocks.upload.mockRejectedValueOnce(new Error('图片上传失败'))
    await open()
    await name('保留昵称')
    await chooseWechat()
    expect(wrapper!.text()).toContain('图片上传失败')
    expect(wrapper!.get('image').attributes('src')).toBe('wxfile://chosen.png')
    await tap('保存资料')
    expect(mocks.put).not.toHaveBeenCalled()
    await tap('重试头像上传')
    expect(mocks.upload).toHaveBeenCalledTimes(2)
    await tap('保存资料')
    expect(mocks.put.mock.calls[0][1]).toEqual({ nickname: '保留昵称', avatar: updated.avatar })
  })

  it('uses compressed single-image album/camera selection and ignores cancellation', async () => {
    await open()
    await tap('选择头像')
    const picker = vi.mocked(uni.chooseImage).mock.calls[0][0]!
    expect(picker).toEqual(expect.objectContaining({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] }))
    await tap('选择头像')
    await tap('保存资料')
    expect(uni.chooseImage).toHaveBeenCalledOnce()
    expect(mocks.put).not.toHaveBeenCalled()
    picker.fail!({ errMsg: 'chooseImage:fail cancel' })
    await flushPromises()
    expect(wrapper!.text()).not.toContain('无法选择图片')
    expect(uni.showToast).not.toHaveBeenCalled()
    await tap('选择头像')
    const second = vi.mocked(uni.chooseImage).mock.calls[1][0]!
    second.success!({ tempFilePaths: ['blob:chosen'], tempFiles: [{ path: 'blob:chosen', size: 1024 }], errMsg: 'chooseImage:ok' })
    await flushPromises()
    expect(mocks.upload).toHaveBeenCalledWith('blob:chosen')
  })

  it('rejects oversized chosen files before upload', async () => {
    await open()
    await tap('选择头像')
    const picker = vi.mocked(uni.chooseImage).mock.calls[0][0]!
    picker.success!({ tempFilePaths: ['large.png'], tempFiles: [{ path: 'large.png', size: 5 * 1024 * 1024 + 1 }], errMsg: 'chooseImage:ok' })
    await flushPromises()
    expect(wrapper!.text()).toContain('图片不能超过5MB')
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('shows a placeholder when the avatar image fails to load', async () => {
    mocks.get.mockResolvedValueOnce(updated)
    await open()
    await wrapper!.get('image').trigger('error')
    expect(wrapper!.find('image').exists()).toBe(false)
    expect(wrapper!.find('[aria-label="暂无头像"]').exists()).toBe(true)
  })

  it.each(['/static/images/default-avatar.png', 'wxfile://temporary.png', 'ftp://example.com/avatar.png', `https://example.com/${'a'.repeat(1024)}`])('does not submit invalid/local avatar %s', async (avatar) => {
    mocks.get.mockResolvedValueOnce({ ...original, avatar })
    await open()
    await tap('保存资料')
    expect(mocks.put).not.toHaveBeenCalled()
    expect(wrapper!.text()).toContain('头像地址无效')
    await tap('移除头像')
    await tap('保存资料')
    expect(mocks.put.mock.calls[0][1].avatar).toBe('')
  })

  it('rejects a local path returned by the uploader', async () => {
    mocks.upload.mockResolvedValueOnce('wxfile://not-uploaded.png')
    await open()
    await chooseWechat()
    expect(wrapper!.text()).toContain('上传未返回有效头像地址')
    await tap('保存资料')
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it.each(['load', 'upload', 'save'] as const)('discards a late %s success after account changes', async (operation) => {
    const pending = deferred<IUserInfoRes | string>()
    if (operation === 'load')
      mocks.get.mockReturnValueOnce(pending.promise)
    await open()
    if (operation === 'upload') {
      mocks.upload.mockReturnValueOnce(pending.promise)
      await chooseWechat()
    }
    if (operation === 'save') {
      mocks.put.mockReturnValueOnce(pending.promise)
      await name('旧账号输入')
      await tap('保存资料')
    }
    token.validToken = 'second'
    token.validToken = 'first'
    await nextTick()
    const text = wrapper!.text()
    pending.resolve(operation === 'upload' ? updated.avatar! : updated)
    await flushPromises()
    expect(wrapper!.text()).toBe(text)
    expectNoCommitOrFeedback()
  })

  it.each(['load', 'upload', 'save'] as const)('ignores a late %s failure after leaving the page', async (operation) => {
    const pending = deferred<IUserInfoRes | string>()
    if (operation === 'load')
      mocks.get.mockReturnValueOnce(pending.promise)
    await open()
    if (operation === 'upload') {
      mocks.upload.mockReturnValueOnce(pending.promise)
      await chooseWechat()
    }
    if (operation === 'save') {
      mocks.put.mockReturnValueOnce(pending.promise)
      await tap('保存资料')
    }
    mocks.hooks.hide()
    mocks.hooks.unload()
    await nextTick()
    const text = wrapper!.text()
    pending.reject(Object.assign(new Error('迟到的401'), { statusCode: 401, code: 401 }))
    await flushPromises()
    expect(wrapper!.text()).toBe(text)
    expectNoCommitOrFeedback()
  })

  it('ignores a hidden upload success even after the page reappears, and provides retry', async () => {
    const upload = deferred<string>()
    mocks.upload.mockReturnValueOnce(upload.promise)
    await open()
    await name('保留昵称')
    await chooseWechat()
    mocks.hooks.hide()
    mocks.hooks.show()
    await flushPromises()
    expect(wrapper!.text()).toContain('头像上传已中断')
    upload.resolve(updated.avatar!)
    await flushPromises()
    await tap('保存资料')
    expect(mocks.put).not.toHaveBeenCalled()
    await tap('重试头像上传')
    await tap('保存资料')
    expect(mocks.put.mock.calls[0][1].nickname).toBe('保留昵称')
  })

  it('ignores a late chooseImage callback and a late navigation fallback', async () => {
    await open()
    await tap('选择头像')
    const picker = vi.mocked(uni.chooseImage).mock.calls[0][0]!
    mocks.hooks.hide()
    picker.success!({ tempFilePaths: ['old.png'], tempFiles: [], errMsg: 'chooseImage:ok' })
    await flushPromises()
    expect(mocks.upload).not.toHaveBeenCalled()
    mocks.hooks.show()
    await flushPromises()
    await tap('保存资料')
    const back = vi.mocked(uni.navigateBack).mock.calls[0][0]!
    token.validToken = 'second'
    back.fail!({ errMsg: 'navigateBack:fail' })
    expect(uni.switchTab).not.toHaveBeenCalled()
  })

  it('prevents a late PUT success from committing after component disposal', async () => {
    const save = deferred<IUserInfoRes>()
    mocks.put.mockReturnValueOnce(save.promise)
    await open()
    await tap('保存资料')
    wrapper!.unmount()
    wrapper = undefined
    save.resolve(updated)
    await flushPromises()
    expectNoCommitOrFeedback()
  })
})

describe('profile update API', () => {
  it('sends only the allowed fields with PUT and returns the complete user response', async () => {
    const { updateUserInfo } = await import('@/api/login')
    const input = { nickname: '新昵称', avatar: updated.avatar!, phone: 'ignored', isPropertyManager: true }
    const result = await updateUserInfo(input)
    expect(mocks.put).toHaveBeenCalledWith('/miniapp/auth/me', { nickname: '新昵称', avatar: updated.avatar }, undefined, undefined, undefined)
    expect(result).toEqual(updated)
  })
})
