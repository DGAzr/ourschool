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

// Types for the points system
export interface PointTransaction {
  id: number
  student_id: number
  amount: number
  transaction_type: 'assignment' | 'admin_award' | 'admin_deduction' | 'spending'
  source_id?: number
  source_description?: string
  notes?: string
  admin_id?: number
  created_at: string
  student_name?: string
  admin_name?: string
}

export interface StudentPoints {
  id: number
  student_id: number
  current_balance: number
  total_earned: number
  total_spent: number
  created_at: string
  updated_at: string
  student_name?: string
}

export interface PointsLedger {
  student_points: StudentPoints
  transactions: PointTransaction[]
  total_pages: number
  current_page: number
}

export interface AdminPointsOverview {
  total_students_with_points: number
  total_students: number
  total_points_awarded: number
  total_points_spent: number
  student_points: StudentPoints[]
}

export interface AdminPointAdjustment {
  student_id: number
  amount: number
  notes: string
}

export interface PointsSystemStatus {
  enabled: boolean
  can_toggle: boolean
}

export const pointsApi = {
  // System status
  getSystemStatus: async (): Promise<PointsSystemStatus> => {
    return await api.get('/points/status')
  },

  toggleSystem: async (): Promise<{ message: string; enabled: boolean }> => {
    return await api.post('/points/toggle', {})
  },

  // Student endpoints
  getMyBalance: async (): Promise<StudentPoints> => {
    return await api.get('/points/my-balance')
  },

  getMyLedger: async (page: number = 1, perPage: number = 20): Promise<PointsLedger> => {
    return await api.get(`/points/my-ledger?page=${page}&per_page=${perPage}`)
  },

  // Admin endpoints
  getStudentBalance: async (studentId: number): Promise<StudentPoints> => {
    return await api.get(`/points/student/${studentId}/balance`)
  },

  getStudentLedger: async (
    studentId: number, 
    page: number = 1, 
    perPage: number = 20
  ): Promise<PointsLedger> => {
    return await api.get(`/points/student/${studentId}/ledger?page=${page}&per_page=${perPage}`)
  },

  adjustPoints: async (adjustment: AdminPointAdjustment): Promise<PointTransaction> => {
    return await api.post('/points/adjust', adjustment)
  },

  getAdminOverview: async (): Promise<AdminPointsOverview> => {
    return await api.get('/points/admin/overview')
  },
}