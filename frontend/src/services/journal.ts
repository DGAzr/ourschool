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
  JournalEntryWithAuthor,
  JournalEntryCreate,
  JournalEntryUpdate,
  JournalEntry,
  JournalStudent
} from '../types'

export const journalApi = {
  // Get all journal entries (filtered by role and optional student_id)
  getAll: async (studentId?: number): Promise<JournalEntryWithAuthor[]> => {
    const endpoint = studentId ? `/journal/entries?student_id=${studentId}` : '/journal/entries'
    return await api.get(endpoint)
  },

  // Get a specific journal entry
  getById: async (id: number): Promise<JournalEntryWithAuthor> => {
    return await api.get(`/journal/entries/${id}`)
  },

  // Create a new journal entry
  create: async (data: JournalEntryCreate): Promise<JournalEntry> => {
    return await api.post('/journal/entries', data)
  },

  // Update a journal entry
  update: async (id: number, data: JournalEntryUpdate): Promise<JournalEntry> => {
    return await api.put(`/journal/entries/${id}`, data)
  },

  // Delete a journal entry
  delete: async (id: number): Promise<void> => {
    await api.delete(`/journal/entries/${id}`)
  },

  // Get list of students (for admins)
  getStudents: async (): Promise<JournalStudent[]> => {
    return await api.get('/journal/students')
  }
}