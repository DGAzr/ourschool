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

import React, { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { SystemBackupModal } from '../components/backup/SystemBackupModal'
import { backupApi } from '../services/backup'
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
  const [importData, setImportData] = useState<any>(null)
  const [importOptions, setImportOptions] = useState({
    skip_existing_users: true,
    update_existing_data: false,
    preserve_ids: false,
    dry_run: true,
  })
  const [importResult, setImportResult] = useState<any>(null)
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
        const data = JSON.parse(e.target?.result as string)
        if (!data.format_version || !data.backup_timestamp) throw new Error('Invalid backup format')
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
    } catch (err: any) {
      setImportError(err.message || 'Import failed')
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
      <div className="text-center py-12">
        <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Only administrators can access backup functionality.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-600 to-gray-800 rounded-lg shadow-lg">
        <div className="px-6 py-8">
          <div className="flex items-center">
            <HardDrive className="h-8 w-8 text-white mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-white">System Backup & Recovery</h1>
              <p className="text-gray-100 text-lg mt-1">Manage system data exports and imports</p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Notice */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Important Backup Information</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Always ensure you have recent backups before making significant changes to the system.
              Backup files contain sensitive data and should be stored securely.
            </p>
          </div>
        </div>
      </div>

      {/* Backup Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-green-500 p-3 rounded-lg">
                <Download className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Export System Data</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Create a complete backup of all system data</p>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Info className="h-4 w-4 mr-2" />
                Includes all users, students, subjects, terms, and assignments
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Info className="h-4 w-4 mr-2" />
                Export format: JSON with full data integrity
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Info className="h-4 w-4 mr-2" />
                Recommended frequency: Weekly or before major updates
              </div>
            </div>
            <button
              onClick={() => setShowBackupModal(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Create System Backup
            </button>
          </div>
        </div>

        {/* Import */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-blue-500 p-3 rounded-lg">
                <Upload className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import System Data</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Restore from a previous backup file</p>
              </div>
            </div>

            {importStep === 'idle' && (
              <>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    <strong>Warning:</strong>&nbsp;This will merge data into the existing system
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Info className="h-4 w-4 mr-2" />
                    Only import backup files from this system
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Info className="h-4 w-4 mr-2" />
                    Use Dry Run to preview changes before applying
                  </div>
                </div>
                {importError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                    {importError}
                  </div>
                )}
                <label className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 cursor-pointer flex items-center justify-center">
                  <Upload className="h-4 w-4 mr-2" />
                  Select Backup File
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </>
            )}

            {importStep === 'configure' && importData && (
              <>
                {/* Backup preview */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4 text-sm">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                      <Users size={13} /><span>{importData.system_info?.total_users || 0} Users</span>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                      <FileText size={13} /><span>{importData.system_info?.total_subjects || 0} Subjects</span>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                      <Database size={13} /><span>{importData.system_info?.total_assignment_templates || 0} Templates</span>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                      <Clock size={13} /><span>{new Date(importData.backup_timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Created by: {importData.created_by}</div>
                </div>

                {/* Options */}
                <div className="space-y-2 mb-4 text-sm">
                  {[
                    { id: 'dry_run', label: 'Dry Run (preview only)', key: 'dry_run' as const },
                    { id: 'skip_users', label: 'Skip existing users (recommended)', key: 'skip_existing_users' as const },
                    { id: 'update_existing', label: 'Update existing data', key: 'update_existing_data' as const },
                  ].map(({ id, label, key }) => (
                    <label key={id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importOptions[key]}
                        onChange={(e) => setImportOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <span className="text-gray-700 dark:text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={resetImport}
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={performImport}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {importOptions.dry_run ? 'Preview Import' : 'Import Data'}
                  </button>
                </div>
              </>
            )}

            {importStep === 'loading' && (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {importOptions.dry_run ? 'Previewing import...' : 'Importing data...'}
                </p>
              </div>
            )}

            {importStep === 'result' && (
              <>
                {importError ? (
                  <div className="text-center py-4">
                    <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-2" />
                    <p className="font-medium text-red-700 dark:text-red-400">Import Failed</p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{importError}</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center mb-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {importResult?.dry_run ? 'Preview Complete' : 'Import Successful'}
                      </span>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm text-green-700 dark:text-green-300 mb-3 grid grid-cols-2 gap-1">
                      {importResult?.imported_counts && Object.entries(importResult.imported_counts).map(([k, v]) => (
                        <div key={k}>{importResult.dry_run ? 'Would import' : 'Imported'} {k}: {v as number}</div>
                      ))}
                    </div>
                    {importResult?.warnings?.length > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                        {importResult.warnings.slice(0, 3).map((w: string, i: number) => <div key={i}>• {w}</div>)}
                        {importResult.warnings.length > 3 && <div>…and {importResult.warnings.length - 3} more</div>}
                      </div>
                    )}
                  </div>
                )}
                {importResult?.dry_run && !importError ? (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={resetImport}
                      className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setImportOptions(prev => ({ ...prev, dry_run: false }))
                        setImportStep('configure')
                        setImportResult(null)
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      Import for Real
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={resetImport}
                    className="w-full mt-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    Done
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Backup History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Backup Activity</h3>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Backup history tracking will be implemented in a future update.</p>
            <p className="text-sm mt-2">For now, please keep track of your backup files manually.</p>
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
