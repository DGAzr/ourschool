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
  AssignmentTemplate,
  AssignmentTemplateCreate,
  AssignmentTemplateUpdate,
  StudentAssignment,
  AssignmentAssignmentRequest,
  AssignmentAssignmentResponse,
  StudentAssignmentProgressSummary,
  Subject,
  Lesson,
  User
} from '../types'

export const assignmentsApi = {
  // Assignment Template Management
  async getAll(params?: {
    lesson_id?: number
    subject_id?: number
    skip?: number
    limit?: number
  }): Promise<AssignmentTemplate[]> {
    const searchParams = new URLSearchParams()
    if (params?.lesson_id) searchParams.append('lesson_id', params.lesson_id.toString())
    if (params?.subject_id) searchParams.append('subject_id', params.subject_id.toString())
    if (params?.skip) searchParams.append('skip', params.skip.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    
    const queryString = searchParams.toString()
    const url = `/assignments/templates${queryString ? `?${queryString}` : ''}`
    
    const response = await api.get(url)
    return response
  },

  async getById(id: number): Promise<AssignmentTemplate> {
    const response = await api.get(`/assignments/templates/${id}`)
    return response
  },

  async create(template: AssignmentTemplateCreate): Promise<AssignmentTemplate> {
    const response = await api.post('/assignments/templates', template)
    return response
  },

  async update(id: number, template: AssignmentTemplateUpdate): Promise<AssignmentTemplate> {
    const response = await api.put(`/assignments/templates/${id}`, template)
    return response
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/assignments/templates/${id}`)
  },

  // Assignment Assignment (assign templates to students)
  async assignToStudents(assignment: AssignmentAssignmentRequest): Promise<AssignmentAssignmentResponse> {
    const response = await api.post('/assignments/assign', assignment)
    return response
  },

  // Student Assignment Management
  async getStudentAssignments(studentId: number, params?: {
    subject_id?: number
    status?: string
  }): Promise<StudentAssignment[]> {
    const searchParams = new URLSearchParams()
    if (params?.subject_id) searchParams.append('subject_id', params.subject_id.toString())
    if (params?.status) searchParams.append('status', params.status)
    
    const queryString = searchParams.toString()
    const url = `/assignments/students/${studentId}/assignments${queryString ? `?${queryString}` : ''}`
    
    const response = await api.get(url)
    return response
  },

  async getStudentAssignment(assignmentId: number): Promise<StudentAssignment> {
    const response = await api.get(`/assignments/student-assignments/${assignmentId}`)
    return response
  },

  async updateStudentAssignment(assignmentId: number, update: {
    due_date?: string
    extended_due_date?: string
    status?: string
    custom_instructions?: string
    custom_max_points?: number
    student_notes?: string
    submission_notes?: string
    submission_artifacts?: string[]
  }): Promise<StudentAssignment> {
    const response = await api.put(`/assignments/student-assignments/${assignmentId}`, update)
    return response
  },

  async gradeStudentAssignment(assignmentId: number, grade: {
    points_earned: number
    teacher_feedback?: string
    letter_grade?: string
  }): Promise<StudentAssignment> {
    const response = await api.post(`/assignments/student-assignments/${assignmentId}/grade`, grade)
    return response
  },

  async archiveStudentAssignment(assignmentId: number): Promise<StudentAssignment> {
    const response = await api.post(`/assignments/student-assignments/${assignmentId}/archive`, {})
    return response
  },

  async deleteStudentAssignment(assignmentId: number): Promise<void> {
    await api.delete(`/assignments/student-assignments/${assignmentId}`)
  },

  async archiveTemplate(templateId: number): Promise<AssignmentTemplate> {
    const response = await api.post(`/assignments/templates/${templateId}/archive`, {})
    return response
  },

  // Progress and Analytics
  async getStudentProgress(studentId: number): Promise<StudentAssignmentProgressSummary> {
    const response = await api.get(`/assignments/students/${studentId}/progress`)
    return response
  },

  // New workflow endpoints
  async getMyAssignments(params?: {
    status?: string
    subject_id?: number
  }): Promise<StudentAssignment[]> {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.append('status', params.status)
    if (params?.subject_id) searchParams.append('subject_id', params.subject_id.toString())
    
    const queryString = searchParams.toString()
    const url = `/assignments/my-assignments${queryString ? `?${queryString}` : ''}`
    
    const response = await api.get(url)
    return response
  },

  async startAssignment(assignmentId: number): Promise<StudentAssignment> {
    const response = await api.post(`/assignments/student-assignments/${assignmentId}/start`, {})
    return response
  },

  async completeAssignment(assignmentId: number, submissionNotes?: string): Promise<StudentAssignment> {
    const response = await api.post(`/assignments/student-assignments/${assignmentId}/complete`, {
      submission_notes: submissionNotes
    })
    return response
  },

  async getDashboardOverview(): Promise<Record<string, unknown>> {
    const response = await api.get('/assignments/dashboard/overview')
    return response
  },

  // Helper APIs for dropdowns and forms
  async getSubjects(): Promise<Subject[]> {
    const response = await api.get('/lessons/subjects/')
    return response
  },

  async getLessons(): Promise<Lesson[]> {
    const url = `/lessons/`
    
    const response = await api.get(url)
    return response
  },

  async getStudents(): Promise<User[]> {
    const response = await api.get('/attendance/students')
    return response
  },

  async getSubmittedAssignments(params?: {
    status?: string
    subject_id?: number
  }): Promise<StudentAssignment[]> {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.append('status', params.status)
    if (params?.subject_id) searchParams.append('subject_id', params.subject_id.toString())
    
    const queryString = searchParams.toString()
    const url = `/assignments/submitted${queryString ? `?${queryString}` : ''}`
    
    const response = await api.get(url)
    return response
  },

  async getAllAssignmentsForGrading(params?: {
    status?: string
    subject_id?: number
    student_id?: number
  }): Promise<StudentAssignment[]> {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.append('status', params.status)
    if (params?.subject_id) searchParams.append('subject_id', params.subject_id.toString())
    if (params?.student_id) searchParams.append('student_id', params.student_id.toString())
    
    const queryString = searchParams.toString()
    const url = `/assignments/all-assignments${queryString ? `?${queryString}` : ''}`
    
    const response = await api.get(url)
    return response
  },

  async getTemplateAssignments(templateId: number): Promise<StudentAssignment[]> {
    const response = await api.get(`/assignments/templates/${templateId}/assignments`)
    return response
  },

  // Import/Export functionality
  async exportTemplate(templateId: number): Promise<any> {
    const response = await api.get(`/assignments/templates/${templateId}/export`)
    return response
  },

  async importTemplate(data: {
    assignment_data: any
    target_lesson_id?: number
    target_subject_id?: number
  }): Promise<any> {
    const response = await api.post('/assignments/templates/import', data)
    return response
  },

  async bulkExportTemplates(templateIds: number[]): Promise<any> {
    const response = await api.post('/assignments/templates/bulk-export', { template_ids: templateIds })
    return response
  }
}

// Utility functions for assignment templates
export const assignmentUtils = {

  getAssignmentTypeIcon(type: string): string {
    switch (type) {
      case 'homework':
        return '📝'
      case 'project':
        return '🏗️'
      case 'test':
        return '📊'
      case 'quiz':
        return '❓'
      case 'essay':
        return '✍️'
      case 'presentation':
        return '🎤'
      case 'worksheet':
        return '📄'
      case 'reading':
        return '📚'
      case 'practice':
        return '🎯'
      default:
        return '📋'
    }
  },

  getStatusColor(status: string): string {
    switch (status) {
      case 'not_started':
        return 'bg-gray-100 text-gray-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'submitted':
        return 'bg-purple-100 text-purple-800'
      case 'graded':
        return 'bg-indigo-100 text-indigo-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'excused':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  },

  formatDuration(minutes?: number): string {
    if (!minutes) return 'No estimate'
    if (minutes < 60) return `${minutes} min`
    
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    
    if (remainingMinutes === 0) return `${hours}h`
    return `${hours}h ${remainingMinutes}m`
  },

  calculateGradeColor(percentage?: number): string {
    if (!percentage) return 'text-gray-500'
    
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 80) return 'text-blue-600'
    if (percentage >= 70) return 'text-yellow-600'
    if (percentage >= 60) return 'text-orange-600'
    return 'text-red-600'
  }
}