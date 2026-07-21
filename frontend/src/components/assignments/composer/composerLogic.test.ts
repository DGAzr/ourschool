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
import { buildComposePayload, initialDraft, validateDraft, type ComposerMode } from './composerLogic'
import { AssignmentTemplate } from '../../../types'

const template = {
  id: 7, name: 'Fractions', description: 'd', instructions: 'i',
  assignment_type: 'homework', subject_id: 3, icon: null, max_points: 40,
  estimated_duration_minutes: 20, is_library: true, is_exportable: false,
} as unknown as AssignmentTemplate

const createMode: ComposerMode = { kind: 'create', showAssign: true, libraryDefault: false }

describe('initialDraft', () => {
  it('applies prefill and library default in create mode', () => {
    const d = initialDraft({ kind: 'create', showAssign: false, libraryDefault: false, prefill: { subject_id: 3, due_date: '2026-09-01' } })
    expect(d.subject_id).toBe(3)
    expect(d.due_date).toBe('2026-09-01')
    expect(d.save_to_library).toBe(false)
    expect(d.assigned_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('copies template fields in assign/edit modes', () => {
    const d = initialDraft({ kind: 'assign', template })
    expect(d.name).toBe('Fractions')
    expect(d.max_points).toBe(40)
    expect(d.student_ids).toEqual([])
  })
  it('preserves the template is_exportable flag in edit mode', () => {
    const d = initialDraft({ kind: 'edit', template })
    expect(d.is_exportable).toBe(false)
  })
})

describe('validateDraft', () => {
  it('requires name and subject', () => {
    const d = initialDraft(createMode)
    expect(validateDraft(d, createMode)).toMatch(/name/i)
    expect(validateDraft({ ...d, name: 'X' }, createMode)).toMatch(/subject/i)
  })
  it('requires students unless saving to library (create+assign mode)', () => {
    const d = { ...initialDraft(createMode), name: 'X', subject_id: 3 }
    expect(validateDraft(d, createMode)).toMatch(/student/i)
    expect(validateDraft({ ...d, save_to_library: true }, createMode)).toBeNull()
    expect(validateDraft({ ...d, student_ids: [1] }, createMode)).toBeNull()
  })
  it('does not require students when the assign section is hidden', () => {
    const mode: ComposerMode = { kind: 'create', showAssign: false, libraryDefault: false }
    const d = { ...initialDraft(mode), name: 'X', subject_id: 3 }
    expect(validateDraft(d, mode)).toBeNull()
  })
  it('requires students in assign mode', () => {
    const mode: ComposerMode = { kind: 'assign', template }
    expect(validateDraft(initialDraft(mode), mode)).toMatch(/student/i)
  })
})

describe('buildComposePayload', () => {
  it('maps the draft and omits empty optionals', () => {
    const d = { ...initialDraft(createMode), name: ' X ', subject_id: 3, student_ids: [1, 2], due_date: '', custom_instructions: '' }
    const p = buildComposePayload(d)
    expect(p.name).toBe('X')
    expect(p.is_library).toBe(false)
    expect(p.student_ids).toEqual([1, 2])
    expect(p.due_date).toBeUndefined()
    expect(p.custom_instructions).toBeUndefined()
  })
  it('keeps is_exportable true on a fresh create draft even when not saving to library', () => {
    const d = { ...initialDraft(createMode), name: 'X', subject_id: 3, student_ids: [1] }
    const p = buildComposePayload(d)
    expect(p.is_library).toBe(false)
    expect(p.is_exportable).toBe(true)
  })
})
