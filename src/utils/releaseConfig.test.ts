import assert from 'node:assert/strict'
import { it } from 'vitest'
import { checkReleaseConfig } from '../../scripts/check-release.js'

const env = { VITE_WX_APPID: 'wx0123456789abcdef', VITE_SERVER_BASEURL: 'https://api.apartment.cn' }
const manifest = '__usePrivacyCheck__: true'
function check(overrides = {}, agreement = '正式协议内容', config = manifest) {
  return checkReleaseConfig({ ...env, ...overrides }, agreement, config)
}

it('accepts HTTPS service prefixes and inherited channel URLs', () => {
  assert.deepEqual(check({ VITE_SERVER_BASEURL: 'https://api.apartment.cn/api' }), [])
})

it('checks all explicit WeChat channel URLs', () => {
  const errors = check({ VITE_SERVER_BASEURL__WEIXIN_TRIAL: 'http://localhost:8000' })
  assert.equal(errors.length, 1)
  assert.match(errors[0], /WEIXIN_TRIAL/)
})

it('rejects missing, placeholder, local and credential-bearing URLs without echoing values', () => {
  for (const value of ['', 'https://your-backend.example.com', 'https://api.example.org', 'https://api.local', 'https://127.0.0.1', 'https://[::1]', 'http://api.apartment.cn', 'https://name:secret@api.apartment.cn', 'https://api.apartment.cn?token=secret']) {
    const errors = check({ VITE_SERVER_BASEURL: value })
    assert.equal(errors.length, 4, value)
    assert.ok(errors.every(error => !error.includes('secret')))
  }
})

it.each([
  'https://api.example.com.',
  'https://api.local.',
  'https://api.test.',
  'https://api.internal',
  'https://api.home.arpa',
  'https://api..apartment.cn',
  'https://_api.apartment.cn',
  'https://-api.apartment.cn',
  `https://${'a'.repeat(64)}.apartment.cn`,
])('rejects reserved or malformed service hostnames (%s)', (value) => {
  assert.equal(check({ VITE_SERVER_BASEURL: value }).length, 4)
  assert.match(check({ VITE_SERVER_WS_URL: value.replace('https:', 'wss:') })[0], /WSS/)
})

it('accepts derived WebSocket URLs and requires WSS for explicit overrides', () => {
  assert.deepEqual(check({ VITE_SERVER_WS_URL: 'wss://im.apartment.cn/api' }), [])
  assert.match(check({ VITE_SERVER_WS_URL: 'ws://im.apartment.cn' })[0], /WSS/)
})

it('rejects invalid AppID format', () => {
  assert.match(check({ VITE_WX_APPID: '__UNI__D1E5001' })[0], /AppID/)
})

it('rejects agreement placeholders and disabled privacy checking', () => {
  assert.match(check({}, '主体： 【运营主体名称】')[0], /占位/)
  assert.match(check({}, '正式协议', '__usePrivacyCheck__: false')[0], /__usePrivacyCheck__/)
})
