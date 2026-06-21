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
  JournalReply,
  JournalStudent,
  JournalComposerData,
} from '../types'

export const journalApi = {
  getAll: async (studentId?: number): Promise<JournalEntryWithAuthor[]> => {
    const endpoint = studentId ? `/journal/entries?student_id=${studentId}` : '/journal/entries'
    return await api.get(endpoint)
  },

  getById: async (id: number): Promise<JournalEntryWithAuthor> => {
    return await api.get(`/journal/entries/${id}`)
  },

  create: async (data: JournalEntryCreate): Promise<JournalEntryWithAuthor> => {
    return await api.post('/journal/entries', data)
  },

  update: async (id: number, data: JournalEntryUpdate): Promise<JournalEntryWithAuthor> => {
    return await api.put(`/journal/entries/${id}`, data)
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/journal/entries/${id}`)
  },

  setReactions: async (entryId: number, reactions: string[]): Promise<JournalEntryWithAuthor> => {
    return await api.post(`/journal/entries/${entryId}/reactions`, { reactions })
  },

  addReply: async (entryId: number, text: string): Promise<JournalReply> => {
    return await api.post(`/journal/entries/${entryId}/replies`, { text })
  },

  deleteReply: async (replyId: number): Promise<void> => {
    await api.delete(`/journal/replies/${replyId}`)
  },

  markRead: async (entryId: number): Promise<JournalEntryWithAuthor> => {
    return await api.post(`/journal/entries/${entryId}/mark-read`, {})
  },

  getComposerData: async (): Promise<JournalComposerData> => {
    return await api.get('/journal/composer-data')
  },

  getStudents: async (): Promise<JournalStudent[]> => {
    return await api.get('/journal/students')
  },
}
