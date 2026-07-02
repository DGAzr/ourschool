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

export interface JournalGoal {
  id: number
  text: string
  done: boolean
}

export interface JournalReply {
  id: number
  author_name: string
  author_role: 'admin' | 'student'
  text: string
  created_at: string
}

interface JournalEntry {
  id: number
  student_id: number
  author_id: number
  title: string
  content: string
  entry_date: string
  created_at: string
  updated_at: string
  mood?: string
  icon?: string
  tags?: string[]
  win?: string
  goals?: JournalGoal[]
  reactions?: string[]
  needs_response?: boolean
  points_awarded?: number
}

export interface JournalEntryWithAuthor extends JournalEntry {
  author_name: string
  student_name: string
  is_own_entry: boolean
  replies: JournalReply[]
  streak: number
}

export interface JournalEntryCreate {
  title: string
  content: string
  entry_date?: string
  student_id?: number
  mood?: string
  icon?: string
  tags?: string[]
  win?: string
  goals?: JournalGoal[]
}

export interface JournalEntryUpdate {
  title?: string
  content?: string
  entry_date?: string
  mood?: string
  icon?: string
  tags?: string[]
  win?: string
  goals?: JournalGoal[]
}

export interface JournalComposerData {
  streak: number
  subjects: Array<{ id: number; name: string; color: string; icon?: string }>
  points_today: number | null
  points_per_entry: number | null
}

export interface JournalStudent {
  id: number
  name: string
  email: string
}