const EMPLOYEE_CERTIFICATION_COOLDOWN_KEY = 'sss-recruitment:employee-certification:cooldowns'
const RESEND_COOLDOWN_MS = 5 * 60 * 1000
const MAX_STORED_COOLDOWNS = 8

const resendDeadlines = new Map<string, number>()
let storageLoaded = false

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function loadStoredCooldowns() {
  if (storageLoaded)
    return
  storageLoaded = true

  try {
    const value = uni.getStorageSync(EMPLOYEE_CERTIFICATION_COOLDOWN_KEY) as unknown
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return

    const now = Date.now()
    Object.entries(value as Record<string, unknown>).forEach(([email, deadline]) => {
      if (
        typeof deadline === 'number'
        && Number.isFinite(deadline)
        && deadline > now
        && deadline <= now + RESEND_COOLDOWN_MS
      ) {
        resendDeadlines.set(email, deadline)
      }
    })
  }
  catch {
    // 内存冷却仍可防止当前运行期间重复发送。
  }
}

function persistCooldowns() {
  const now = Date.now()
  const activeCooldowns = Array.from(resendDeadlines.entries())
    .filter(([, deadline]) => deadline > now)
    .sort((left, right) => right[1] - left[1])
    .slice(0, MAX_STORED_COOLDOWNS)

  resendDeadlines.clear()
  activeCooldowns.forEach(([email, deadline]) => resendDeadlines.set(email, deadline))

  try {
    uni.setStorageSync(EMPLOYEE_CERTIFICATION_COOLDOWN_KEY, Object.fromEntries(activeCooldowns))
  }
  catch {
    // 持久化失败不影响当前组件内的倒计时和服务端限流。
  }
}

export function getEmployeeCertificationCooldownSeconds(email: string) {
  loadStoredCooldowns()
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail)
    return 0

  const deadline = resendDeadlines.get(normalizedEmail)
  if (!deadline)
    return 0

  const remainingSeconds = Math.ceil((deadline - Date.now()) / 1000)
  if (remainingSeconds > 0)
    return remainingSeconds

  resendDeadlines.delete(normalizedEmail)
  persistCooldowns()
  return 0
}

export function startEmployeeCertificationCooldown(email: string) {
  loadStoredCooldowns()
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail)
    return 0

  resendDeadlines.set(normalizedEmail, Date.now() + RESEND_COOLDOWN_MS)
  persistCooldowns()
  return getEmployeeCertificationCooldownSeconds(normalizedEmail)
}
