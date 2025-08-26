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

import { api } from './api'
import { 
  StudentReport, 
  AdminReport, 
  TermGrade, 
  SubjectPerformance, 
  StudentProgress,
  StudentAttendanceReport,
  BulkAttendanceReport,
  AcademicYear,
  AssignmentReport,
  ReportCard
} from '../types'
import { Term } from '../types/lesson'

export const reportsApi = {
  getStudentReport: async (): Promise<StudentReport> => {
    const response = await api.get('/reports/student/overview')
    return response
  },
  getAdminReport: async (): Promise<AdminReport> => {
    const response = await api.get('/reports/admin/overview')
    return response
  },
  getStudentTermGrades: async (): Promise<TermGrade[]> => {
    const response = await api.get('/reports/student/term-grades')
    return response
  },
  getStudentSubjectPerformance: async (): Promise<SubjectPerformance[]> => {
    const response = await api.get('/reports/student/subject-performance')
    return response
  },
  getAllStudentsProgress: async (termId?: number): Promise<StudentProgress[]> => {
    const params = termId ? `?term_id=${termId}` : ''
    const response = await api.get(`/reports/admin/student-progress${params}`)
    return response
  },

  // Terms
  getTerms: async (): Promise<Term[]> => {
    const response = await api.get('/terms/')
    return response
  },

  // Attendance Reports
  getAcademicYears: async (): Promise<AcademicYear[]> => {
    const response = await api.get('/reports/academic-years')
    return response
  },

  getStudentAttendanceReport: async (
    options: {
      student_id?: number
      start_date?: string
      end_date?: string
      academic_year?: string
    }
  ): Promise<StudentAttendanceReport> => {
    // For students, we need to get their own user ID
    // For now, let's assume the backend expects the actual student_id
    // This may need to be updated to handle the current user case
    if (!options.student_id) {
      throw new Error('Student ID is required for attendance reports')
    }
    
    const params = new URLSearchParams()
    if (options.start_date) params.append('start_date', options.start_date)
    if (options.end_date) params.append('end_date', options.end_date)
    if (options.academic_year) params.append('academic_year', options.academic_year)
    
    const queryString = params.toString()
    const url = queryString ? `/reports/attendance/student/${options.student_id}?${queryString}` : `/reports/attendance/student/${options.student_id}`
    const response = await api.get(url)
    return response
  },

  getBulkAttendanceReport: async (
    options: {
      start_date?: string
      end_date?: string
      academic_year?: string
    }
  ): Promise<BulkAttendanceReport> => {
    const params = new URLSearchParams()
    if (options.start_date) params.append('start_date', options.start_date)
    if (options.end_date) params.append('end_date', options.end_date)
    if (options.academic_year) params.append('academic_year', options.academic_year)
    
    const queryString = params.toString()
    const url = queryString ? `/reports/attendance/bulk?${queryString}` : '/reports/attendance/bulk'
    const response = await api.get(url)
    return response
  },

  getAssignmentReport: async (
    subjectId?: number,
    studentId?: number,
    termId?: number,
    status?: string
  ): Promise<AssignmentReport> => {
    const params = new URLSearchParams()
    if (subjectId) params.append('subject_id', subjectId.toString())
    if (studentId) params.append('student_id', studentId.toString())
    if (termId) params.append('term_id', termId.toString())
    if (status) params.append('status', status)
    
    const queryString = params.toString()
    const url = queryString ? `/reports/admin/assignments?${queryString}` : '/reports/admin/assignments'
    const response = await api.get(url)
    return response
  },

  getReportCard: async (studentId: number, termId: number, asOfDate?: string): Promise<ReportCard> => {
    const params = new URLSearchParams()
    if (asOfDate) {
      params.append('as_of_date', asOfDate)
    }
    
    const queryString = params.toString()
    const url = queryString ? `/reports/report-card/${studentId}/${termId}?${queryString}` : `/reports/report-card/${studentId}/${termId}`
    const response = await api.get(url)
    return response
  },

  getReportCardOptions: async (): Promise<any[]> => {
    const response = await api.get('/reports/report-card-options')
    return response
  },
}
