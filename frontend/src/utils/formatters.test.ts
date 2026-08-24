import { describe, expect, it } from 'vitest'

import { formatGradeLevel } from './formatters'

describe('formatGradeLevel', () => {
  it('distinguishes Kindergarten from an unset grade', () => {
    expect(formatGradeLevel(0)).toBe('Kindergarten')
    expect(formatGradeLevel(0, 'K')).toBe('K')
    expect(formatGradeLevel(null)).toBe('Not set')
    expect(formatGradeLevel(undefined)).toBe('Not set')
  })

  it('formats numbered grades', () => {
    expect(formatGradeLevel(1)).toBe('Grade 1')
    expect(formatGradeLevel(12)).toBe('Grade 12')
  })
})
