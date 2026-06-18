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

import { useState, useEffect } from 'react'
import { X, Download, AlertTriangle, CheckCircle, Database } from 'lucide-react'

interface SystemBackupModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: () => Promise<any>
}

export function SystemBackupModal({ isOpen, onClose, onExport }: SystemBackupModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [backupData, setBackupData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleExport = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await onExport()
      setBackupData(data)
      setDone(true)
    } catch (err: any) {
      setError(err.message || 'Export failed')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadBackup = () => {
    if (!backupData) return
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ourschool-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleClose = () => {
    setIsLoading(false)
    setBackupData(null)
    setError(null)
    setDone(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Database className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create System Backup</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
              <AlertTriangle size={16} className="text-red-600" />
              <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          {!done ? (
            <>
              {isLoading ? (
                <div className="text-center py-10">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Exporting all system data...</p>
                </div>
              ) : (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Creates a complete backup of all users, subjects, assignments, grades, attendance, and system data.
                  </p>
                  <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                      <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
                        <li>Backups exclude password hashes for security</li>
                        <li>Store the backup file in a secure location</li>
                        <li>Recommended: export weekly or before major changes</li>
                      </ul>
                    </div>
                  </div>
                  <button
                    onClick={handleExport}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download size={16} />
                    <span>Create System Backup</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <div>
              <div className="text-center mb-4">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Backup Created Successfully!</h3>
              </div>
              {backupData?.system_info && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2 text-sm">Backup Summary:</h4>
                  <div className="grid grid-cols-2 gap-1 text-sm text-green-700 dark:text-green-300">
                    {Object.entries(backupData.system_info).map(([key, value]) => (
                      <div key={key}>{key.replace('total_', '').replace(/_/g, ' ')}: {value as number}</div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={downloadBackup}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <Download size={16} />
                <span>Download Backup File</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
