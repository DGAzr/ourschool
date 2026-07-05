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
import { Download, Copy, Check } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { AssignmentTemplateExport, AssignmentTemplateBulkExport } from '../../types'

type ExportData = AssignmentTemplateExport | AssignmentTemplateBulkExport

const isBulkExport = (data: ExportData): data is AssignmentTemplateBulkExport =>
  'templates' in data

interface ExportAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  templateId: number
  templateName: string
  onExport: (templateId: number) => Promise<AssignmentTemplateExport>
  onBulkExport?: (templateIds: number[]) => Promise<AssignmentTemplateBulkExport>
  selectedTemplateIds?: number[]
  isBulkMode?: boolean
}

export function ExportAssignmentModal({
  isOpen,
  onClose,
  templateId,
  templateName,
  onExport,
  onBulkExport,
  selectedTemplateIds = [],
  isBulkMode = false
}: ExportAssignmentModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [exportData, setExportData] = useState<ExportData | null>(null)
  const [copied, setCopied] = useState(false)

  const handleExport = async () => {
    setIsLoading(true)
    try {
      let data
      if (isBulkMode && onBulkExport && selectedTemplateIds.length > 0) {
        data = await onBulkExport(selectedTemplateIds)
      } else {
        data = await onExport(templateId)
      }
      setExportData(data)
    } catch (error) {
      // Export failed
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = () => {
    if (!exportData) return

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    if (isBulkMode) {
      a.download = `assignment-templates-bulk-export.json`
    } else {
      a.download = `assignment-${templateName.replace(/\s+/g, '-').toLowerCase()}-export.json`
    }

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopyToClipboard = async () => {
    if (!exportData) return

    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Failed to copy to clipboard
    }
  }

  const handleClose = () => {
    setExportData(null)
    setCopied(false)
    onClose()
  }

  const getExportTitle = () =>
    isBulkMode ? `Export ${selectedTemplateIds.length} Assignment Templates` : 'Export Assignment Template'

  const getExportDescription = () =>
    isBulkMode
      ? `Export ${selectedTemplateIds.length} assignment templates to share with other homeschool families`
      : `Export "${templateName}" to share with other homeschool families`

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getExportTitle()}
      size="md"
      footer={
        !exportData ? (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" loading={isLoading} onClick={handleExport}>
              <Download size={14} />
              Export
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={handleCopyToClipboard}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
            <Button variant="primary" onClick={handleDownload}>
              <Download size={14} />
              Download File
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-[13px] text-muted mb-3">{getExportDescription()}</p>
          <div className="bg-accent/6 border border-accent/20 rounded-[11px] p-4">
            <p className="text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">What's included</p>
            <ul className="text-[12px] text-muted space-y-1">
              <li>• Assignment details (name, description, instructions)</li>
              <li>• Assignment type and difficulty level</li>
              <li>• Subject information</li>
              <li>• Grading and time estimates</li>
              <li>• Prerequisites and materials needed</li>
            </ul>
          </div>
        </div>

        {exportData && (
          <div className="bg-pos-bg border border-pos-fg/20 rounded-[11px] p-4">
            <p className="text-[11px] font-semibold text-pos-fg uppercase tracking-wide mb-2">Export Summary</p>
            <div className="text-[13px] text-pos-fg space-y-1">
              {isBulkExport(exportData) ? (
                <>
                  <div>Format: JSON v{exportData.format_version}</div>
                  <div>Templates: {exportData.templates?.length || 0}</div>
                  <div>Subjects: {exportData.metadata?.subjects?.join(', ') || 'Various'}</div>
                  <div>Exported: {new Date(exportData.export_timestamp).toLocaleString()}</div>
                </>
              ) : (
                <>
                  <div>Format: JSON v{exportData.export_metadata?.format_version}</div>
                  <div>Subject: {exportData.subject_name}</div>
                  <div>Type: {exportData.assignment_type}</div>
                  <div>Points: {exportData.max_points}</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
