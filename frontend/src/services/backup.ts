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

export const backupApi = {
  // System backup export
  exportSystemBackup: () => api.get('/backup/export'),
  
  // System backup import
  importSystemBackup: (data: {
    backup_data: any
    import_options?: {
      skip_existing_users?: boolean
      update_existing_data?: boolean
      preserve_ids?: boolean
      dry_run?: boolean
    }
  }) => api.post('/backup/import', data),
}

// Utility functions for backup handling
export const backupUtils = {
  downloadBackup: (backupData: any, filename?: string) => {
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `ourschool-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  },

  validateBackupData: (data: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    if (!data) {
      errors.push('Backup data is empty')
      return { valid: false, errors }
    }

    if (!data.format_version) {
      errors.push('Missing format version')
    }

    if (!data.backup_timestamp) {
      errors.push('Missing backup timestamp')
    }

    if (!data.users || !Array.isArray(data.users)) {
      errors.push('Invalid or missing users data')
    }

    if (!data.subjects || !Array.isArray(data.subjects)) {
      errors.push('Invalid or missing subjects data')
    }

    return { valid: errors.length === 0, errors }
  }
}