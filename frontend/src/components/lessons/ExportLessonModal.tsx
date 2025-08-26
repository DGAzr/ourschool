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
import { X, Download, Copy, Check } from 'lucide-react'

interface ExportLessonModalProps {
  isOpen: boolean
  onClose: () => void
  lessonId: number
  lessonTitle: string
  onExport: (lessonId: number) => Promise<any>
}

export function ExportLessonModal({ isOpen, onClose, lessonId, lessonTitle, onExport }: ExportLessonModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [exportData, setExportData] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  // ESC key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleExport = async () => {
    setIsLoading(true)
    try {
      const data = await onExport(lessonId)
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
    a.download = `lesson-${lessonTitle.replace(/\s+/g, '-').toLowerCase()}-export.json`
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Export Lesson</h2>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-600 mb-2">
            Export "{lessonTitle}" to share with other homeschool families
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">What's included:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Lesson details (title, description, objectives, materials)</li>
              <li>• All assignment templates within the lesson</li>
              <li>• Subject information</li>
              <li>• Difficulty levels and duration estimates</li>
            </ul>
          </div>
        </div>

        {!exportData ? (
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              <Download size={16} />
              <span>{isLoading ? 'Exporting...' : 'Export Lesson'}</span>
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Export Complete!</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your lesson has been exported successfully. You can download the file or copy the data to share.
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-sm mb-2">Export Summary:</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Format: JSON v{exportData.format_version}</div>
                  <div>Assignments: {exportData.lesson_data.assignments.length}</div>
                  <div>Subjects: {exportData.lesson_data.subject_names.join(', ')}</div>
                  <div>Exported: {new Date(exportData.export_timestamp).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCopyToClipboard}
                className="px-4 py-2 text-blue-600 border border-blue-300 rounded hover:bg-blue-50 flex items-center space-x-2"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-2"
              >
                <Download size={16} />
                <span>Download File</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}