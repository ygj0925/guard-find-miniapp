import fs from 'node:fs'
import { isIP } from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

function publicServiceUrl(value, protocol) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    return url.protocol === protocol && !url.username && !url.password
      && !url.search && !url.hash && host.includes('.') && !isIP(host)
      && host.length <= 253
      && host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
      && !/(?:^|\.)(?:localhost|local|internal|invalid|test|home\.arpa|example(?:\.com|\.org|\.net)?)$/.test(host)
      && !host.includes('your-backend')
  }
  catch {
    return false
  }
}

export function checkReleaseConfig(env, agreement, manifest) {
  const errors = []
  if (!/^wx[0-9a-f]{16}$/.test(env.VITE_WX_APPID || ''))
    errors.push('VITE_WX_APPID 必须是有效格式的微信小程序 AppID')
  const baseKey = 'VITE_SERVER_BASEURL'
  for (const key of [baseKey, `${baseKey}__WEIXIN_DEVELOP`, `${baseKey}__WEIXIN_TRIAL`, `${baseKey}__WEIXIN_RELEASE`]) {
    const value = key === baseKey ? env[key] : env[key] || env[baseKey]
    if (!publicServiceUrl(value, 'https:'))
      errors.push(`${key} 必须使用非占位公网 HTTPS 地址`)
  }
  if (env.VITE_SERVER_WS_URL && !publicServiceUrl(env.VITE_SERVER_WS_URL, 'wss:'))
    errors.push('VITE_SERVER_WS_URL 必须使用非占位公网 WSS 地址')
  if (!/\b__usePrivacyCheck__\s*:\s*true\b/.test(manifest))
    errors.push('manifest 必须启用 __usePrivacyCheck__')
  if (/【[^】]*】/.test(agreement))
    errors.push('用户协议/隐私政策仍含占位字段，需运营方补齐正式内容')
  return errors
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const mode = process.argv[2] || 'production'
  if (!['production', 'test'].includes(mode)) {
    console.error('用法：pnpm check:release [production|test]')
    process.exitCode = 1
  }
  else {
    const { loadEnv } = await import('vite')
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const errors = checkReleaseConfig(
      loadEnv(mode, path.join(root, 'env')),
      fs.readFileSync(path.join(root, 'src/pages/agreement/index.vue'), 'utf8'),
      fs.readFileSync(path.join(root, 'manifest.config.ts'), 'utf8'),
    )
    for (const error of errors)
      console.error(`未通过：${error}`)
    process.exitCode = errors.length ? 1 : 0
    console.log(errors.length ? `${mode} 上线配置预检未通过` : `${mode} 上线配置预检通过`)
    console.log('此检查不代表微信登录、合法域名、真实存储、正式协议审核或真机验收通过。')
  }
}
