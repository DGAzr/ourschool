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

export interface SystemSetting {
  id: number
  setting_key: string
  setting_value: string
  setting_type: string
  description?: string
  is_active: boolean
}

export interface AttendanceSettings {
  required_days_of_instruction: number
}

export interface SystemSettingsGroup {
  attendance: AttendanceSettings
}

export const settingsApi = {
  getAllSettings: async (): Promise<SystemSetting[]> => {
    const response = await api.get('/settings/')
    return response
  },

  getGroupedSettings: async (): Promise<SystemSettingsGroup> => {
    const response = await api.get('/settings/grouped')
    return response
  },

  getSetting: async (settingKey: string): Promise<SystemSetting> => {
    const response = await api.get(`/settings/${settingKey}`)
    return response
  },

  updateSetting: async (settingKey: string, value: string, description?: string): Promise<SystemSetting> => {
    const response = await api.put(`/settings/${settingKey}`, {
      setting_value: value,
      description: description
    })
    return response
  },

  updateRequiredDaysOfInstruction: async (requiredDays: number): Promise<SystemSetting> => {
    const response = await api.put(`/settings/attendance/required-days?required_days=${requiredDays}`, {})
    return response
  }
}