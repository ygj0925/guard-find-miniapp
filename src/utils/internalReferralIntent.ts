const INTERNAL_REFERRAL_INTENT_KEY = 'sss-recruitment:internal-referral:intent'
const INTERNAL_REFERRAL_INTENT_TTL_MS = 10 * 60 * 1000

interface InternalReferralIntent {
  version: 1
  createdAt: number
}

function isInternalReferralIntent(value: unknown): value is InternalReferralIntent {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false

  const candidate = value as Record<string, unknown>
  return candidate.version === 1
    && typeof candidate.createdAt === 'number'
    && Number.isFinite(candidate.createdAt)
}

export function saveInternalReferralIntent() {
  try {
    const intent: InternalReferralIntent = {
      version: 1,
      createdAt: Date.now(),
    }
    uni.setStorageSync(INTERNAL_REFERRAL_INTENT_KEY, intent)
    return true
  }
  catch {
    return false
  }
}

export function consumeInternalReferralIntent() {
  let value: unknown
  try {
    value = uni.getStorageSync(INTERNAL_REFERRAL_INTENT_KEY)
    uni.removeStorageSync(INTERNAL_REFERRAL_INTENT_KEY)
  }
  catch {
    return false
  }

  if (!isInternalReferralIntent(value))
    return false

  const age = Date.now() - value.createdAt
  return age >= 0 && age <= INTERNAL_REFERRAL_INTENT_TTL_MS
}

export function clearInternalReferralIntent() {
  try {
    uni.removeStorageSync(INTERNAL_REFERRAL_INTENT_KEY)
  }
  catch {
    // 清理失败时依赖短 TTL 防止过期操作在后续会话中恢复。
  }
}
