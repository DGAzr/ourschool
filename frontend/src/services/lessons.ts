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

export const lessonsApi = {
  // Subjects
  getSubjects: () => api.get('/lessons/subjects/'),
  
  createSubject: (data: {
    name: string
    description?: string
    color?: string
  }) => api.post('/lessons/subjects/', data),

  updateSubject: (id: number, data: {
    name?: string
    description?: string
    color?: string
  }) => api.put(`/lessons/subjects/${id}`, data),

  deleteSubject: (id: number) => api.delete(`/lessons/subjects/${id}`),
  
  // Lessons
  getAll: (params?: {
    start_date?: string
    end_date?: string
    subject_id?: number
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    if (params?.subject_id) queryParams.append('subject_id', params.subject_id.toString())
    
    const query = queryParams.toString()
    return api.get(`/lessons/${query ? '?' + query : ''}`)
  },
  
  getById: (id: number) => api.get(`/lessons/${id}`),
  
  create: (data: {
    title: string
    description?: string
    scheduled_date: string
    start_time?: string
    end_time?: string
    materials_needed?: string
    objectives?: string
  }) => api.post('/lessons/', data),
  
  update: (id: number, data: {
    title?: string
    description?: string
    scheduled_date?: string
    start_time?: string
    end_time?: string
    materials_needed?: string
    objectives?: string
  }) => api.put(`/lessons/${id}`, data),
  
  delete: (id: number) => api.delete(`/lessons/${id}`),
  
  // Lesson Assignment Management (grouping assignments within lessons)
  addAssignmentToLesson: (lessonId: number, assignmentData: {
    assignment_template_id: number
    order_in_lesson?: number
    planned_duration_minutes?: number
    custom_instructions?: string
    is_required?: boolean
    custom_max_points?: number
  }) => api.post(`/lessons/${lessonId}/assignments`, assignmentData),
  
  getLessonAssignments: (lessonId: number) => api.get(`/lessons/${lessonId}/assignments`),
  
  updateLessonAssignment: (lessonId: number, assignmentId: number, updateData: {
    assignment_template_id?: number
    order_in_lesson?: number
    planned_duration_minutes?: number
    custom_instructions?: string
    is_required?: boolean
    custom_max_points?: number
  }) => api.put(`/lessons/${lessonId}/assignments/${assignmentId}`, updateData),
  
  removeLessonAssignment: (lessonId: number, assignmentId: number) => 
    api.delete(`/lessons/${lessonId}/assignments/${assignmentId}`),
  
  getLessonWithAssignments: (lessonId: number) => api.get(`/lessons/${lessonId}/with-assignments`),
  
  // Lesson Assignment Workflow (assign entire lessons to students)
  assignLessonToStudents: (assignmentData: {
    lesson_id: number
    student_ids: number[]
    due_date?: string
    custom_instructions?: string
  }) => api.post('/lessons/assign', assignmentData),
  
  // Helper functions for assignment templates and students
  getAssignmentTemplates: (params?: {
    subject_id?: number
    lesson_id?: number
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.subject_id) queryParams.append('subject_id', params.subject_id.toString())
    if (params?.lesson_id) queryParams.append('lesson_id', params.lesson_id.toString())
    
    const query = queryParams.toString()
    return api.get(`/assignments/templates${query ? '?' + query : ''}`)
  },
  
  getStudents: () => api.get('/attendance/students'),
  
  // Import/Export functionality
  exportLesson: (id: number) => api.get(`/lessons/${id}/export`),
  
  importLesson: (data: {
    lesson_export: any
    target_date?: string
    subject_mappings?: Record<string, number>
    create_missing_subjects?: boolean
  }) => api.post('/lessons/import', data),
}