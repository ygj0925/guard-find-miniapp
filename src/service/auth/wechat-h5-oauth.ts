import type { SocialLoginSource } from '@/api/types/login'
import CryptoJS from 'crypto-js'
import { getSocialAuthorizeUrl } from '@/api/login'
import { resolveAuthRedirect } from '@/pages/auth/navigation'
import { WECHAT_OAUTH_CALLBACK_PAGE } from '@/router/config'
import {
  AUTH_TOKEN_STORAGE_KEY,
  isCrossContextAuthLockSupported,
  withAuthSessionLock,
} from '@/store/token'

export const WECHAT_H5_SOCIAL_SOURCE: SocialLoginSource = 'WECHAT_OPEN'

const PENDING_STORAGE_KEY = 'sss-recruitment:wechat-h5-oauth:pending'
const WECHAT_AUTHORIZE_ORIGIN = 'https://open.weixin.qq.com'
const OAUTH_STATE_TTL_MS = 3 * 60 * 1000
const MAX_STATE_LENGTH = 512
const MAX_CODE_LENGTH = 2048
const MAX_ERROR_LENGTH = 512
const AUTH_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/
const OAUTH_QUERY_KEYS = ['code', 'state', 'error', 'error_description', 'oauth_source'] as const

interface StoredWechatOAuthPending {
  version: 2
  source: SocialLoginSource
  state: string
  redirect: string
  createdAt: number
  authFingerprint: string
}

export interface WechatOAuthCallbackInput {
  source: string
  code: string
  state: string
  error: string
}

interface WechatOAuthCallbackBase {
  state: string
  redirect: string
  authFingerprint: string
}

export type WechatOAuthCallbackPayload
  = | WechatOAuthCallbackBase & {
    kind: 'success'
    code: string
  }
  | WechatOAuthCallbackBase & {
    kind: 'error'
    error: string
  }

interface HashParts {
  path: string
  params: URLSearchParams
}

export function isWechatH5LoginEnabled() {
  return import.meta.env.VITE_WECHAT_H5_LOGIN_ENABLE === 'true'
}

function getSessionStorage() {
  if (typeof window === 'undefined')
    throw new Error('当前环境不支持微信网页登录')
  try {
    return window.sessionStorage
  }
  catch {
    throw new Error('浏览器已禁用会话存储，无法发起微信登录')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePending(value: string | null): StoredWechatOAuthPending | undefined {
  if (!value)
    return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      !isRecord(parsed)
      || parsed.version !== 2
      || parsed.source !== WECHAT_H5_SOCIAL_SOURCE
      || typeof parsed.state !== 'string'
      || !parsed.state
      || parsed.state.length > MAX_STATE_LENGTH
      || typeof parsed.redirect !== 'string'
      || typeof parsed.createdAt !== 'number'
      || !Number.isFinite(parsed.createdAt)
      || typeof parsed.authFingerprint !== 'string'
      || !AUTH_FINGERPRINT_PATTERN.test(parsed.authFingerprint)
    ) {
      return undefined
    }
    return {
      version: 2,
      source: WECHAT_H5_SOCIAL_SOURCE,
      state: parsed.state,
      redirect: parsed.redirect,
      createdAt: parsed.createdAt,
      authFingerprint: parsed.authFingerprint,
    }
  }
  catch {
    return undefined
  }
}

function readPending() {
  try {
    return parsePending(getSessionStorage().getItem(PENDING_STORAGE_KEY))
  }
  catch {
    return undefined
  }
}

function clearPending() {
  try {
    getSessionStorage().removeItem(PENDING_STORAGE_KEY)
  }
  catch {
    // 无法访问 sessionStorage 时也不能重放当前回调，后端仍会校验 code/state。
  }
}

function isPendingFresh(pending: StoredWechatOAuthPending, now = Date.now()) {
  const age = now - pending.createdAt
  return age >= 0 && age <= OAUTH_STATE_TTL_MS
}

function readSharedAccessToken() {
  try {
    const value: unknown = uni.getStorageSync(AUTH_TOKEN_STORAGE_KEY)
    return typeof value === 'string' ? value : ''
  }
  catch {
    throw new Error('无法读取当前登录状态，请检查浏览器隐私设置')
  }
}

