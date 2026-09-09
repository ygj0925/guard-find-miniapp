import { AUTH_TOKEN_STORAGE_KEY, useTokenStore } from '@/store/token'
import { getApiUrl } from '@/utils'
import { toLoginPage } from '@/utils/toLoginPage'

export interface H5FetchedFile {
  blob: Blob
  contentType: string
  fileName: string
}

const RESUME_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'application/msword': 'doc',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

function normalizeAccessToken(value: unknown) {
  return typeof value === 'string' ? value.replace(/^Bearer\s+/i, '').trim() : ''
}

function resolveHttpUrl(value: string) {
  let url: URL
  try {
    url = new URL(value, window.location.href)
  }
  catch {
    throw new Error('文件地址无效')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('文件地址不受支持')
  if (window.location.protocol === 'https:' && url.protocol !== 'https:')
    throw new Error('文件地址未使用安全连接')
  return url
}

export function resolveH5ResourceUrl(value: string) {
  return resolveHttpUrl(value).toString()
}

function isTrustedApiUrl(url: URL) {
  const apiUrl = new URL(getApiUrl('/'), window.location.href)
  const apiPath = apiUrl.pathname.replace(/\/+$/, '')
  const matchesApiPath = !apiPath
    || url.pathname === apiPath
    || url.pathname.startsWith(`${apiPath}/`)
  return url.origin === apiUrl.origin && matchesApiPath
}

function sanitizeFileName(value: string, fallback: string) {
  const withoutControls = Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
  const sanitized = withoutControls
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return (sanitized || fallback).slice(0, 180)
}

function decodeHeaderValue(value: string) {
  const normalized = value.trim().replace(/^['"]|['"]$/g, '')
  const rfc5987Value = normalized.match(/^[^']*'[^']*'(.*)$/)?.[1]
  const encodedValue = rfc5987Value ?? normalized.replace(/^UTF-8''/i, '')
  try {
    return decodeURIComponent(encodedValue)
  }
  catch {
    return encodedValue
  }
}

function inferResumeFileName(value: string, fallback: string, contentType: string, url: URL) {
  const sanitized = sanitizeFileName(value, fallback)
  if (/\.(?:pdf|docx?)$/i.test(sanitized))
    return sanitized

  const normalizedContentType = contentType.split(';')[0].trim().toLowerCase()
  const urlExtension = url.pathname.match(/\.(pdf|docx?)$/i)?.[1]?.toLowerCase()
  const extension = RESUME_EXTENSION_BY_CONTENT_TYPE[normalizedContentType] || urlExtension
  return extension ? `${sanitized}.${extension}` : sanitized
}

function readFileName(disposition: string | null, fallback: string, contentType: string, url: URL) {
  if (!disposition)
    return inferResumeFileName(fallback, '简历', contentType, url)

  const encoded = disposition.match(/filename\*\s*=\s*([^;]+)/i)?.[1]
  if (encoded)
    return inferResumeFileName(decodeHeaderValue(encoded), fallback, contentType, url)

  const plain = disposition.match(/filename\s*=\s*("[^"]*"|[^;]+)/i)?.[1]
  return inferResumeFileName(plain ? decodeHeaderValue(plain) : fallback, fallback, contentType, url)
}

function readPayloadMessage(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return ''
  const payload = value as Record<string, unknown>
  return typeof payload.message === 'string'
    ? payload.message
    : typeof payload.msg === 'string'
      ? payload.msg
      : ''
}

async function readErrorMessage(response: Response) {
  try {
    const text = await response.text()
    if (!text)
      return ''
    try {
      return readPayloadMessage(JSON.parse(text)) || text.slice(0, 120)
    }
    catch {
      return text.slice(0, 120)
    }
  }
  catch {
    return ''
  }
}

function triggerDownload(href: string, fileName: string, openInNewContext = false) {
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  link.rel = 'noopener noreferrer'
  link.style.display = 'none'
  if (openInNewContext)
    link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export async function fetchH5File(url: string, fallbackFileName: string, signal?: AbortSignal): Promise<H5FetchedFile> {
  const target = resolveHttpUrl(url)
  const token = normalizeAccessToken(uni.getStorageSync<string>(AUTH_TOKEN_STORAGE_KEY))
  const authorizationAttached = Boolean(token && isTrustedApiUrl(target))
  const headers: HeadersInit = {}
  if (authorizationAttached)
    headers.Authorization = `Bearer ${token}`

  const response = await fetch(target.toString(), {
    method: 'GET',
    headers,
    cache: 'no-store',
    credentials: target.origin === window.location.origin ? 'same-origin' : 'omit',
    signal,
  })

  if (response.status === 401) {
    if (authorizationAttached && await useTokenStore().clearLoginState(token))
      toLoginPage()
    throw new Error(authorizationAttached ? '登录已过期，请重新登录' : '文件链接已失效，请重新获取')
  }
  if (!response.ok)
    throw new Error(await readErrorMessage(response) || `文件请求失败（${response.status}）`)

  const contentType = response.headers.get('content-type') || ''
  if (contentType.toLowerCase().includes('application/json'))
    throw new Error(await readErrorMessage(response) || '文件服务返回异常')

  const blob = await response.blob()
  if (!blob.size)
    throw new Error('文件内容为空')

  return {
    blob,
    contentType: contentType || blob.type,
    fileName: readFileName(response.headers.get('content-disposition'), fallbackFileName, contentType || blob.type, target),
  }
}

export async function downloadH5File(url: string, fallbackFileName: string) {
  const target = resolveHttpUrl(url)
  if (!isTrustedApiUrl(target)) {
    triggerDownload(
      target.toString(),
      inferResumeFileName(fallbackFileName, '简历', '', target),
      true,
    )
    return
  }

  const file = await fetchH5File(target.toString(), fallbackFileName)
  const objectUrl = URL.createObjectURL(file.blob)
  triggerDownload(objectUrl, file.fileName)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
