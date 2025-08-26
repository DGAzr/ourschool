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

export const attendanceApi = {
  getAll: (params?: {
    student_id?: number
    start_date?: string
    end_date?: string
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.student_id) queryParams.append('student_id', params.student_id.toString())
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    
    const query = queryParams.toString()
    return api.get(`/attendance/${query ? '?' + query : ''}`)
  },
  
  create: (data: {
    student_id: number
    date: string
    status: 'present' | 'absent' | 'late' | 'excused'
    notes?: string
  }) => api.post('/attendance/', data),
  
  update: (id: number, data: {
    status?: 'present' | 'absent' | 'late' | 'excused'
    notes?: string
  }) => api.put(`/attendance/${id}`, data),
  
  delete: (id: number) => api.delete(`/attendance/${id}`),
  
  // Bulk attendance creation
  createBulk: (data: {
    student_ids: number[]
    date: string
    status: 'present' | 'absent' | 'late' | 'excused'
    notes?: string
  }) => api.post('/attendance/bulk', data),
  
  // Get students for attendance
  getStudents: () => api.get('/attendance/students')
}