export function getWechatH5AuthFingerprint() {
  return CryptoJS.SHA256(readSharedAccessToken()).toString(CryptoJS.enc.Hex)
}

export function assertWechatH5AuthFingerprint(expectedFingerprint: string) {
  if (
    !AUTH_FINGERPRINT_PATTERN.test(expectedFingerprint)
    || getWechatH5AuthFingerprint() !== expectedFingerprint
  ) {
    throw new Error('登录状态已在其他页面发生变化，本次微信登录已取消，请重新发起登录')
  }
}

function validateAuthorizeUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    throw new Error('微信授权地址无效，请联系管理员')
  }

  if (
    url.origin !== WECHAT_AUTHORIZE_ORIGIN
    || url.username
    || url.password
  ) {
    throw new Error('微信授权地址不受信任，请联系管理员')
  }

  const states = url.searchParams.getAll('state')
  const state = states.length === 1 ? states[0] : ''
  if (!state || state.length > MAX_STATE_LENGTH)
    throw new Error('微信授权状态无效，请重新尝试')

  const redirectUris = url.searchParams.getAll('redirect_uri')
  if (redirectUris.length !== 1 || !redirectUris[0])
    throw new Error('微信登录回调地址配置错误，请联系管理员')

  let redirectUrl: URL
  try {
    redirectUrl = new URL(redirectUris[0])
  }
  catch {
    throw new Error('微信登录回调地址配置错误，请联系管理员')
  }

  const sources = redirectUrl.searchParams.getAll('oauth_source')
  if (sources.length !== 1 || sources[0] !== WECHAT_H5_SOCIAL_SOURCE)
    throw new Error('微信登录回调地址配置错误，请联系管理员')

  return { url, state }
}

function assertCrossContextAuthLockSupported() {
  if (!isCrossContextAuthLockSupported())
    throw new Error('当前浏览器不支持安全微信登录，请升级浏览器或使用手机号登录')
}

export async function startWechatH5OAuth(redirect?: string) {
  if (!isWechatH5LoginEnabled())
    throw new Error('微信登录暂未启用')

  assertCrossContextAuthLockSupported()
  const authFingerprint = getWechatH5AuthFingerprint()

  assertCrossContextAuthLockSupported()
  const { authorizeUrl } = await getSocialAuthorizeUrl(WECHAT_H5_SOCIAL_SOURCE)
  const { url, state } = validateAuthorizeUrl(authorizeUrl)
  const pending: StoredWechatOAuthPending = {
    version: 2,
    source: WECHAT_H5_SOCIAL_SOURCE,
    state,
    redirect: resolveAuthRedirect(redirect),
    createdAt: Date.now(),
    authFingerprint,
  }

  await withAuthSessionLock(() => {
    assertWechatH5AuthFingerprint(authFingerprint)
    assertCrossContextAuthLockSupported()
    clearPending()

    try {
      getSessionStorage().setItem(PENDING_STORAGE_KEY, JSON.stringify(pending))
    }
    catch {
      throw new Error('无法保存微信登录状态，请检查浏览器隐私设置')
    }

    assertCrossContextAuthLockSupported()
    window.location.assign(url.toString())
  }, true)
}

function readHashParts(hash: string): HashParts {
  const value = hash.startsWith('#') ? hash.slice(1) : hash
  const queryIndex = value.indexOf('?')
  if (queryIndex < 0) {
    return {
      path: value,
      params: new URLSearchParams(),
    }
  }
  return {
    path: value.slice(0, queryIndex),
    params: new URLSearchParams(value.slice(queryIndex + 1)),
  }
}

function writeHashParts(url: URL, parts: HashParts) {
  const query = parts.params.toString()
  url.hash = query ? `${parts.path}?${query}` : parts.path
}

function removeOAuthQueryParams(params: URLSearchParams) {
  for (const key of OAUTH_QUERY_KEYS)
    params.delete(key)
}

function cleanOAuthParamsFromUrl(url: URL) {
  removeOAuthQueryParams(url.searchParams)
  const hashParts = readHashParts(url.hash)
  removeOAuthQueryParams(hashParts.params)
  writeHashParts(url, hashParts)
}

function replaceCurrentUrl(url: URL) {
  window.history.replaceState(window.history.state, '', url.toString())
}

