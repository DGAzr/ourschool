import { expect, it } from 'vitest'
import { loginHref, safeReturnPath } from './returnPath'
it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/login', '/auth/oidc/callback', '/\n/evil.example'])('rejects unsafe or looping destinations: %s', value => {
  expect(safeReturnPath(value)).toBe('/')
})
it('keeps an internal task destination with its lesson and query context', () => {
  const path = '/assignments/42?from=%2Fmy-lessons%2F8&day=2026-11-17#notes'
  expect(safeReturnPath(path)).toBe(path)
  expect(loginHref(path)).toBe(`/login?returnTo=${encodeURIComponent(path)}`)
})
