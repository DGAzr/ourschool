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
 * Assignment and assessment related types
 */

/**
 * Admin-managed assignment type / grade-book category.
 * `weight` is a category percentage (0-100).
 */
export interface AssignmentTypeConfig {
  id: number
  key: string
  name: string
  color: string
  icon?: string
  weight: number
  is_active: boolean
  display_order: number
  usage_count: number
  created_at?: string
  updated_at?: string
}

export interface AssignmentTypeCreate {
  name: string
  color?: string
  icon?: string
  weight?: number
  is_active?: boolean
  display_order?: number
  key?: string
}

export interface AssignmentTypeUpdate {
  name?: string
  color?: string
  icon?: string
  weight?: number
  is_active?: boolean
  display_order?: number
}

export interface AssignmentTemplate {
  id: number
  name: string
  description?: string
  instructions?: string
  assignment_type: string
  subject_id: number
  icon?: string
  max_points: number
  estimated_duration_minutes?: number
  prerequisites?: string
  materials_needed?: string
  is_exportable: boolean
  is_archived: boolean
  created_by: number
  created_at: string
  updated_at: string
  total_assigned?: number
  active_assigned?: number
  average_grade?: number
}

export interface StudentAssignment {
  id: number
  template_id: number
  student_id: number
  assigned_date: string
  due_date?: string
  extended_due_date?: string
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'overdue' | 'excused'
  started_date?: string
  completed_date?: string
  submitted_date?: string
  points_earned?: number
  percentage_grade?: number
  letter_grade?: string
  is_graded: boolean
  graded_date?: string
  graded_by?: number
  teacher_feedback?: string
  student_notes?: string
  submission_notes?: string
  submission_artifacts?: string[]
  time_spent_minutes: number
  custom_instructions?: string
  custom_max_points?: number
  assigned_by: number
  created_at: string
  updated_at: string
  template?: AssignmentTemplate
}

export interface AssignmentTemplateCreate {
  name: string
  description?: string
  instructions?: string
  assignment_type: string
  subject_id: number
  icon?: string | null
  max_points: number
  estimated_duration_minutes?: number
  prerequisites?: string
  materials_needed?: string
  is_exportable: boolean
}

export interface AssignmentTemplateUpdate {
  name?: string
  description?: string
  instructions?: string
  assignment_type?: string
  subject_id?: number
  icon?: string | null
  max_points?: number
  estimated_duration_minutes?: number
  prerequisites?: string
  materials_needed?: string
  is_exportable?: boolean
}

export interface AssignmentAssignmentRequest {
  template_id: number
  student_ids: number[]
  due_date?: string
  assigned_date?: string
  custom_instructions?: string
  custom_max_points?: number
}

export interface AssignmentAssignmentResponse {
  success_count: number
  failed_assignments: Array<{
    student_id: number
    error: string
  }>
  created_assignments: StudentAssignment[]
}

/**
 * Metadata attached to exported templates (`export_metadata`).
 * Mirrors the ad-hoc dict built in app/routers/assignments/templates.py.
 */
interface AssignmentTemplateExportMetadata {
  format_version?: string
  exported_by?: string
  export_timestamp?: string
  template_id?: number
  [key: string]: unknown
}

/**
 * An exported assignment template.
 * Mirrors AssignmentTemplateExport in app/schemas/assignment.py.
 */
export interface AssignmentTemplateExport {
  name: string
  description?: string | null
  instructions?: string | null
  assignment_type: string
  subject_name: string
  icon?: string | null
  max_points: number
  estimated_duration_minutes?: number | null
  prerequisites?: string | null
  materials_needed?: string | null
  export_metadata?: AssignmentTemplateExportMetadata
}

/**
 * Request body for POST /assignments/templates/import.
 * Mirrors AssignmentTemplateImport in app/schemas/assignment.py.
 */
export interface AssignmentTemplateImportRequest {
  assignment_data: AssignmentTemplateExport
  target_subject_id?: number
}

/** Response of POST /assignments/templates/import. */
export interface AssignmentTemplateImportResult {
  success: boolean
  template_id: number
  message: string
}

/** Response of POST /assignments/templates/bulk-export. */
export interface AssignmentTemplateBulkExport {
  format_version: string
  export_timestamp: string
  exported_by: string
  templates: AssignmentTemplateExport[]
  metadata: {
    template_count: number
    subjects: string[]
  }
}

interface SubjectProgress {
  subject_id: number
  subject_name: string
  subject_color: string
  total_assignments: number
  completed_assignments: number
  average_grade?: number
  completion_percentage: number
}

export interface StudentAssignmentProgressSummary {
  student_id: number
  student_name: string
  total_assignments: number
  completed_assignments: number
  average_grade?: number
  subjects: SubjectProgress[]
}