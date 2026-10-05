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

export const usersApi = {
  getAll: () => api.get('/users/'),
  
  getById: (id: number) => api.get(`/users/${id}`),
  
  create: (data: {
    email: string
    username: string
    password: string
    first_name: string
    last_name: string
    role: 'admin' | 'student'
    parent_id?: number
    date_of_birth?: string | null
    grade_level?: number
  }) => api.post('/users/', data),
  
  update: (id: number, data: {
    email?: string
    username?: string
    first_name?: string
    last_name?: string
    student_ui_mode?: 'regular' | 'simple'
    is_active?: boolean
    date_of_birth?: string | null
    grade_level?: number
  }) => api.put(`/users/${id}`, data),
  
  delete: (id: number) => api.delete(`/users/${id}`),
  
  resetPassword: (id: number) => api.post(`/users/${id}/reset-password`, {}),
  
  updateMe: (data: {
    first_name?: string
    last_name?: string
    email?: string
    show_points?: boolean
    show_effort_signals?: boolean
    celebrate_completion?: boolean
    theme_preference?: 'light' | 'dark' | 'system'
  }) => api.put('/users/me', data),

  changeMyPassword: (passwordData: {
    current_password: string
    new_password: string
  }) => api.post('/users/me/change-password', passwordData)
}
