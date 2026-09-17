import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { AiMessageExtension } from '../aiHistory'
import AiFormCard from './AiFormCard.vue'

vi.mock('@/api/position', () => ({ getPositions: vi.fn() }))
vi.mock('@/api/resume', () => ({ getResumes: vi.fn(), uploadResume: vi.fn() }))

const extension: AiMessageExtension = {
  id: 'form-1',
  type: 'form',
  groupId: 'group-1',
  order: 1,
  state: 'waiting_user',
  data: {
    title: '选择职位',
    status: 'ready',
    fields: [{
      key: 'positionId',
      type: 'position_select',
      label: '选择职位',
      required: true,
      positionSelect: {
        options: [{ positionId: 'P-1004', jobId: 'J-1', positionName: '临床研究经理' }],
        pageNum: 1,
        pageSize: 10,
        hasMore: false,
        queryCriteria: {},
      },
    }],
  },
}

describe('AiFormCard 职位选择', () => {
  it('查看详情时跳转且不选中职位', async () => {
    const wrapper = mount(AiFormCard, { props: { extension } })

    await wrapper.get('.form-position-detail-button').trigger('tap')

    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/position/detail?id=P-1004' })
    expect(wrapper.get('.form-position-item').classes()).not.toContain('form-position-item-active')
  })
})
