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
import { X, Upload, AlertTriangle, CheckCircle } from 'lucide-react'

interface ImportAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (data: {
    assignment_data: any
    target_lesson_id?: number
    target_subject_id?: number
  }) => Promise<any>
  subjects: Array<{ id: number; name: string }>
  lessons: Array<{ id: number; title: string }>
}

export function ImportAssignmentModal({ 
  isOpen, 
  onClose, 
  onImport, 
  subjects,
  lessons 
}: ImportAssignmentModalProps) {
  const [step, setStep] = useState<'upload' | 'configure' | 'result'>('upload')
  const [isLoading, setIsLoading] = useState(false)
  const [assignmentData, setAssignmentData] = useState<any>(null)
  const [targetLessonId, setTargetLessonId] = useState<number | undefined>()
  const [targetSubjectId, setTargetSubjectId] = useState<number | undefined>()
  const [importResult, setImportResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        
        // Handle both single template and bulk export formats
        let templateData
        if (data.templates && Array.isArray(data.templates)) {
          // Bulk export format - just take the first template for now
          // TODO: Implement multi-template import
          templateData = data.templates[0]
        } else if (data.assignment_type && data.name) {
          // Single template export format
          templateData = data
        } else {
          throw new Error('Invalid assignment template format')
        }
        
        setAssignmentData(templateData)
        setError(null)
        setStep('configure')

        // Try to find matching subject
        const matchingSubject = subjects.find(s => 
          s.name.toLowerCase() === templateData.subject_name?.toLowerCase()
        )
        if (matchingSubject) {
          setTargetSubjectId(matchingSubject.id)
        }

      } catch (err) {
        setError('Failed to parse assignment file. Please ensure it\'s a valid assignment template export.')
      }
    }
    reader.readAsText(file)
  }

  const handleTextImport = (text: string) => {
    try {
      const data = JSON.parse(text)
      
      // Handle both single template and bulk export formats
      let templateData
      if (data.templates && Array.isArray(data.templates)) {
        templateData = data.templates[0]
      } else if (data.assignment_type && data.name) {
        templateData = data
      } else {
        throw new Error('Invalid assignment template format')
      }
      
      setAssignmentData(templateData)
      setError(null)
      setStep('configure')

      // Try to find matching subject
      const matchingSubject = subjects.find(s => 
        s.name.toLowerCase() === templateData.subject_name?.toLowerCase()
      )
      if (matchingSubject) {
        setTargetSubjectId(matchingSubject.id)
      }

    } catch (err) {
      setError('Failed to parse assignment data. Please ensure it\'s valid JSON.')
    }
  }

  const handleImport = async () => {
    if (!assignmentData) return

    setIsLoading(true)
    try {
      const result = await onImport({
        assignment_data: assignmentData,
        target_lesson_id: targetLessonId,
        target_subject_id: targetSubjectId
      })
      
      setImportResult(result)
      setStep('result')
    } catch (err: any) {
      setError(err.message || 'Import failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setStep('upload')
    setAssignmentData(null)
    setTargetLessonId(undefined)
    setTargetSubjectId(undefined)
    setImportResult(null)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Import Assignment Template</h2>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle size={16} className="text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div>
            <p className="text-gray-600 mb-4">
              Import an assignment template shared by another homeschool family
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Upload from file:</label>
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
                <label className="block text-sm font-medium mb-2">Paste assignment data:</label>
                <textarea
                  rows={6}
                  placeholder="Paste the assignment template export JSON data here..."
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm font-mono"
                  onChange={(e) => e.target.value && handleTextImport(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {step === 'configure' && assignmentData && (
          <div>
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Assignment Preview</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium">{assignmentData.name}</h4>
                {assignmentData.description && (
                  <p className="text-sm text-gray-600 mt-1">{assignmentData.description}</p>
                )}
                <div className="mt-2 text-sm text-gray-500 grid grid-cols-2 gap-2">
                  <div>Type: {assignmentData.assignment_type}</div>
                  <div>Subject: {assignmentData.subject_name}</div>
                  <div>Points: {assignmentData.max_points}</div>
                  {assignmentData.estimated_duration_minutes && (
                    <div>Duration: {assignmentData.estimated_duration_minutes}min</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Subject:
                </label>
                <select
                  value={targetSubjectId || ''}
                  onChange={(e) => setTargetSubjectId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                >
                  <option value="">Select or create subject</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {!targetSubjectId ? 
                    `Will create new subject "${assignmentData.subject_name}"` :
                    `Will use existing subject`
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Add to lesson (optional):
                </label>
                <select
                  value={targetLessonId || ''}
                  onChange={(e) => setTargetLessonId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="">Create as standalone template</option>
                  {lessons.map(lesson => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <Upload size={16} />
                <span>{isLoading ? 'Importing...' : 'Import Template'}</span>
              </button>
            </div>
          </div>
        )}

        {step === 'result' && importResult && (
          <div>
            <div className="text-center mb-4">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">Import Successful!</h3>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-green-800 mb-2">Import Summary:</h4>
              <div className="text-sm text-green-700 space-y-1">
                <div>{importResult.message}</div>
                <div>Template ID: {importResult.template_id}</div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}