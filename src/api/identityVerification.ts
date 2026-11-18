import { http } from '@/http/http'

export type IdentityVerificationMode = 'DISABLED' | 'MANUAL' | 'PROVIDER'
export type IdentityVerificationStatus = 'NOT_REQUIRED' | 'NOT_STARTED' | 'PENDING_CONSENT' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED' | 'REJECTED' | 'UNAVAILABLE'

export interface IdentityVerificationState {
  mode: IdentityVerificationMode
  status: IdentityVerificationStatus
  required: boolean
  consentVersion?: string
  providerName?: string
  sessionId?: string
  launchUrl?: string
  expiresAt?: string
  message?: string
  verifiedAt?: string
  failureReason?: string
}

export function fetchIdentityVerificationStatus() {
  return http.get<IdentityVerificationState>('/miniapp/identity-verification/status')
}

export function grantIdentityVerificationConsent(consentVersion: string) {
  return http.post<IdentityVerificationState>('/miniapp/identity-verification/consent', { accepted: true, consentVersion })
}

export function createIdentityVerificationSession(input: { realName?: string; idNumber?: string; consentVersion: string }) {
  return http.post<IdentityVerificationState>('/miniapp/identity-verification/session', {
    consentVersion: input.consentVersion,
    ...(input.realName ? { realName: input.realName } : {}),
    ...(input.idNumber ? { idNumber: input.idNumber } : {}),
    accepted: true,
    purpose: 'LEASE_SIGN',
  })
}

export function fetchIdentityVerificationSession(sessionId: string) {
  return http.get<IdentityVerificationState>(`/miniapp/identity-verification/session/${encodeURIComponent(sessionId)}`)
}
