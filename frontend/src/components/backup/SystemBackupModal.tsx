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

import { useState } from 'react'
import { Download, AlertTriangle, CheckCircle, Database } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

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

  const getFooter = () => {
    if (!done) {
      return (
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>Cancel</Button>
          {!isLoading && (
            <Button variant="primary" onClick={handleExport}>
              <Download size={14} />
              Create System Backup
            </Button>
          )}
        </>
      )
    }
    return (
      <>
        <Button variant="secondary" onClick={handleClose}>Close</Button>
        <Button variant="primary" onClick={downloadBackup}>
          <Download size={14} />
          Download Backup File
        </Button>
      </>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create System Backup"
      icon={<Database size={15} />}
      iconVariant="accent"
      size="md"
      footer={getFooter()}
    >
      <div className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 bg-danger-soft border border-danger-line rounded-[11px] p-3 text-[12px] text-danger">
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
              <p className="text-[13px] text-muted">
                Creates a complete backup of all users, subjects, assignments, grades, attendance, and system data.
              </p>
              <div className="flex items-start gap-2.5 bg-warn-soft border border-warn-line rounded-[11px] p-4 text-[12px] text-muted">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-warn" />
                <ul className="space-y-1 list-disc list-inside">
                  <li>Backups exclude password hashes for security</li>
                  <li>Store the backup file in a secure location</li>
                  <li>Recommended: export weekly or before major changes</li>
                </ul>
              </div>
            </>
          )
        ) : (
          <>
            <div className="flex flex-col items-center">
              <CheckCircle size={40} className="text-pos-fg mb-2" />
              <h3 className="text-[15px] font-semibold text-ink">Backup Created Successfully</h3>
            </div>
            {backupData?.system_info && (
              <div className="bg-panel-2 border border-line rounded-[11px] p-4 text-[12px] text-muted grid grid-cols-2 gap-1">
                {Object.entries(backupData.system_info).map(([key, value]) => (
                  <div key={key}>{key.replace('total_', '').replace(/_/g, ' ')}: {value as number}</div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
