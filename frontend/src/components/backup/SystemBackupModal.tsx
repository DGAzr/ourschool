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
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-panel border border-line rounded-card-lg shadow-xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Database className="h-4 w-4 text-accent" />
            <h2 className="text-[16px] font-semibold text-ink">Create System Backup</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-field text-muted hover:text-ink hover:bg-panel-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {error && (
            <div className="flex items-center gap-2 bg-neg-bg border border-neg-fg/20 rounded-card p-3 mb-4 text-[12px] text-neg-fg">
              <AlertTriangle size={13} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {!done ? (
            isLoading ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
                <p className="text-[13px] text-muted">Exporting all system data…</p>
              </div>
            ) : (
              <>
                <p className="text-[13px] text-muted mb-5">
                  Creates a complete backup of all users, subjects, assignments, grades, attendance, and system data.
                </p>
                <div className="flex items-start gap-2.5 bg-panel-2 border border-line rounded-card p-4 mb-5 text-[12px] text-muted">
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-500" />
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Backups exclude password hashes for security</li>
                    <li>Store the backup file in a secure location</li>
                    <li>Recommended: export weekly or before major changes</li>
                  </ul>
                </div>
                <button
                  onClick={handleExport}
                  className="w-full h-[36px] flex items-center justify-center gap-2 rounded-field text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity"
                >
                  <Download size={14} />
                  Create System Backup
                </button>
              </>
            )
          ) : (
            <div>
              <div className="flex flex-col items-center mb-5">
                <CheckCircle size={40} className="text-pos-fg mb-2" />
                <h3 className="text-[15px] font-semibold text-ink">Backup Created Successfully</h3>
              </div>
              {backupData?.system_info && (
                <div className="bg-panel-2 border border-line rounded-card p-4 mb-5 text-[12px] text-muted grid grid-cols-2 gap-1">
                  {Object.entries(backupData.system_info).map(([key, value]) => (
                    <div key={key}>{key.replace('total_', '').replace(/_/g, ' ')}: {value as number}</div>
                  ))}
                </div>
              )}
              <button
                onClick={downloadBackup}
                className="w-full h-[36px] flex items-center justify-center gap-2 rounded-field text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity"
              >
                <Download size={14} />
                Download Backup File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
