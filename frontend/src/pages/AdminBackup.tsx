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

import { getErrorMessage } from '../services/api'
import React, { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { SystemBackupModal } from '../components/backup/SystemBackupModal'
import { backupApi, isSystemBackupFile } from '../services/backup'
import { SystemBackupFile, SystemBackupImportResult } from '../types'
import { Button, EmptyState, Spinner } from '../components/ui'
import {
  HardDrive,
  Download,
  Upload,
  Shield,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  Users,
  FileText,
  Database,
} from 'lucide-react'

const AdminBackup: React.FC = () => {
  const { user } = useAuth()
  const [showBackupModal, setShowBackupModal] = useState(false)

  // Import state
  const [importStep, setImportStep] = useState<'idle' | 'configure' | 'loading' | 'result'>('idle')
  const [importData, setImportData] = useState<SystemBackupFile | null>(null)
  const [importOptions, setImportOptions] = useState({
    skip_existing_users: true,
    update_existing_data: false,
    preserve_ids: false,
    dry_run: true,
  })
  const [importResult, setImportResult] = useState<SystemBackupImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    return await backupApi.exportSystemBackup()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data: unknown = JSON.parse(e.target?.result as string)
        if (!isSystemBackupFile(data)) throw new Error('Invalid backup format')
        setImportData(data)
        setImportError(null)
        setImportStep('configure')
      } catch {
        setImportError('Failed to parse backup file. Please ensure it\'s a valid system backup.')
      }
    }
    reader.readAsText(file)
  }

  const performImport = async () => {
    if (!importData) return
    setImportStep('loading')
    setImportError(null)
    try {
      const result = await backupApi.importSystemBackup({ backup_data: importData, import_options: importOptions })
      setImportResult(result)
      setImportStep('result')
    } catch (err) {
      setImportError(getErrorMessage(err, 'Import failed'))
      setImportStep('result')
    }
  }

  const resetImport = () => {
    setImportStep('idle')
    setImportData(null)
    setImportResult(null)
    setImportError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-24 text-center">
        <div>
          <Shield size={40} className="text-neg-fg mx-auto mb-3" />
          <h2 className="text-[18px] font-semibold text-ink">Access Denied</h2>
          <p className="text-[13px] text-muted mt-1">Only administrators can access backup functionality.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-0.5">Admin</p>
        <h1 className="text-[26px] font-semibold text-ink tracking-[-0.02em]">System Backup &amp; Recovery</h1>
        <p className="mt-1 text-[13px] text-muted">Manage system data exports and imports</p>
      </div>

      {/* Warning Notice */}
      <div className="bg-warn-soft border border-warn-line rounded-card p-4">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-warn mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-[13px] font-semibold text-warn">Important Backup Information</h3>
            <p className="text-[13px] text-warn mt-1">
              Always ensure you have recent backups before making significant changes to the system.
              Backup files contain sensitive data and should be stored securely.
            </p>
          </div>
        </div>
      </div>

      {/* Backup Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export */}
        <div className="bg-panel border border-line rounded-card shadow-card">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-pos-bg p-3 rounded-field">
                <Download className="h-5 w-5 text-pos-fg" />
              </div>
              <div className="ml-4">
                <h3 className="text-[15px] font-semibold text-ink">Export System Data</h3>
                <p className="text-[13px] text-muted">Create a complete backup of all system data</p>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex items-center text-[13px] text-muted">
                <Info className="h-4 w-4 mr-2 flex-shrink-0 text-faint" />
                Includes all users, students, subjects, terms, and assignments
              </div>
              <div className="flex items-center text-[13px] text-muted">
                <Info className="h-4 w-4 mr-2 flex-shrink-0 text-faint" />
                Export format: JSON with full data integrity
              </div>
              <div className="flex items-center text-[13px] text-muted">
                <Info className="h-4 w-4 mr-2 flex-shrink-0 text-faint" />
                Recommended frequency: Weekly or before major updates
              </div>
            </div>
            <Button fullWidth onClick={() => setShowBackupModal(true)}>
              Create System Backup
            </Button>
          </div>
        </div>

        {/* Import */}
        <div className="bg-panel border border-line rounded-card shadow-card">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-info-bg p-3 rounded-field">
                <Upload className="h-5 w-5 text-info-fg" />
              </div>
              <div className="ml-4">
                <h3 className="text-[15px] font-semibold text-ink">Import System Data</h3>
                <p className="text-[13px] text-muted">Restore from a previous backup file</p>
              </div>
            </div>

            {importStep === 'idle' && (
              <>
                {importError && (
                  <div className="mb-4 px-3 py-2.5 bg-neg-bg border border-neg-fg/20 rounded-card text-[13px] text-neg-fg">
                    {importError}
                  </div>
                )}
                <EmptyState
                  size="sm"
                  icon={Upload}
                  title="No backup file selected"
                  subtext="Choose a backup JSON exported from this system. Use Dry Run to preview changes before applying them."
                  action={
                    <label className="bg-btn-primary-bg text-btn-primary-fg text-[13px] font-semibold py-2 px-4 rounded-field hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2">
                      <Upload className="h-4 w-4" />
                      Select Backup File
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  }
                />
              </>
            )}

            {importStep === 'configure' && importData && (
              <>
                {/* Backup preview */}
                <div className="bg-panel-2 border border-line rounded-card p-3 mb-4 text-[13px]">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="flex items-center gap-1.5 text-muted">
                      <Users size={13} /><span>{importData.system_info?.total_users || 0} Users</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted">
                      <FileText size={13} /><span>{importData.system_info?.total_subjects || 0} Subjects</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted">
                      <Database size={13} /><span>{importData.system_info?.total_assignment_templates || 0} Templates</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted">
                      <Clock size={13} /><span>{new Date(importData.backup_timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-[12px] text-faint">Created by: {importData.created_by}</div>
                </div>

                {/* Options */}
                <div className="space-y-2 mb-4 text-[13px]">
                  {[
                    { id: 'dry_run', label: 'Dry Run (preview only)', key: 'dry_run' as const },
                    { id: 'skip_users', label: 'Skip existing users (recommended)', key: 'skip_existing_users' as const },
                    { id: 'update_existing', label: 'Update existing data', key: 'update_existing_data' as const },
                  ].map(({ id, label, key }) => (
                    <label key={id} htmlFor={id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        id={id}
                        type="checkbox"
                        checked={importOptions[key]}
                        onChange={(e) => setImportOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-check-border accent-accent"
                      />
                      <span className="text-ink-2">{label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={resetImport}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={performImport}>
                    {importOptions.dry_run ? 'Preview Import' : 'Import Data'}
                  </Button>
                </div>
              </>
            )}

            {importStep === 'loading' && (
              <div className="text-center py-6">
                <Spinner size="md" className="mx-auto mb-3" />
                <p className="text-[13px] text-muted">
                  {importOptions.dry_run ? 'Previewing import...' : 'Importing data...'}
                </p>
              </div>
            )}

            {importStep === 'result' && (
              <>
                {importError ? (
                  <div className="text-center py-4">
                    <AlertTriangle className="h-10 w-10 text-neg-fg mx-auto mb-2" />
                    <p className="font-semibold text-neg-fg">Import Failed</p>
                    <p className="text-[13px] text-neg-fg mt-1">{importError}</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center mb-3">
                      <CheckCircle className="h-5 w-5 text-pos-fg mr-2" />
                      <span className="font-semibold text-ink">
                        {importResult?.dry_run ? 'Preview Complete' : 'Import Successful'}
                      </span>
                    </div>
                    <div className="bg-pos-bg rounded-card p-3 text-[13px] text-pos-fg mb-3 grid grid-cols-2 gap-1">
                      {importResult?.imported_counts && Object.entries(importResult.imported_counts).map(([k, v]) => (
                        <div key={k}>{importResult.dry_run ? 'Would import' : 'Imported'} {k}: {v}</div>
                      ))}
                    </div>
                    {importResult && importResult.warnings.length > 0 && (
                      <div className="bg-warn-soft border border-warn-line rounded-card p-3 text-[12px] text-warn mb-3">
                        {importResult.warnings.slice(0, 3).map((w: string, i: number) => <div key={i}>• {w}</div>)}
                        {importResult.warnings.length > 3 && <div>…and {importResult.warnings.length - 3} more</div>}
                      </div>
                    )}
                  </div>
                )}
                {importResult?.dry_run && !importError ? (
                  <div className="flex gap-2 mt-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={resetImport}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setImportOptions(prev => ({ ...prev, dry_run: false }))
                        setImportStep('configure')
                        setImportResult(null)
                      }}
                    >
                      Import for Real
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" fullWidth className="mt-2" onClick={resetImport}>
                    Done
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Backup History */}
      <div className="bg-panel border border-line rounded-card shadow-card">
        <div className="p-6">
          <h3 className="text-[15px] font-semibold text-ink mb-4">Recent Backup Activity</h3>
          <div className="text-center py-8 text-muted">
            <HardDrive className="h-12 w-12 mx-auto mb-4 text-faint" />
            <p className="text-[13px]">Backup history tracking will be implemented in a future update.</p>
            <p className="text-[12.5px] text-faint mt-2">For now, please keep track of your backup files manually.</p>
          </div>
        </div>
      </div>

      {/* Export Modal (export only) */}
      {showBackupModal && (
        <SystemBackupModal
          isOpen={showBackupModal}
          onClose={() => setShowBackupModal(false)}
          onExport={handleExport}
        />
      )}
    </div>
  )
}

export default AdminBackup
