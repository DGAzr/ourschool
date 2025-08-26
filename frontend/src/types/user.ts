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
 * User and authentication related types
 */

export interface User {
  id: number
  email: string
  username: string
  first_name: string
  last_name: string
  role: 'admin' | 'student'
  is_active: boolean
  // Student-specific fields (only populated for student users)
  parent_id?: number
  date_of_birth?: string
  grade_level?: number
  // Theme preference
  theme_preference?: 'light' | 'dark' | 'system'
  created_at: string
  updated_at: string
  // Points system fields (for students)
  current_points_balance?: number
}