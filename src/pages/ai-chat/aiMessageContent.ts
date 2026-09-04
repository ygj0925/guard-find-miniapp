import MarkdownIt from 'markdown-it'

const MAX_FORMATTED_CONTENT_LENGTH = 120_000
const ALLOWED_MARKDOWN_IMAGE_HOSTS = new Set([
  'static1.3sbio.com',
  '3sbio-yizhantong.oss-cn-shanghai.aliyuncs.com',
])
const ENCODED_LINE_BREAK_PATTERN = /%0[ad]/i
const MAILTO_PATTERN = /^mailto:[^@\s<>]+@[^@\s<>]+$/i
const HTTP_URL_PATTERN = /^(https?):\/\/([^/?#]+)(?:[/?#]|$)/i
const HOST_PATTERN = /^([a-z0-9.-]+)(?::(\d{1,5}))?$/i

const markdown = new MarkdownIt({
  html: false,
  xhtmlOut: true,
  breaks: true,
  linkify: false,
  typographer: false,
})

markdown.validateLink = url => Boolean(normalizeAllowedAiLink(url))

const defaultImageRenderer = markdown.renderer.rules.image
markdown.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index]
  const source = token.attrGet('src') || ''
  if (!isAllowedMarkdownImageUrl(source)) {
    const label = token.content.trim() || '图片'
    return `<span>[已拦截不受信任的图片：${escapeHtml(label)}]</span>`
  }
  return defaultImageRenderer
    ? defaultImageRenderer(tokens, index, options, env, self)
    : self.renderToken(tokens, index, options)
}

export function normalizeAllowedAiLink(value: unknown) {
  if (typeof value !== 'string')
    return ''
  const normalized = value.trim()
  if (!normalized || hasUnsafeUrlCharacters(normalized) || ENCODED_LINE_BREAK_PATTERN.test(normalized))
    return ''
  if (MAILTO_PATTERN.test(normalized))
    return normalized
  return readHttpUrl(normalized) ? normalized : ''
}

export function isAllowedMarkdownImageUrl(value: unknown) {
  const normalized = normalizeAllowedAiLink(value)
  const parsed = readHttpUrl(normalized)
  return Boolean(parsed
    && parsed.protocol === 'https'
    && ALLOWED_MARKDOWN_IMAGE_HOSTS.has(parsed.hostname))
}

function hasUnsafeUrlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 32 || code === 127 || character === '\\'
  })
}

function readHttpUrl(value: string) {
  const match = HTTP_URL_PATTERN.exec(value)
  if (!match)
    return undefined
  const authority = match[2]
  if (!authority || authority.includes('@') || authority.includes('[') || authority.includes(']'))
    return undefined
  const hostMatch = HOST_PATTERN.exec(authority)
  if (!hostMatch)
    return undefined
  const hostname = hostMatch[1].toLowerCase().replace(/\.$/, '')
  if (!hostname || hostname.includes('..') || hostname.split('.').some(label => !label || label.startsWith('-') || label.endsWith('-')))
    return undefined
  if (hostMatch[2] && Number(hostMatch[2]) > 65_535)
    return undefined
  return {
    protocol: match[1].toLowerCase(),
    hostname,
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeAgentText(value: string) {
  return value
    .replace(/\0/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0001-\u0008\v\f\u000E-\u001F]/g, '')
    .replace(/\r\n?/g, '\n')
}

function renderPlainText(value: string) {
  return `<p>${escapeHtml(value).replace(/\n/g, '<br/>')}</p>`
}

export function renderAiMessageContent(content: string) {
  const source = normalizeAgentText(String(content || ''))
  if (!source.trim())
    return ''
  if (source.length > MAX_FORMATTED_CONTENT_LENGTH)
    return renderPlainText(source)
  try {
    return markdown.render(source)
  }
  catch {
    return renderPlainText(source)
  }
}
