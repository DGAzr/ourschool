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

import { useState, useRef, useEffect } from 'react'
import { X, Download, Upload, AlertTriangle, CheckCircle, Database, Clock, Users, FileText } from 'lucide-react'

interface SystemBackupModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: () => Promise<any>
  onImport: (data: {
    backup_data: any
    import_options?: {
      skip_existing_users?: boolean
      update_existing_data?: boolean
      preserve_ids?: boolean
      dry_run?: boolean
    }
  }) => Promise<any>
}

type ModalStep = 'main' | 'export' | 'import' | 'import-configure' | 'result'

export function SystemBackupModal({ isOpen, onClose, onExport, onImport }: SystemBackupModalProps) {
  const [step, setStep] = useState<ModalStep>('main')
  const [isLoading, setIsLoading] = useState(false)
  const [backupData, setBackupData] = useState<any>(null)
  const [importData, setImportData] = useState<any>(null)
  const [importOptions, setImportOptions] = useState({
    skip_existing_users: true,
    update_existing_data: false,
    preserve_ids: false,
    dry_run: true
  })
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ESC key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleExport = async () => {
    setStep('export')
    setIsLoading(true)
    setError(null)
    
    try {
      const data = await onExport()
      setBackupData(data)
      setResult({ type: 'export', data })
      setStep('result')
    } catch (err: any) {
      setError(err.message || 'Export failed')
      setStep('result')
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = () => {
    setStep('import')
    setError(null)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        
        // Validate backup data structure
        if (!data.format_version || !data.backup_timestamp) {
          throw new Error('Invalid backup format')
        }
        
        setImportData(data)
        setError(null)
        setStep('import-configure')
      } catch (err) {
        setError('Failed to parse backup file. Please ensure it\'s a valid system backup.')
      }
    }
    reader.readAsText(file)
  }

  const handleTextImport = (text: string) => {
    try {
      const data = JSON.parse(text)
      
      if (!data.format_version || !data.backup_timestamp) {
        throw new Error('Invalid backup format')
      }
      
      setImportData(data)
      setError(null)
      setStep('import-configure')
    } catch (err) {
      setError('Failed to parse backup data. Please ensure it\'s valid JSON.')
    }
  }

  const performImport = async () => {
    if (!importData) return

    setIsLoading(true)
    try {
      const result = await onImport({
        backup_data: importData,
        import_options: importOptions
      })
      
      setResult({ type: 'import', data: result })
      setStep('result')
    } catch (err: any) {
      setError(err.message || 'Import failed')
      setStep('result')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadBackup = () => {
    if (!backupData) return

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ourschool-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetModal = () => {
    setStep('main')
    setBackupData(null)
    setImportData(null)
    setResult(null)
    setError(null)
    setIsLoading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center space-x-2">
            <Database className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold">System Backup & Restore</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle size={16} className="text-red-600" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Main Menu */}
          {step === 'main' && (
            <div>
              <p className="text-gray-600 mb-6">
                Create complete system backups for data protection and migration, or restore from existing backups.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Option */}
                <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Download className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Create Backup</h3>
                      <p className="text-sm text-gray-600">Export all system data</p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4 text-sm">
                    Creates a complete backup of all users, lessons, assignments, grades, attendance, and system data.
                  </p>
                  <button
                    onClick={handleExport}
                    disabled={isLoading}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Creating Backup...' : 'Create System Backup'}
                  </button>
                </div>

                {/* Import Option */}
                <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Upload className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Restore Backup</h3>
                      <p className="text-sm text-gray-600">Import system data</p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4 text-sm">
                    Restore from a previous backup with smart conflict resolution to avoid duplicating existing data.
                  </p>
                  <button
                    onClick={handleImport}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Restore from Backup
                  </button>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle size={16} className="text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-yellow-800">Important Notes:</p>
                    <ul className="list-disc list-inside text-yellow-700 mt-1 space-y-1">
                      <li>Backups exclude password hashes for security</li>
                      <li>Imported users will need to reset their passwords</li>
                      <li>Always test imports with "Dry Run" first</li>
                      <li>Keep regular backups in a secure location</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Export Progress */}
          {step === 'export' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Creating System Backup</h3>
              <p className="text-gray-600">Exporting all system data...</p>
            </div>
          )}

          {/* Import File Selection */}
          {step === 'import' && (
            <div>
              <h3 className="font-semibold text-lg mb-4">Select Backup File</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Upload backup file:</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div className="text-center text-gray-500">or</div>

                <div>
                  <label className="block text-sm font-medium mb-2">Paste backup data:</label>
                  <textarea
                    rows={8}
                    placeholder="Paste the system backup JSON data here..."
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm font-mono"
                    onChange={(e) => e.target.value && handleTextImport(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setStep('main')}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Import Configuration */}
          {step === 'import-configure' && importData && (
            <div>
              <h3 className="font-semibold text-lg mb-4">Configure Import</h3>
              
              {/* Backup Preview */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium mb-2">Backup Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Users size={16} className="text-blue-600" />
                    <span>{importData.system_info?.total_users || 0} Users</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FileText size={16} className="text-green-600" />
                    <span>{importData.system_info?.total_lessons || 0} Lessons</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Database size={16} className="text-purple-600" />
                    <span>{importData.system_info?.total_assignment_templates || 0} Templates</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock size={16} className="text-orange-600" />
                    <span>{new Date(importData.backup_timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Created by: {importData.created_by}
                </div>
              </div>

              {/* Import Options */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="dry-run"
                    checked={importOptions.dry_run}
                    onChange={(e) => setImportOptions(prev => ({ ...prev, dry_run: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="dry-run" className="text-sm font-medium">
                    Dry Run (preview changes without applying them)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="skip-users"
                    checked={importOptions.skip_existing_users}
                    onChange={(e) => setImportOptions(prev => ({ ...prev, skip_existing_users: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="skip-users" className="text-sm font-medium">
                    Skip existing users (recommended)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="update-existing"
                    checked={importOptions.update_existing_data}
                    onChange={(e) => setImportOptions(prev => ({ ...prev, update_existing_data: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="update-existing" className="text-sm font-medium">
                    Update existing data (use with caution)
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setStep('import')}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={performImport}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : importOptions.dry_run ? 'Preview Import' : 'Import Data'}
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {step === 'result' && (
            <div>
              {result?.type === 'export' && !error ? (
                <div>
                  <div className="text-center mb-4">
                    <CheckCircle size={48} className="text-green-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold">Backup Created Successfully!</h3>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-green-800 mb-2">Backup Summary:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                      {backupData?.system_info && Object.entries(backupData.system_info).map(([key, value]) => (
                        <div key={key}>
                          {key.replace('total_', '').replace('_', ' ')}: {value as number}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={downloadBackup}
                      className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-2"
                    >
                      <Download size={16} />
                      <span>Download Backup File</span>
                    </button>
                  </div>
                </div>
              ) : result?.type === 'import' && !error ? (
                <div>
                  <div className="text-center mb-4">
                    <CheckCircle size={48} className="text-green-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold">
                      {result.data.dry_run ? 'Import Preview Complete!' : 'Import Successful!'}
                    </h3>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-green-800 mb-2">Import Summary:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                      {result.data.imported_counts && Object.entries(result.data.imported_counts).map(([key, value]) => (
                        <div key={key}>
                          {result.data.dry_run ? 'Would import' : 'Imported'} {key}: {value as number}
                        </div>
                      ))}
                      {result.data.skipped_counts && Object.entries(result.data.skipped_counts).map(([key, value]) => (
                        <div key={key}>
                          Skipped {key}: {value as number}
                        </div>
                      ))}
                    </div>
                  </div>

                  {result.data.warnings && result.data.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-yellow-800 mb-2">Warnings:</h4>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        {result.data.warnings.map((warning: string, index: number) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <AlertTriangle size={48} className="text-red-500 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold text-red-800">Operation Failed</h3>
                  <p className="text-red-600 mt-2">{error}</p>
                </div>
              )}

              <div className="flex justify-center mt-6">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}