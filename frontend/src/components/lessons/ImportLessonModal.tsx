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
import { X, Upload, Calendar, AlertTriangle, CheckCircle } from 'lucide-react'

interface ImportLessonModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (data: {
    lesson_export: any
    target_date?: string
    subject_mappings?: Record<string, number>
    create_missing_subjects?: boolean
  }) => Promise<any>
  subjects: Array<{ id: number; name: string }>
}

export function ImportLessonModal({ isOpen, onClose, onImport, subjects }: ImportLessonModalProps) {
  const [step, setStep] = useState<'upload' | 'configure' | 'result'>('upload')
  const [isLoading, setIsLoading] = useState(false)
  const [lessonData, setLessonData] = useState<any>(null)
  const [targetDate, setTargetDate] = useState('')
  const [createMissingSubjects, setCreateMissingSubjects] = useState(true)
  const [subjectMappings, setSubjectMappings] = useState<Record<string, number>>({})
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
        
        // Validate the data structure
        if (!data.lesson_data || !data.format_version) {
          throw new Error('Invalid lesson export format')
        }
        
        setLessonData(data)
        setError(null)
        setStep('configure')

        // Initialize subject mappings
        const mappings: Record<string, number> = {}
        data.lesson_data.subject_names?.forEach((subjectName: string) => {
          const existingSubject = subjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase())
          if (existingSubject) {
            mappings[subjectName] = existingSubject.id
          }
        })
        setSubjectMappings(mappings)

      } catch (err) {
        setError('Failed to parse lesson file. Please ensure it\'s a valid lesson export.')
      }
    }
    reader.readAsText(file)
  }

  const handleTextImport = (text: string) => {
    try {
      const data = JSON.parse(text)
      
      if (!data.lesson_data || !data.format_version) {
        throw new Error('Invalid lesson export format')
      }
      
      setLessonData(data)
      setError(null)
      setStep('configure')

      // Initialize subject mappings
      const mappings: Record<string, number> = {}
      data.lesson_data.subject_names?.forEach((subjectName: string) => {
        const existingSubject = subjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase())
        if (existingSubject) {
          mappings[subjectName] = existingSubject.id
        }
      })
      setSubjectMappings(mappings)

    } catch (err) {
      setError('Failed to parse lesson data. Please ensure it\'s valid JSON.')
    }
  }

  const handleImport = async () => {
    if (!lessonData) return

    setIsLoading(true)
    try {
      const result = await onImport({
        lesson_export: lessonData,
        target_date: targetDate || undefined,
        subject_mappings: subjectMappings,
        create_missing_subjects: createMissingSubjects
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
    setLessonData(null)
    setTargetDate('')
    setCreateMissingSubjects(true)
    setSubjectMappings({})
    setImportResult(null)
    setError(null)
    onClose()
  }

  const getMissingSubjects = () => {
    if (!lessonData?.lesson_data?.subject_names) return []
    return lessonData.lesson_data.subject_names.filter((name: string) => 
      !subjects.find(s => s.name.toLowerCase() === name.toLowerCase())
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Import Lesson</h2>
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
              Import a lesson shared by another homeschool family
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
                <label className="block text-sm font-medium mb-2">Paste lesson data:</label>
                <textarea
                  rows={6}
                  placeholder="Paste the lesson export JSON data here..."
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm font-mono"
                  onChange={(e) => e.target.value && handleTextImport(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {step === 'configure' && lessonData && (
          <div>
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Lesson Preview</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium">{lessonData.lesson_data.title}</h4>
                {lessonData.lesson_data.description && (
                  <p className="text-sm text-gray-600 mt-1">{lessonData.lesson_data.description}</p>
                )}
                <div className="mt-2 text-sm text-gray-500">
                  <div>Assignments: {lessonData.lesson_data.assignments?.length || 0}</div>
                  <div>Subjects: {lessonData.lesson_data.subject_names?.join(', ') || 'None'}</div>
                  <div>Exported by: {lessonData.exported_by}</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Calendar size={16} className="inline mr-1" />
                  Schedule for date (optional):
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If not specified, will use today's date
                </p>
              </div>

              {lessonData.lesson_data.subject_names?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Subject Mapping:</label>
                  {lessonData.lesson_data.subject_names.map((subjectName: string) => {
                    const existingSubject = subjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase())
                    return (
                      <div key={subjectName} className="flex items-center space-x-2 mb-2">
                        <span className="text-sm w-32">{subjectName}:</span>
                        <select
                          value={subjectMappings[subjectName] || ''}
                          onChange={(e) => setSubjectMappings(prev => ({
                            ...prev,
                            [subjectName]: e.target.value ? Number(e.target.value) : undefined
                          } as any))}
                          className="flex-1 p-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">
                            {existingSubject ? 'Auto-detected' : 'Create new subject'}
                          </option>
                          {subjects.map(subject => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}

              {getMissingSubjects().length > 0 && (
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={createMissingSubjects}
                      onChange={(e) => setCreateMissingSubjects(e.target.checked)}
                    />
                    <span className="text-sm">
                      Automatically create missing subjects: {getMissingSubjects().join(', ')}
                    </span>
                  </label>
                </div>
              )}
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
                <span>{isLoading ? 'Importing...' : 'Import Lesson'}</span>
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
                <div>Created lesson: {importResult.created_lesson?.title}</div>
                <div>Created assignments: {importResult.created_assignments?.length || 0}</div>
                <div>Created subjects: {importResult.created_subjects?.length || 0}</div>
              </div>
            </div>

            {importResult.warnings?.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-yellow-800 mb-2">Warnings:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {importResult.warnings.map((warning: string, index: number) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

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