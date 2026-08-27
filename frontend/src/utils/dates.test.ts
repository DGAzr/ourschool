import { describe, expect, it } from 'vitest'

import { isValidISODate, parseISO } from './dates'

describe('isValidISODate', () => {
  it('accepts real strict calendar dates and leap days', () => {
    expect(isValidISODate('2026-08-26')).toBe(true)
    expect(isValidISODate('2024-02-29')).toBe(true)
  })

  it('rejects malformed and impossible dates', () => {
    expect(isValidISODate(null)).toBe(false)
    expect(isValidISODate('2026-8-26')).toBe(false)
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2026-04-31')).toBe(false)
    expect(isValidISODate('0000-01-01')).toBe(false)
  })

  it('parses accepted dates at local midnight', () => {
    const date = parseISO('2026-08-26')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(7)
    expect(date.getDate()).toBe(26)
    expect(date.getHours()).toBe(0)
  })
})
