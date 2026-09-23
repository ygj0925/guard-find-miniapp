/** switchTab drops query strings, so carry a position banner's category through the store. */
export function getBannerPositionCategory(pagePath: string) {
  const normalizedPath = pagePath.replace(/^\/+/, '')
  if (!normalizedPath.startsWith('pages/position/index?'))
    return ''
  return normalizedPath.match(/[?&]category=(1|2)(?:[&#]|$)/)?.[1] || ''
}
