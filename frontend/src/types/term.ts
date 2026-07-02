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
}

export interface TermUpdate {
  name?: string
  description?: string
  start_date?: string
  end_date?: string
  academic_year?: string
  term_type?: 'semester' | 'quarter' | 'trimester' | 'custom'
  is_active?: boolean
}

/** Result of POST /terms/{id}/auto-link-subjects (app/routers/terms.py). */
export interface TermAutoLinkResult {
  message: string
  details: {
    subjects_linked: number
    term_subjects_created: number
  }
}

/** Result of POST /terms/{id}/calculate-grades (app/routers/terms.py). */
export interface TermGradeCalculationResult {
  message: string
  details: {
    grades_calculated: number
    students_processed: number
  }
}
