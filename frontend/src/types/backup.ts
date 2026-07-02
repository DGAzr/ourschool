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
 * System backup and restore types.
 * Mirrors app/schemas/backup.py (SystemBackup, SystemBackupImportRequest,
 * SystemBackupImportResult).
 */

/** Object counts summary the backend attaches to each backup (`system_info`). */
export type BackupSystemInfo = Record<string, number>

/**
 * A system backup file, as produced by GET /backup/export and re-uploaded for
 * POST /backup/import. The frontend only inspects the metadata fields; the
 * data tables are passed back to the server verbatim, so they are typed as
 * opaque record arrays rather than duplicating every backend row schema.
 * Tables are optional because uploaded files are only validated on metadata
 * before being sent to the server, which performs full validation.
 */
export interface SystemBackupFile {
  format_version: string
  backup_timestamp: string
  created_by: string
  system_info?: BackupSystemInfo
  users?: Record<string, unknown>[]
  subjects?: Record<string, unknown>[]
  terms?: Record<string, unknown>[]
  assignment_templates?: Record<string, unknown>[]
  term_subjects?: Record<string, unknown>[]
  student_assignments?: Record<string, unknown>[]
  student_term_grades?: Record<string, unknown>[]
  grade_history?: Record<string, unknown>[]
  attendance_records?: Record<string, unknown>[]
  journal_entries?: Record<string, unknown>[]
  student_points?: Record<string, unknown>[]
  point_transactions?: Record<string, unknown>[]
  system_settings?: Record<string, unknown>[]
}

/** Options accepted by POST /backup/import (`import_options`). */
export interface BackupImportOptions {
  skip_existing_users?: boolean
  update_existing_data?: boolean
  preserve_ids?: boolean
  dry_run?: boolean
}

/** Result of POST /backup/import (SystemBackupImportResult). */
export interface SystemBackupImportResult {
  success: boolean
  dry_run: boolean
  imported_counts: Record<string, number>
  skipped_counts: Record<string, number>
  updated_counts: Record<string, number>
  error_counts: Record<string, number>
  warnings: string[]
  errors: string[]
  import_log: string[]
  id_mappings: Record<string, Record<string, number>>
}
