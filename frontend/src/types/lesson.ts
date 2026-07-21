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

import { PaperlessMaterial } from './paperless'

export type LessonStatus = 'planned' | 'ready' | 'taught'

export interface LessonMaterial {
  id: number
  label: string
  is_gathered: boolean
  position: number
}

export interface LessonResource {
  id: number
  label: string
  url?: string | null
  position: number
}

export interface LessonStudentSummary {
  id: number
  first_name: string
  last_name: string
  username: string
}

export interface LessonSubjectSummary {
  id: number
  name: string
  color?: string | null
  icon?: string | null
}

export interface LessonTemplateSummary {
  id: number
  name: string
  assignment_type: string
  max_points: number
  estimated_duration_minutes?: number | null
  subject_id: number
}

// A linked template on a lesson, with per-link overrides. `id` is the link's
// own id (LessonTemplate row), distinct from template.id.
export interface LessonTemplateLink {
  id: number
  template_id?: number | null
  custom_due_date?: string | null
  custom_max_points?: number | null
  custom_instructions?: string | null
  template?: LessonTemplateSummary | null
}

export interface Lesson {
  id: number
  external_id: string
  position: number
  title: string
  date: string
  subject_id?: number | null
  objective?: string | null
  duration_minutes?: number | null
  notes?: string | null
  status: LessonStatus
  created_by?: number | null
  created_at: string
  updated_at: string
  subject?: LessonSubjectSummary | null
  templates: LessonTemplateLink[]
  students: LessonStudentSummary[]
  materials: LessonMaterial[]
  resources: LessonResource[]
  // Paperless-NGX documents attached to this lesson (distinct from the
  // physical `materials` gather list).
  paperless_materials: PaperlessMaterial[]
}

// Student-safe lesson projection returned by /lessons/my-lessons. Excludes
// teacher-private fields (notes, roster, gather list).
export interface StudentLesson {
  id: number
  position: number
  title: string
  date: string
  objective?: string | null
  duration_minutes?: number | null
  status: LessonStatus
  subject?: LessonSubjectSummary | null
  templates: LessonTemplateLink[]
  resources: LessonResource[]
  paperless_materials: PaperlessMaterial[]
}

// --- Write payloads ---
export interface LessonMaterialInput {
  label: string
  is_gathered: boolean
}

export interface LessonResourceInput {
  label: string
  url?: string | null
}

export interface LessonTemplateLinkInput {
  template_id: number
  custom_due_date?: string | null
  custom_max_points?: number | null
  custom_instructions?: string | null
}

export interface LessonCreate {
  title: string
  date: string
  subject_id?: number | null
  objective?: string | null
  duration_minutes?: number | null
  notes?: string | null
  status?: LessonStatus
  student_ids?: number[]
  templates?: LessonTemplateLinkInput[]
  materials?: LessonMaterialInput[]
  resources?: LessonResourceInput[]
}

// Update is a full-replace of nested lists when those keys are present.
export type LessonUpdate = Partial<LessonCreate>

export interface LessonWriteResponse {
  lesson: Lesson
  warnings: string[]
}

export interface LessonReorderResponse {
  lessons: Lesson[]
  warnings: string[]
}

export interface LessonDeleteResponse {
  message: string
  warnings: string[]
}
