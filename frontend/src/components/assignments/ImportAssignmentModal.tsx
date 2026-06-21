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

import { useState, useRef } from 'react'
import { Upload, AlertTriangle, CheckCircle } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)

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

  const getFooter = () => {
    if (step === 'upload') {
      return <Button variant="secondary" onClick={handleClose}>Cancel</Button>
    }
    if (step === 'configure') {
      return (
        <>
          <Button variant="secondary" onClick={() => setStep('upload')}>Back</Button>
          <Button variant="primary" loading={isLoading} onClick={handleImport}>
            <Upload size={14} />
            Import Template
          </Button>
        </>
      )
    }
    return (
      <Button variant="primary" onClick={handleClose}>Done</Button>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Assignment Template"
      size="md"
      footer={getFooter()}
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 bg-danger-soft border border-danger-line rounded-field flex items-center gap-2">
            <AlertTriangle size={14} className="text-danger flex-none" />
            <p className="text-[13px] text-danger">{error}</p>
          </div>
        )}

        {step === 'upload' && (
          <>
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
          </>
        )}

        {step === 'configure' && assignmentData && (
          <>
            <div>
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Assignment Preview</p>
              <div className="bg-panel-2 border border-line rounded-[11px] p-4">
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
          </>
        )}

        {step === 'result' && importResult && (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle size={40} className="text-pos-fg mx-auto mb-2" />
              <h3 className="text-[15px] font-semibold text-ink">Import Successful!</h3>
            </div>
            <div className="bg-pos-bg border border-pos-fg/20 rounded-[11px] p-4">
              <p className="text-[11px] font-semibold text-pos-fg uppercase tracking-wide mb-2">Import Summary</p>
              <div className="text-[13px] text-pos-fg space-y-1">
                <div>{importResult.message}</div>
                <div>Template ID: {importResult.template_id}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
