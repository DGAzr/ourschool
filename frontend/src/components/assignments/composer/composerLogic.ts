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

import {
  AssignmentComposeRequest,
  AssignmentTemplate,
  AssignmentTemplateCreate,
} from '../../../types'

export type ComposerMode =
  | { kind: 'create'; showAssign: boolean; libraryDefault: boolean;
      prefill?: { subject_id?: number | null; assigned_date?: string; due_date?: string } }
  | { kind: 'assign'; template: AssignmentTemplate }
  | { kind: 'edit'; template: AssignmentTemplate }

export interface ComposerDraft {
  name: string
  description: string
  instructions: string
  assignment_type: string
  subject_id: number
  icon: string | null
  max_points: number
  estimated_duration_minutes?: number
  prerequisites: string
  materials_needed: string
  is_exportable: boolean
  save_to_library: boolean
  student_ids: number[]
  assigned_date: string
  due_date: string
  custom_instructions: string
  custom_max_points?: number
}

const todayISO = () => new Date().toISOString().slice(0, 10)

export const initialDraft = (mode: ComposerMode): ComposerDraft => {
  const t = mode.kind === 'create' ? null : mode.template
  return {
    name: t?.name ?? '',
    description: t?.description ?? '',
    instructions: t?.instructions ?? '',
    assignment_type: t?.assignment_type ?? 'homework',
    subject_id: t?.subject_id ?? (mode.kind === 'create' ? mode.prefill?.subject_id ?? 0 : 0),
    icon: t?.icon ?? null,
    max_points: t?.max_points ?? 100,
    estimated_duration_minutes: t?.estimated_duration_minutes ?? undefined,
    prerequisites: t?.prerequisites ?? '',
    materials_needed: t?.materials_needed ?? '',
    is_exportable: t?.is_exportable ?? true,
    save_to_library: mode.kind === 'create' ? mode.libraryDefault : (t?.is_library ?? true),
    student_ids: [],
    assigned_date:
      (mode.kind === 'create' ? mode.prefill?.assigned_date : undefined) ?? todayISO(),
    due_date: (mode.kind === 'create' ? mode.prefill?.due_date : undefined) ?? '',
    custom_instructions: '',
    custom_max_points: undefined,
  }
}

export const validateDraft = (draft: ComposerDraft, mode: ComposerMode): string | null => {
  if (mode.kind !== 'assign') {
    if (!draft.name.trim()) return 'Give the assignment a name.'
    if (!draft.subject_id) return 'Pick a subject.'
  }
  const needsStudents =
    mode.kind === 'assign' ||
    (mode.kind === 'create' && mode.showAssign && !draft.save_to_library)
  if (needsStudents && draft.student_ids.length === 0) {
    return mode.kind === 'assign'
      ? 'Select at least one student.'
      : 'Select at least one student, or turn on "Save to library" to keep it for later.'
  }
  return null
}

const templateFields = (draft: ComposerDraft): AssignmentTemplateCreate => ({
  name: draft.name.trim(),
  description: draft.description.trim() || undefined,
  instructions: draft.instructions.trim() || undefined,
  assignment_type: draft.assignment_type,
  subject_id: draft.subject_id,
  icon: draft.icon,
  max_points: draft.max_points,
  estimated_duration_minutes: draft.estimated_duration_minutes || undefined,
  prerequisites: draft.prerequisites.trim() || undefined,
  materials_needed: draft.materials_needed.trim() || undefined,
  is_exportable: draft.is_exportable,
})

export const buildComposePayload = (draft: ComposerDraft): AssignmentComposeRequest => ({
  ...templateFields(draft),
  is_library: draft.save_to_library,
  student_ids: draft.student_ids,
  assigned_date: draft.assigned_date || undefined,
  due_date: draft.due_date || undefined,
  custom_instructions: draft.custom_instructions.trim() || undefined,
  custom_max_points: draft.custom_max_points || undefined,
})

/** Body for assignmentsApi.assignToStudents (assign-existing-template mode). */
export const buildAssignPayload = (draft: ComposerDraft, templateId: number) => ({
  template_id: templateId,
  student_ids: draft.student_ids,
  assigned_date: draft.assigned_date || undefined,
  due_date: draft.due_date || undefined,
  custom_instructions: draft.custom_instructions.trim() || undefined,
  custom_max_points: draft.custom_max_points || undefined,
})

/** Body for assignmentsApi.update (edit-template mode). */
export const buildTemplateUpdate = (draft: ComposerDraft) => templateFields(draft)
