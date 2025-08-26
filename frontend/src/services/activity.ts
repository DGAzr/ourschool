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

export interface ActivityItem {
  activity_type: string
  description: string
  timestamp: string
  user_name?: string
  student_name?: string
  details: Record<string, any>
  time_ago: string
}

export interface ActivityResponse {
  activities: ActivityItem[]
  total: number
  date_range: {
    start: string
    end: string
  }
}

export interface ActivityFilters {
  limit?: number
  days?: number
}

class ActivityService {
  /**
   * Get recent activity for the current user
   */
  async getRecentActivity(filters: ActivityFilters = {}): Promise<ActivityResponse> {
    try {
      const params = new URLSearchParams()
      
      if (filters.limit !== undefined) {
        params.append('limit', filters.limit.toString())
      }
      
      if (filters.days !== undefined) {
        params.append('days', filters.days.toString())
      }
      
      const url = `/activity/recent${params.toString() ? '?' + params.toString() : ''}`
      
      const response = await api.get(url)
      
      if (!response) {
        throw new Error('No response received from activity API')
      }
      
      // The api.get() method returns the parsed JSON directly, not wrapped in a .data property
      return response
    } catch (error) {
      throw error
    }
  }

  /**
   * Get activity with custom filters
   */
  async getActivity(options: {
    limit?: number
    days?: number
  } = {}): Promise<ActivityItem[]> {
    const response = await this.getRecentActivity(options)
    return response.activities
  }

  /**
   * Get activity for dashboard (limited to most recent items)
   */
  async getDashboardActivity(): Promise<ActivityItem[]> {
    const response = await this.getRecentActivity({ limit: 10, days: 7 })
    return response.activities
  }
}

export const activityApi = new ActivityService()