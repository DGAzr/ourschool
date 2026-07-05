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
  Term,
  TermAutoLinkResult,
  TermCreate,
  TermGradeCalculationResult,
  TermUpdate
} from '../types'

export const termsApi = {
  // Get all terms
  getAll: async (): Promise<Term[]> => {
    const data = await api.get('/terms/')
    return Array.isArray(data) ? data : []
  },

  // Get term by ID
  getById: async (id: number): Promise<Term> => {
    return await api.get(`/terms/${id}`)
  },

  // Create new term
  create: async (data: TermCreate): Promise<Term> => {
    return await api.post('/terms/', data)
  },

  // Update term
  update: async (id: number, data: TermUpdate): Promise<Term> => {
    return await api.put(`/terms/${id}`, data)
  },

  // Delete term
  delete: async (id: number): Promise<void> => {
    await api.delete(`/terms/${id}`)
  },

  // Activate term (set as current active term)
  activate: async (id: number): Promise<Term> => {
    return await api.post(`/terms/${id}/activate`, {})
  },

  // Get active term
  getActive: async (): Promise<Term | null> => {
    try {
      return await api.get('/terms/active')
    } catch (error) {
      // Return null if no active term
      return null
    }
  },

  // Auto-link subjects to term based on assignment dates
  autoLinkSubjects: async (termId: number): Promise<TermAutoLinkResult> => {
    return await api.post(`/terms/${termId}/auto-link-subjects`, {})
  },

  // Calculate grades for term
  calculateGrades: async (termId: number, studentId?: number): Promise<TermGradeCalculationResult> => {
    const endpoint = `/terms/${termId}/calculate-grades${studentId ? `?student_id=${studentId}` : ''}`
    return await api.post(endpoint, {})
  },

  // Get term grade report. The backend returns an untyped dict
  // (TermGradingService.get_term_grade_report), so callers must narrow.
  getGradeReport: async (termId: number): Promise<Record<string, unknown>> => {
    return await api.get(`/terms/${termId}/grade-report`)
  },

  // Get student term report. The backend returns an untyped dict
  // (TermGradingService.get_student_term_report), so callers must narrow.
  getStudentReport: async (termId: number, studentId: number): Promise<Record<string, unknown>> => {
    return await api.get(`/terms/${termId}/students/${studentId}/report`)
  }
}