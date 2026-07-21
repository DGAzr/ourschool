/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, expect, it } from 'vitest'
import { gradePreview, parsePoints, pointsError } from './gradeFormLogic'

describe('parsePoints', () => {
  it('parses numbers and rejects junk', () => {
    expect(parsePoints('42')).toBe(42)
    expect(parsePoints('42.5')).toBe(42.5)
    expect(parsePoints('')).toBeNull()
    expect(parsePoints('abc')).toBeNull()
  })
})

describe('pointsError', () => {
  it('rejects only negative values', () => {
    expect(pointsError('-1')).toMatch(/at least 0/)
  })
  it('accepts in-range, over-max (extra credit), and empty (empty just disables save)', () => {
    expect(pointsError('100')).toBeNull()
    expect(pointsError('0')).toBeNull()
    expect(pointsError('101')).toBeNull()
    expect(pointsError('')).toBeNull()
  })
})

describe('gradePreview', () => {
  it('derives pct and letter from the entered value', () => {
    expect(gradePreview('90', 100)).toEqual({ pct: 90, letter: 'A−' })
  })
  it('shows a true >100% grade for over-max input (extra credit)', () => {
    expect(gradePreview('150', 100)).toEqual({ pct: 150, letter: 'A+' })
  })
})