function cleanCallbackUrl() {
  if (typeof window === 'undefined')
    return

  const url = new URL(window.location.href)
  cleanOAuthParamsFromUrl(url)
  replaceCurrentUrl(url)
}

function isValidCode(value: string | undefined) {
  return typeof value === 'string' && !!value.trim() && value.length <= MAX_CODE_LENGTH
}

function isValidProviderError(value: string | undefined) {
  return typeof value === 'string' && !!value.trim() && value.length <= MAX_ERROR_LENGTH
}

/**
 * 微信会把 OAuth 参数添加到 redirect_uri 的普通查询参数中，而 uni-app H5
 * 默认使用 hash 路由。只有带唯一 WECHAT_OPEN marker 的合法回调才桥接到匿名回调页。
 */
export function bridgeWechatH5OAuthCallback() {
  if (typeof window === 'undefined')
    return false

  const currentUrl = new URL(window.location.href)
  const sourceValues = currentUrl.searchParams.getAll('oauth_source')
  if (sourceValues.length === 0)
    return false

  const stateValues = currentUrl.searchParams.getAll('state')
  const codeValues = currentUrl.searchParams.getAll('code')
  const errorValues = currentUrl.searchParams.getAll('error')
  const pending = readPending()
  const hasValidCode = codeValues.length === 1 && isValidCode(codeValues[0])
  const hasValidError = errorValues.length === 1 && isValidProviderError(errorValues[0])
  const hasExclusiveResult = (hasValidCode && errorValues.length === 0)
    || (hasValidError && codeValues.length === 0)
  const isValidCallback = sourceValues.length === 1
    && sourceValues[0] === WECHAT_H5_SOCIAL_SOURCE
    && !!pending
    && isPendingFresh(pending)
    && stateValues.length === 1
    && stateValues[0] === pending.state
    && hasExclusiveResult

  if (!isValidCallback) {
    cleanOAuthParamsFromUrl(currentUrl)
    replaceCurrentUrl(currentUrl)
    return false
  }

  const callbackHash = readHashParts(currentUrl.hash)
  removeOAuthQueryParams(callbackHash.params)
  callbackHash.path = WECHAT_OAUTH_CALLBACK_PAGE
  callbackHash.params.set('oauth_source', WECHAT_H5_SOCIAL_SOURCE)
  callbackHash.params.set('state', stateValues[0])
  if (hasValidCode)
    callbackHash.params.set('code', codeValues[0])
  else
    callbackHash.params.set('error', errorValues[0])
  for (const description of currentUrl.searchParams.getAll('error_description'))
    callbackHash.params.append('error_description', description)

  removeOAuthQueryParams(currentUrl.searchParams)
  writeHashParts(currentUrl, callbackHash)
  window.location.replace(currentUrl.toString())
  return true
}

export function consumeWechatH5OAuthCallback(input: WechatOAuthCallbackInput): WechatOAuthCallbackPayload {
  try {
    const hasCode = isValidCode(input.code)
    const hasError = isValidProviderError(input.error)
    if (input.source !== WECHAT_H5_SOCIAL_SOURCE)
      throw new Error('微信登录来源校验失败，请重新发起登录')
    if (hasCode === hasError)
      throw new Error('微信授权结果无效，请重新发起登录')
    if (!input.state || input.state.length > MAX_STATE_LENGTH)
      throw new Error('微信授权状态无效，请重新登录')

    const pending = readPending()
    if (!pending)
      throw new Error('微信登录会话已失效，请重新发起登录')
    if (!isPendingFresh(pending))
      throw new Error('微信登录已超时，请重新发起登录')
    if (pending.state !== input.state)
      throw new Error('微信登录状态校验失败，请重新发起登录')

    assertWechatH5AuthFingerprint(pending.authFingerprint)
    clearPending()

    const base: WechatOAuthCallbackBase = {
      state: input.state,
      redirect: pending.redirect,
      authFingerprint: pending.authFingerprint,
    }
    if (hasError) {
      return {
        ...base,
        kind: 'error',
        error: input.error,
      }
    }
    return {
      ...base,
      kind: 'success',
      code: input.code,
    }
  }
  finally {
    cleanCallbackUrl()
  }
}
