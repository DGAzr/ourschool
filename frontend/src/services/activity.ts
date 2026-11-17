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
 * Structured context attached to an activity item. Mirrors the ad-hoc
 * `details` dicts built in app/routers/activity.py; which fields are present
 * depends on the activity type, so all are optional.
 */
interface ActivityDetails {
  assignment_id?: number
  student_assignment_id?: number
  template_name?: string
  subject?: string | null
  grade?: number
  attendance_id?: number
  status?: string
  date?: string
  notes?: string | null
  [key: string]: unknown
}

export interface ActivityItem {
  activity_type: string
  description: string
  timestamp: string
  user_name?: string
  student_name?: string
  details: ActivityDetails
  time_ago: string
}
