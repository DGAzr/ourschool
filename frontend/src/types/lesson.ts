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
 * Lesson and subject related types
 */

export interface Subject {
  id: number
  name: string
  description?: string
  color: string
  created_at: string
}

export interface Lesson {
  id: number
  title: string
  description?: string
  scheduled_date: string
  start_time?: string
  end_time?: string
  estimated_duration_minutes?: number
  materials_needed?: string
  objectives?: string
  prerequisites?: string
  resources?: string
  lesson_order: number
  created_at: string
  updated_at: string
  subjects: Subject[]
  subject_names: string[]
  subject_colors: string[]
  primary_subject?: Subject
}

export interface Term {
  id: number
  name: string
  description?: string
  start_date: string
  end_date: string
  academic_year: string
  term_type: 'semester' | 'quarter' | 'trimester' | 'custom'
  is_active: boolean
  term_order: number
  created_at: string
  updated_at: string
  created_by: number
}

export interface TermCreate {
  name: string
  description?: string
  start_date: string
  end_date: string
  academic_year: string
  term_type: 'semester' | 'quarter' | 'trimester' | 'custom'
  term_order: number
}

export interface TermUpdate {
  name?: string
  description?: string
  start_date?: string
  end_date?: string
  academic_year?: string
  term_type?: 'semester' | 'quarter' | 'trimester' | 'custom'
  is_active?: boolean
  term_order?: number
}