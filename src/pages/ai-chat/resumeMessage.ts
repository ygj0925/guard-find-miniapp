import type { ResumeItem } from '@/api/resume'

export const DEFAULT_RESUME_REQUEST = '请先阅读这份简历，结合当前可招聘职位分析我的优势、适合的岗位方向与匹配理由，并推荐合适的职位；如果还缺少关键求职偏好，请先询问我。未经我确认不要直接投递。'
const RESUME_MESSAGE_PATTERN = /^【发送简历】我发送了账户中名为《(.+)》的简历（resumeId: \d+）。请以本轮附件为准阅读简历，并用这份准确的 resumeId 调用需要简历的工具。我的需求：([\s\S]*)$/

export function displayResumeChatMessage(message: string) {
  const match = RESUME_MESSAGE_PATTERN.exec(message)
  if (!match)
    return message
  return `[简历：${match[1]}] ${match[2] === DEFAULT_RESUME_REQUEST ? '请分析简历并推荐适合的职位' : match[2]}`
}

export function createResumeChatRequest(resume: ResumeItem, question: string) {
  // Backend accepts numeric strings as Long; converting Snowflake IDs to JS numbers loses precision.
  const fileId = String(resume.fileId || '').trim()
  const resumeId = String(resume.id || '').trim()
  if (!/^\d+$/.test(fileId) || !/^\d+$/.test(resumeId) || fileId === '0' || resumeId === '0')
    return null

  const instruction = question.trim() || DEFAULT_RESUME_REQUEST
  return {
    fileIds: [fileId],
    message: `【发送简历】我发送了账户中名为《${resume.name}》的简历（resumeId: ${resumeId}）。请以本轮附件为准阅读简历，并用这份准确的 resumeId 调用需要简历的工具。我的需求：${instruction}`,
  }
}
