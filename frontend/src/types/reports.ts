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
 * Reporting and analytics types
 */

export interface TermGrade {
  term_id: number
  term_name: string
  term: string
  academic_year: string
  subject_id: number
  subject_name: string
  subject_color: string
  total_points: number
  total_points_possible: number
  earned_points: number
  total_points_earned: number
  percentage: number
  letter_grade: string
  assignments_count: number
  total_assignments: number
  completed_count: number
  completion_rate: number
  notes?: string
}

export interface TrendDataPoint {
  date: string
  average_grade: number
  assignments_count: number
}

export interface SubjectPerformance {
  subject_id: number
  subject_name: string
  average_percentage: number
  total_assignments: number
  completed_assignments: number
  points_earned?: number
  points_possible?: number
  trend_data?: TrendDataPoint[]
}

export interface StudentProgress {
  student_id: number
  student_name: string
  first_name: string
  last_name: string
  email: string
  grade_level?: number
  current_term_percentage: number
  current_term_letter_grade: string
  overall_grade: number
  total_assignments: number
  completed_assignments: number
  pending_assignments: number
  overdue_assignments: number
  average_grade: number
  completion_rate: number
  attendance_rate?: number
  last_activity_date?: string
  subjects: SubjectPerformance[]
  subject_grades?: SubjectPerformance[]
}

export interface StudentReport {
  total_assignments: number
  completed_assignments: number
  in_progress_assignments: number
  pending_grades: number
  average_grade: number
  current_term_grade: number
}

export interface AdminReport {
  total_students: number
  active_assignments: number
  pending_grades: number
  average_grade: number
  total_assignments: number
  completed_assignments: number
}

export interface AcademicYear {
  year: string
  academic_year: string
  start_date: string
  end_date: string
  is_current: boolean
  terms_count: number
}


export interface AssignmentReportItem {
  assignment_id: number
  template_id: number
  assignment_name: string
  assignment_type: string
  student_id: number
  student_name: string
  subject_id: number
  subject_name: string
  subject_color: string
  term_id?: number
  term_name?: string
  assigned_date: string
  due_date?: string
  status: string
  points_earned?: number
  max_points: number
  percentage_grade?: number
  letter_grade?: string
  is_graded: boolean
  graded_date?: string
  teacher_feedback?: string
  time_spent_minutes: number
  assigned_by_name: string
}

export interface AssignmentReportSummary {
  total_assignments: number
  completed_assignments: number
  in_progress_assignments: number
  graded_assignments: number
  pending_assignments: number
  overdue_assignments: number
  average_grade?: number
  subjects_count: number
  students_count: number
}

export interface AssignmentReport {
  summary: AssignmentReportSummary
  assignments: AssignmentReportItem[]
  available_subjects: Array<{id: number, name: string, color: string}>
  available_students: Array<{id: number, name: string}>
  available_terms: Array<{id: number, name: string, academic_year: string}>
  by_subject: any[]
  by_student: any[]
  recent_activity: any[]
}

export interface ReportCardSubjectGrade {
  subject_id: number
  subject_name: string
  subject_color: string
  assignments_completed: number
  assignments_total: number
  points_earned: number
  points_possible: number
  percentage_grade: number
  letter_grade: string
  comments?: string
}

export interface ReportCardSummary {
  overall_percentage: number
  overall_letter_grade: string
  total_assignments: number
  completed_assignments: number
  subjects_count: number
  attendance_rate?: number
  days_present?: number
  days_absent?: number
  days_late?: number
}

export interface ReportCard {
  student_id: number
  student_name: string
  student_grade_level?: number
  term_id: number
  term_name: string
  academic_year: string
  term_start_date: string
  term_end_date: string
  generated_date: string
  summary: ReportCardSummary
  subject_grades: ReportCardSubjectGrade[]
  teacher_comments?: string
  parent_signature_line: boolean
  next_term_info?: string
}