const TRUSTED_BANNER_DOMAIN = '3sbio.com'
const HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

function hasUnsafeUrlCharacter(value: string) {
  for (const character of value) {
    const codePoint = character.charCodeAt(0)
    if (character === '\\' || /\s/.test(character) || codePoint < 32 || codePoint === 127)
      return true
  }
  return false
}

/**
 * 仅允许三生制药官方 HTTPS 域名，避免后台误配置将用户带到不可信站点。
 */
export function normalizeTrustedBannerUrl(rawUrl: string) {
  const targetUrl = rawUrl.trim()
  if (!targetUrl || hasUnsafeUrlCharacter(targetUrl))
    return ''

  const authorityMatch = /^https:\/\/([^/?#]*)(?:[/?#]|$)/i.exec(targetUrl)
  const authority = authorityMatch?.[1]
  if (!authority || authority.includes('@'))
    return ''

  const hostMatch = /^([^:]+)(?::(\d+))?$/.exec(authority)
  if (!hostMatch)
    return ''

  const portText = hostMatch[2]
  if (portText) {
    const port = Number(portText)
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      return ''
  }

  let hostname = hostMatch[1].toLowerCase()
  if (hostname.endsWith('.'))
    hostname = hostname.slice(0, -1)
  const labels = hostname.split('.')
  if (!hostname || hostname.length > 253 || labels.some(label => !HOSTNAME_LABEL_PATTERN.test(label)))
    return ''

  const trusted = hostname === TRUSTED_BANNER_DOMAIN
    || hostname.endsWith(`.${TRUSTED_BANNER_DOMAIN}`)
  return trusted ? targetUrl : ''
}

/** switchTab drops query strings, so carry a position banner's category through the store. */
export function getBannerPositionCategory(pagePath: string) {
  const normalizedPath = pagePath.replace(/^\/+/, '')
  if (!normalizedPath.startsWith('pages/position/index?'))
    return ''
  return normalizedPath.match(/[?&]category=(1|2)(?:[&#]|$)/)?.[1] || ''
}
