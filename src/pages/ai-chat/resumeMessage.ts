import type { ResumeItem } from '@/api/resume'

export const DEFAULT_RESUME_REQUEST = '请根据这份简历和我的求职偏好推荐当前在招岗位，并说明每个岗位的匹配理由；如果还缺少关键求职偏好（工作地点、岗位方向、薪资范围等），请先询问我。未经我确认不要直接投递。'
const DEFAULT_RESUME_DISPLAY = '推荐适合的职位'
const LEGACY_DEFAULT_RESUME_REQUEST = '请先阅读这份简历，结合当前可招聘职位分析我的优势、适合的岗位方向与匹配理由，并推荐合适的职位；如果还缺少关键求职偏好，请先询问我。未经我确认不要直接投递。'
const RESUME_MESSAGE_PATTERN = /^【选择简历】我选择了账户中名为《(.+)》的简历（resumeId: \d+）。(?:请先调用 recruitment\.get_resume_status[\s\S]*?。)?我的需求：([\s\S]*)$/
const LEGACY_RESUME_MESSAGE_PATTERN = /^【发送简历】我发送了账户中名为《(.+)》的简历（resumeId: \d+）。请以本轮附件为准阅读简历，并用这份准确的 resumeId 调用需要简历的工具。我的需求：([\s\S]*)$/

export interface ResumeChatRequest {
  message: string
  displayMessage: string
}

export function displayResumeChatMessage(message: string) {
  const match = RESUME_MESSAGE_PATTERN.exec(message)
  if (match)
    return `[简历：${match[1]}] ${match[2] === DEFAULT_RESUME_REQUEST ? DEFAULT_RESUME_DISPLAY : match[2]}`
  const legacy = LEGACY_RESUME_MESSAGE_PATTERN.exec(message)
  if (legacy)
    return `[简历：${legacy[1]}] ${legacy[2] === LEGACY_DEFAULT_RESUME_REQUEST ? DEFAULT_RESUME_DISPLAY : legacy[2]}`
  return message
}

export function createResumeChatRequest(resume: ResumeItem, question: string): ResumeChatRequest | null {
  // Keep the Snowflake ID as a string; never send the physical fileId to attachment parsing.
  const resumeId = String(resume.id || '').trim()
  if (!/^\d+$/.test(resumeId) || resumeId === '0')
    return null

  const instruction = question.trim() || DEFAULT_RESUME_REQUEST
  const displayMessage = `[简历：${resume.name}] ${question.trim() || DEFAULT_RESUME_DISPLAY}`
  return {
    message: `【选择简历】我选择了账户中名为《${resume.name}》的简历（resumeId: ${resumeId}）。请先调用 recruitment.get_resume_status 核对当前账户的简历列表，只有此 ID 与返回的 resumes[].resumeId 一致时，才使用返回的真实 resumeId 调用 recruitment.recommend_positions 推荐合适岗位。不要将它当作本轮附件解析，也不要直接投递。我的需求：${instruction}`,
    displayMessage,
  }
}
