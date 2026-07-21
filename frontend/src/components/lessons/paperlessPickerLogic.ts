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
 * Pure logic for the "Pull from Paperless" picker and the editor's
 * suggestion card — extracted for unit testing (mirrors shopLogic.ts).
 */

import { PaperlessDocument, PaperlessMaterial } from '../../types/paperless'

/** Toggle a document in/out of the picker selection. */
export const toggleSelection = (selected: number[], docId: number): number[] =>
  selected.includes(docId)
    ? selected.filter((id) => id !== docId)
    : [...selected, docId]

/** Selection survives a refetch only for docs still selectable. */
export const pruneSelection = (
  selected: number[],
  docs: PaperlessDocument[]
): number[] => {
  const selectable = new Set(docs.filter((d) => !d.attached).map((d) => d.id))
  return selected.filter((id) => selectable.has(id))
}

/** Footer status line, e.g. "2 selected · 6 in Mathematics". */
export const pickerFooterLabel = (
  selectedCount: number,
  total: number,
  subjectName?: string | null
): string => {
  const scope = subjectName ? `${total} in ${subjectName}` : `${total} available`
  return `${selectedCount} selected · ${scope}`
}

/** Primary button label: disabled state reads "Select documents". */
export const attachButtonLabel = (
  selectedCount: number,
  noun: 'lesson' | 'assignment' = 'lesson'
): string => {
  if (selectedCount === 0) return 'Select documents'
  return selectedCount === 1
    ? `Attach 1 to ${noun}`
    : `Attach ${selectedCount} to ${noun}`
}

/**
 * Merge an explicit attached-id set into the documents' `attached` flags —
 * the server only computes `attached` for lesson targets, so template
 * pickers pass their current attachment ids instead.
 */
export const withAttachedFlags = (
  docs: PaperlessDocument[],
  attachedIds: number[]
): PaperlessDocument[] => {
  if (attachedIds.length === 0) return docs
  const ids = new Set(attachedIds)
  return docs.map((d) => (ids.has(d.id) ? { ...d, attached: true } : d))
}

/** Top-N ranked, not-yet-attached suggestions for the editor card. */
export const topSuggestions = (
  docs: PaperlessDocument[],
  limit = 3
): PaperlessDocument[] => docs.filter((d) => !d.attached).slice(0, limit)

/**
 * A picker result for local-accumulate flows (create/assign, where the
 * target doesn't exist yet so nothing is written): the material is built
 * locally from the picked document. The link `id` is a client-only
 * placeholder (UI keys by `document_id`); real links are created
 * server-side once the target exists.
 */
export const docToPendingMaterial = (doc: PaperlessDocument): PaperlessMaterial => ({
  id: doc.id,
  document_id: doc.id,
  external_id: doc.external_id,
  title: doc.title,
  asn: doc.asn,
  material_kind: doc.material_kind,
  subject_id: doc.subject_id,
  page_count: doc.page_count,
  correspondent: doc.correspondent,
})
