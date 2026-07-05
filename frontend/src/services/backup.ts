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
import {
  BackupImportOptions,
  SystemBackupFile,
  SystemBackupImportResult
} from '../types'

/**
 * Type guard for data parsed from an uploaded backup file. Checks the
 * metadata the frontend relies on; the backend fully validates the rest.
 */
export const isSystemBackupFile = (value: unknown): value is SystemBackupFile => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.format_version === 'string' && typeof record.backup_timestamp === 'string'
}

export const backupApi = {
  // System backup export
  exportSystemBackup: (): Promise<SystemBackupFile> => api.get('/backup/export'),

  // System backup import
  importSystemBackup: (data: {
    backup_data: SystemBackupFile
    import_options?: BackupImportOptions
    wipe_confirmation?: string
  }): Promise<SystemBackupImportResult> => api.post('/backup/import', data),
}