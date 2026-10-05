import { describe, it, expect } from 'vitest'
import { gradeText, gradeColor, letter, trendInfo } from './gradeColors'
describe('evidence-aware grades', () => {
  it('keeps missing data distinct from a scored zero', () => {
    expect(gradeText(null)).toBe('Not graded yet')
    expect(letter(null)).toBe('Not graded yet')
    expect(gradeColor(null)).toBe('var(--muted)')
    expect(gradeText(0)).toBe('0%')
    expect(letter(0)).toBe('F')
    expect(trendInfo(null).arrow).toBe('')
    expect(trendInfo(0).text).toBe('steady')
  })
})
