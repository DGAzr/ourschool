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

/**
 * Pure logic for the sync-scope pickers (connect card + scope card) —
 * extracted for unit testing (mirrors paperlessPickerLogic.ts).
 *
 * Scope semantics are a union: a document syncs when it carries any selected
 * tag OR its document type is selected. Nothing selected = whole library.
 */

import { PaperlessScopeOption } from '../../types/paperless'

/** Toggle an id in/out of a scope selection. */
export const toggleId = (selected: number[], id: number): number[] =>
  selected.includes(id)
    ? selected.filter((s) => s !== id)
    : [...selected, id]

/** Case-insensitive alphabetical order for the checklists. */
export const sortOptions = (
  options: PaperlessScopeOption[]
): PaperlessScopeOption[] =>
  [...options].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

/** Empty on both axes means the whole library syncs. */
export const scopeIsEverything = (
  tagIds: number[],
  doctypeIds: number[]
): boolean => tagIds.length === 0 && doctypeIds.length === 0

const plural = (n: number, noun: string): string =>
  `${n} ${noun}${n === 1 ? '' : 's'}`

/** Footer summary, e.g. "Syncing everything" / "3 tags · 2 document types". */
export const scopeSummaryLabel = (
  tagIds: number[],
  doctypeIds: number[]
): string => {
  if (scopeIsEverything(tagIds, doctypeIds)) return 'Syncing everything'
  const parts: string[] = []
  if (tagIds.length > 0) parts.push(plural(tagIds.length, 'tag'))
  if (doctypeIds.length > 0) parts.push(plural(doctypeIds.length, 'document type'))
  return parts.join(' · ')
}

const sameIds = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

/** Order-insensitive scope equality — drives the save-button dirty state. */
export const scopeEquals = (
  a: { tagIds: number[]; doctypeIds: number[] },
  b: { tagIds: number[]; doctypeIds: number[] }
): boolean => sameIds(a.tagIds, b.tagIds) && sameIds(a.doctypeIds, b.doctypeIds)

/** True when a non-empty selection can never match a document. */
export const scopeMatchesNothing = (
  tagIds: number[],
  doctypeIds: number[],
  tags: PaperlessScopeOption[],
  documentTypes: PaperlessScopeOption[]
): boolean => {
  if (scopeIsEverything(tagIds, doctypeIds)) return false
  const countOf = (options: PaperlessScopeOption[], ids: number[]): number =>
    options
      .filter((o) => ids.includes(o.id))
      .reduce((sum, o) => sum + o.document_count, 0)
  return countOf(tags, tagIds) + countOf(documentTypes, doctypeIds) === 0
}
