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
 * Attendance tracking and reporting types
 */

export interface AttendanceRecord {
  id: number
  student_id: number
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  notes?: string
  created_at: string
  updated_at: string
}

export interface AttendanceReportSummary {
  student_id: number
  student_name: string
  student_first_name: string
  student_last_name: string
  grade_level?: number
  total_school_days: number
  total_possible_days: number
  required_days_of_instruction: number
  present_days: number
  absent_days: number
  late_days: number
  excused_days: number
  attendance_rate: number
  attendance_percentage: number
  start_date: string
  end_date: string
  first_absence_date?: string
  recent_activity_summary?: string
}

export interface AttendanceReportDetail {
  date: string
  status: string
  notes?: string
}

export interface StudentAttendanceReport {
  student_id: number
  student_name: string
  grade_level?: number
  academic_year?: string
  summary: AttendanceReportSummary
  daily_records: AttendanceReportDetail[]
  daily_attendance: AttendanceReportDetail[]
}

export interface BulkAttendanceReport {
  academic_year?: string
  start_date: string
  end_date: string
  total_school_days: number
  students: AttendanceReportSummary[]
  student_attendance: AttendanceReportSummary[]
  overall_stats: {
    total_students: number
    average_attendance_rate: number
    total_present: number
    total_absent: number
    total_late: number
    total_excused: number
  }
}