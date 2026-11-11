# 请求库

统一使用 `src/http/http.ts`，接口均由 guard-find-backend 的 `/miniapp/**` 提供。

## 关于 http 使用

```ts
import { http } from '@/http/http'

export function getUserInfo() {
  return http.get<IUserInfoRes>('/miniapp/auth/me')
}
```

响应成功时会返回业务 `data`；业务错误、登录失效、HTTP 状态码异常和网络异常会统一 reject `HttpError`：

```ts
import type { HttpError } from '@/http/types'

try {
  const userInfo = await getUserInfo()
  console.log(userInfo.nickname)
}
catch (error) {
  const httpError = error as HttpError
  console.log(httpError.type, httpError.message, httpError.statusCode)
}
```

如果调用方需要自行处理错误提示，可以传入 `hideErrorToast: true`：

```ts
http.get<IUserInfoRes>('/miniapp/auth/me', undefined, undefined, {
  hideErrorToast: true,
})
```

服务端为单 token（Sa-Token `miniapp` 登录域，有效期 7 天），没有刷新接口；收到 401 时清理当前登录态并跳转登录页。
