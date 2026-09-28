import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { ResumeItem } from '@/api/resume'
import AiResumePicker from './AiResumePicker.vue'

const resume: ResumeItem = {
  id: '1897293810343682049',
  fileId: '1897293810343682050',
  name: '研发简历',
  fileType: 'pdf',
  isDefault: true,
  uploadedAt: '2026-09-24',
}

function mountPicker(overrides: Partial<InstanceType<typeof AiResumePicker>['$props']> = {}) {
  return mount(AiResumePicker, {
    global: {
      stubs: {
        'scroll-view': { template: '<div><slot /></div>' },
      },
    },
    props: {
      resumes: [resume],
      selectedResumeId: resume.id,
      loading: false,
      uploading: false,
      selecting: false,
      error: false,
      safeBottom: 0,
      ...overrides,
    },
  })
}

describe('ai resume picker', () => {
  it('keeps the sheet open when selecting and attaches the selected resume', async () => {
    const wrapper = mountPicker()
    await wrapper.get('[role="radio"]').trigger('tap')
    expect(wrapper.emitted('select')?.[0]).toEqual([resume])
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.get('button[aria-label="关闭简历选择"]').trigger('tap')
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.findAll('button').find(button => button.text().includes('添加到输入框'))!.trigger('tap')
    expect(wrapper.emitted('attach')).toHaveLength(1)
  })

  it('supports uploading and closing even while an upload is in progress', async () => {
    const wrapper = mountPicker({ resumes: [], selectedResumeId: undefined })
    await wrapper.findAll('button').find(button => button.text().includes('上传新简历'))!.trigger('tap')
    expect(wrapper.emitted('upload')).toHaveLength(1)

    await wrapper.setProps({ uploading: true })
    await wrapper.findAll('button').find(button => button.text() === '取消')!.trigger('tap')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.findAll('button').find(button => button.text().includes('添加到输入框'))!.attributes('disabled')).toBeDefined()
  })

  it('lets users retry a failed list and dismiss the backdrop', async () => {
    const wrapper = mountPicker({ resumes: [], selectedResumeId: undefined, error: true })
    await wrapper.findAll('button').find(button => button.text() === '重新加载')!.trigger('tap')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    await wrapper.find('.fixed.inset-0').trigger('tap')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
