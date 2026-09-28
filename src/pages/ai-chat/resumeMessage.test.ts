import { describe, expect, it } from 'vitest'
import type { ResumeItem } from '@/api/resume'
import type { AiChatMessage } from './aiHistory'
import { canChooseReturnedResume, createResumeChatRequest, DEFAULT_RESUME_REQUEST, displayResumeChatMessage } from './resumeMessage'

const resume: ResumeItem = {
  id: '1897293810343682049',
  fileId: '1897293810343682050',
  name: '研发简历',
  fileType: 'pdf',
  isDefault: true,
  uploadedAt: '',
}

describe('createResumeChatRequest', () => {
  it('sends the business resume id in the message without an attachment id', () => {
    const request = createResumeChatRequest(resume, '')
    expect(request?.message).toContain('resumeId: 1897293810343682049')
    expect(request?.message).not.toContain('fileId')
    expect(request?.message).toContain('请先调用 recruitment.get_resume_status 核对当前账户的简历列表')
    expect(request?.message).toContain('recruitment.recommend_positions')
    expect(request?.message).toContain(DEFAULT_RESUME_REQUEST)
    expect(request?.displayMessage).toContain('[简历：研发简历]')
    expect(displayResumeChatMessage(request!.message)).toBe(`[简历：研发简历] ${DEFAULT_RESUME_REQUEST}`)
  })

  it('prioritizes the user question and rejects invalid ids', () => {
    expect(createResumeChatRequest(resume, '  只看上海的岗位  ')?.message).toContain('我的需求：只看上海的岗位')
    expect(createResumeChatRequest(resume, '只看上海的岗位')?.displayMessage).toBe('[简历：研发简历] 只看上海的岗位')
    expect(displayResumeChatMessage('普通消息')).toBe('普通消息')
    expect(createResumeChatRequest({ ...resume, fileId: '' }, '')?.message).toContain(`resumeId: ${resume.id}`)
    expect(displayResumeChatMessage('【发送简历】我发送了账户中名为《旧简历》的简历（resumeId: 123）。请以本轮附件为准阅读简历，并用这份准确的 resumeId 调用需要简历的工具。我的需求：只看上海')).toBe('[简历：旧简历] 只看上海')
  })

  it('rejects an invalid business resume id even when the attachment id exists', () => {
    expect(createResumeChatRequest({ ...resume, id: '' }, '')).toBeNull()
  })
})

describe('canChooseReturnedResume', () => {
  const message: AiChatMessage = {
    id: 'assistant-1',
    role: 'assistant',
    content: '已查询你的简历',
    createdAt: 0,
    status: 'complete',
    extensions: [
      { id: 'tool-1:tool_call', groupId: 'tool-1', type: 'tool_call', order: 1, state: 'success', toolName: 'recruitment.get_resume_status', data: {} },
      { id: 'tool-1:tool_result', groupId: 'tool-1', type: 'tool_result', order: 2, state: 'success', data: { status: 'SUCCESS' } },
    ],
  }

  it('offers selection only after the resume query succeeds', () => {
    expect(canChooseReturnedResume(message)).toBe(true)
    expect(canChooseReturnedResume({ ...message, status: 'streaming' })).toBe(false)
    expect(canChooseReturnedResume({ ...message, extensions: [] })).toBe(false)
    expect(canChooseReturnedResume({ ...message, extensions: [message.extensions[0], { ...message.extensions[1], data: { status: 'ERROR' } }] })).toBe(false)
  })
})
