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
    target_subject_id?: number
  }) => Promise<any>
  subjects: Array<{ id: number; name: string }>
}

export function ImportAssignmentModal({
  isOpen,
  onClose,
  onImport,
  subjects,
}: ImportAssignmentModalProps) {
  const [step, setStep] = useState<'upload' | 'configure' | 'result'>('upload')
  const [isLoading, setIsLoading] = useState(false)
  const [assignmentData, setAssignmentData] = useState<any>(null)
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
    setTargetSubjectId(undefined)
    setImportResult(null)
    setError(null)
    onClose()
  }

  const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-full'
  const LABEL = 'block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5'

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-panel border border-line rounded-card-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b border-line">
          <h2 className="text-[15px] font-semibold text-ink">Import Assignment Template</h2>
          <button onClick={handleClose} className="p-1.5 rounded-field text-faint hover:text-ink hover:bg-panel-2 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5">
          {error && (
            <div className="mb-5 p-3 bg-neg-bg border border-neg-fg/20 rounded-field flex items-center gap-2">
              <AlertTriangle size={14} className="text-neg-fg flex-none" />
              <p className="text-[13px] text-neg-fg">{error}</p>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-5">
              <p className="text-[13px] text-muted">Import an assignment template shared by another homeschool family.</p>
              <div>
                <label className={LABEL}>Upload from file</label>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload}
                  className="block w-full text-[13px] text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-field file:border file:border-btn-border file:text-[12px] file:font-medium file:bg-panel file:text-ink hover:file:bg-track" />
              </div>
              <div className="text-center text-[12px] text-faintest">— or —</div>
              <div>
                <label className={LABEL}>Paste assignment data</label>
                <textarea rows={6} placeholder="Paste the assignment template export JSON data here..."
                  className={`${FIELD} font-mono text-[12px]`}
                  onChange={(e) => e.target.value && handleTextImport(e.target.value)} />
              </div>
            </div>
          )}

          {step === 'configure' && assignmentData && (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Assignment Preview</p>
                <div className="bg-panel-2 border border-line rounded-field p-4">
                  <p className="text-[14px] font-semibold text-ink">{assignmentData.name}</p>
                  {assignmentData.description && <p className="text-[13px] text-muted mt-1">{assignmentData.description}</p>}
                  <div className="mt-2 text-[12px] text-muted grid grid-cols-2 gap-1.5">
                    <div>Type: {assignmentData.assignment_type}</div>
                    <div>Subject: {assignmentData.subject_name}</div>
                    <div>Points: {assignmentData.max_points}</div>
                    {assignmentData.estimated_duration_minutes && <div>Duration: {assignmentData.estimated_duration_minutes}min</div>}
                  </div>
                </div>
              </div>
              <div>
                <label className={LABEL}>Subject</label>
                <select value={targetSubjectId || ''} onChange={(e) => setTargetSubjectId(e.target.value ? Number(e.target.value) : undefined)} className={FIELD} required>
                  <option value="">Select or create subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <p className="text-[11px] text-faint mt-1">
                  {!targetSubjectId ? `Will create new subject "${assignmentData.subject_name}"` : 'Will use existing subject'}
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setStep('upload')} className="px-4 py-2 text-[13px] font-medium text-ink border border-btn-border bg-panel rounded-field hover:bg-track">
                  Back
                </button>
                <button onClick={handleImport} disabled={isLoading}
                  className="px-4 py-2 text-[13px] font-semibold bg-pos-bg text-pos-fg border border-pos-fg/20 rounded-field hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                  <Upload size={14} />
                  {isLoading ? 'Importing…' : 'Import Template'}
                </button>
              </div>
            </div>
          )}

          {step === 'result' && importResult && (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle size={40} className="text-pos-fg mx-auto mb-2" />
                <h3 className="text-[15px] font-semibold text-ink">Import Successful!</h3>
              </div>
              <div className="bg-pos-bg border border-pos-fg/20 rounded-field p-4">
                <p className="text-[11px] font-semibold text-pos-fg uppercase tracking-wide mb-2">Import Summary</p>
                <div className="text-[13px] text-pos-fg space-y-1">
                  <div>{importResult.message}</div>
                  <div>Template ID: {importResult.template_id}</div>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleClose} className="px-4 py-2 text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg rounded-field hover:opacity-90">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}