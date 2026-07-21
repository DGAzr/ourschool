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

import {
  scopeEquals,
  scopeIsEverything,
  scopeMatchesNothing,
  scopeSummaryLabel,
  sortOptions,
  toggleId,
} from './scopeLogic'
import { PaperlessScopeOption } from '../../types/paperless'

const makeOption = (
  over: Partial<PaperlessScopeOption> = {}
): PaperlessScopeOption => ({
  id: 1,
  name: 'HomeSchool',
  document_count: 5,
  ...over,
})

describe('toggleId', () => {
  it('toggles ids in and out', () => {
    expect(toggleId([], 3)).toEqual([3])
    expect(toggleId([3, 5], 3)).toEqual([5])
    expect(toggleId([5], 3)).toEqual([5, 3])
  })
})

describe('sortOptions', () => {
  it('sorts case-insensitively without mutating the input', () => {
    const options = [
      makeOption({ id: 1, name: 'recipe' }),
      makeOption({ id: 2, name: 'HomeSchool' }),
      makeOption({ id: 3, name: 'Math' }),
    ]
    expect(sortOptions(options).map((o) => o.name)).toEqual([
      'HomeSchool',
      'Math',
      'recipe',
    ])
    expect(options[0].name).toBe('recipe')
  })
})

describe('scopeIsEverything', () => {
  it('is true only when both axes are empty', () => {
    expect(scopeIsEverything([], [])).toBe(true)
    expect(scopeIsEverything([1], [])).toBe(false)
    expect(scopeIsEverything([], [1])).toBe(false)
  })
})

describe('scopeSummaryLabel', () => {
  it('reads "Syncing everything" for an empty scope', () => {
    expect(scopeSummaryLabel([], [])).toBe('Syncing everything')
  })

  it('handles singular/plural per axis', () => {
    expect(scopeSummaryLabel([1], [])).toBe('1 tag')
    expect(scopeSummaryLabel([1, 2, 3], [])).toBe('3 tags')
    expect(scopeSummaryLabel([], [7])).toBe('1 document type')
    expect(scopeSummaryLabel([1, 2], [7, 8])).toBe('2 tags · 2 document types')
  })
})

describe('scopeEquals', () => {
  it('ignores order and detects real differences', () => {
    expect(
      scopeEquals(
        { tagIds: [1, 2], doctypeIds: [3] },
        { tagIds: [2, 1], doctypeIds: [3] }
      )
    ).toBe(true)
    expect(
      scopeEquals(
        { tagIds: [1], doctypeIds: [] },
        { tagIds: [1, 2], doctypeIds: [] }
      )
    ).toBe(false)
    expect(
      scopeEquals({ tagIds: [], doctypeIds: [3] }, { tagIds: [], doctypeIds: [4] })
    ).toBe(false)
  })
})

describe('scopeMatchesNothing', () => {
  const tags = [
    makeOption({ id: 1, document_count: 0 }),
    makeOption({ id: 2, document_count: 4 }),
  ]
  const doctypes = [makeOption({ id: 7, document_count: 0 })]

  it('is false for an empty scope (that means everything)', () => {
    expect(scopeMatchesNothing([], [], tags, doctypes)).toBe(false)
  })

  it('is true when every selected option counts zero documents', () => {
    expect(scopeMatchesNothing([1], [7], tags, doctypes)).toBe(true)
  })

  it('is false as soon as one selected option has documents', () => {
    expect(scopeMatchesNothing([1, 2], [7], tags, doctypes)).toBe(false)
  })
})
