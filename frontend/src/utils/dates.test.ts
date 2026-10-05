import { describe, expect, it } from 'vitest'

import { isValidISODate, parseISO, termCalendarProgress } from './dates'

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


describe('term calendar days', () => {
  it('includes the end date and counts a not-yet-started term consistently', () => {
    expect(termCalendarProgress('2026-10-01', '2026-10-05', '2026-09-30')).toEqual({ progress: 0, daysRemaining: 5 })
    expect(termCalendarProgress('2026-10-01', '2026-10-05', '2026-10-04')).toEqual({ progress: 60, daysRemaining: 2 })
    expect(termCalendarProgress('2026-10-01', '2026-10-05', '2026-10-05').daysRemaining).toBe(1)
    expect(termCalendarProgress('2026-10-01', '2026-10-05', '2026-10-06')).toEqual({ progress: 100, daysRemaining: 0 })
  })
  it('counts days across daylight saving time and a one-day term', () => {
    expect(termCalendarProgress('2026-03-07', '2026-03-09', '2026-03-07').daysRemaining).toBe(3)
    expect(termCalendarProgress('2026-10-04', '2026-10-04', '2026-10-04').daysRemaining).toBe(1)
  })
})
