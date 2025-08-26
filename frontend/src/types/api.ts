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
 * API response and error handling types
 */

export interface ApiErrorResponse {
  detail?: string
  message?: string
  error?: string
  errors?: string[]
  statusText?: string
}

export interface JournalEntry {
  id: number
  student_id: number
  author_id: number
  title: string
  content: string
  entry_date: string
  created_at: string
  updated_at: string
}

export interface JournalEntryWithAuthor extends JournalEntry {
  author_name: string
  student_name: string
  is_own_entry: boolean
}

export interface JournalEntryCreate {
  title: string
  content: string
  entry_date?: string
  student_id?: number
}

export interface JournalEntryUpdate {
  title?: string
  content?: string
  entry_date?: string
}

export interface JournalStudent {
  id: number
  name: string
  email: string
}