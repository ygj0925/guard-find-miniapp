import { describe, expect, it } from 'vitest'
import type { ResumeItem } from '@/api/resume'
import { createResumeChatRequest, DEFAULT_RESUME_REQUEST, displayResumeChatMessage } from './resumeMessage'

const resume: ResumeItem = {
  id: '1897293810343682049',
  fileId: '1897293810343682050',
  name: '研发简历',
  fileType: 'pdf',
  isDefault: true,
  uploadedAt: '',
}

describe('createResumeChatRequest', () => {
  it('sends exact file and resume ids with a broad default request', () => {
    const request = createResumeChatRequest(resume, '')
    expect(request?.fileIds).toEqual(['1897293810343682050'])
    expect(request?.message).toContain('resumeId: 1897293810343682049')
    expect(request?.message).toContain(DEFAULT_RESUME_REQUEST)
    expect(displayResumeChatMessage(request!.message)).toBe('[简历：研发简历] 请分析简历并推荐适合的职位')
  })

  it('prioritizes the user question and rejects invalid ids', () => {
    expect(createResumeChatRequest(resume, '  只看上海的岗位  ')?.message).toContain('我的需求：只看上海的岗位')
    expect(displayResumeChatMessage(createResumeChatRequest(resume, '只看上海的岗位')!.message)).toBe('[简历：研发简历] 只看上海的岗位')
    expect(displayResumeChatMessage('普通消息')).toBe('普通消息')
    expect(createResumeChatRequest({ ...resume, fileId: '' }, '')).toBeNull()
  })
})
