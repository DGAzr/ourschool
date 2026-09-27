import { describe, expect, it } from 'vitest'

import {
  formatTimeRemaining,
  getTokenLifetime,
  getTokenTimeRemaining,
  isTokenExpired,
  isTokenNearExpiry,
} from './auth'

const tokenWithPayload = (payload: Record<string, unknown>) => {
  const encode = (value: object) => btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

describe('non-expiring session tokens', () => {
  const token = tokenWithPayload({ sub: 'admin', iat: 1_700_000_000 })

  it('remain valid without an exp claim', () => {
    expect(isTokenExpired(token)).toBe(false)
    expect(isTokenNearExpiry(token)).toBe(false)
  })

  it('report that they have no expiration', () => {
    const remaining = getTokenTimeRemaining(token)
    expect(remaining).toBe(Number.POSITIVE_INFINITY)
    expect(getTokenLifetime(token)).toBe(Number.POSITIVE_INFINITY)
    expect(formatTimeRemaining(remaining)).toBe('No expiration')
  })
})
