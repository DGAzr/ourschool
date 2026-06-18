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
