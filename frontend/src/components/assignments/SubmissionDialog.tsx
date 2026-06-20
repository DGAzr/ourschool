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

import React, { useState } from 'react'
import { Plus, Trash2, ExternalLink, Upload, MessageSquare, Paperclip } from 'lucide-react'
import { StudentAssignment } from '../../types'
import { formatDateOnly } from '../../utils/formatters'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

interface SubmissionDialogProps {
  assignment: StudentAssignment
  isOpen: boolean
  onClose: () => void
  onSubmit: (submissionData: {
    submission_notes?: string
    submission_artifacts?: string[]
  }) => void
  loading?: boolean
}

const SubmissionDialog: React.FC<SubmissionDialogProps> = ({
  assignment,
  isOpen,
  onClose,
  onSubmit,
  loading = false
}) => {
  const [submissionNotes, setSubmissionNotes] = useState('')
  const [artifactLinks, setArtifactLinks] = useState<string[]>([''])
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})

  const handleAddArtifactLink = () => {
    setArtifactLinks([...artifactLinks, ''])
  }

  const handleRemoveArtifactLink = (index: number) => {
    const newLinks = artifactLinks.filter((_, i) => i !== index)
    setArtifactLinks(newLinks.length === 0 ? [''] : newLinks)
  }

  const handleArtifactLinkChange = (index: number, value: string) => {
    const newLinks = [...artifactLinks]
    newLinks[index] = value
    setArtifactLinks(newLinks)

    if (validationErrors[`link_${index}`]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[`link_${index}`]
        return newErrors
      })
    }
  }

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return true
    const urlPattern = /^https?:\/\/(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?(?:\/?|[/?]\S+)$/i
    return urlPattern.test(url.trim())
  }

  const handleSubmit = () => {
    setValidationErrors({})

    const errors: {[key: string]: string} = {}
    artifactLinks.forEach((link, index) => {
      if (link.trim() && !validateUrl(link.trim())) {
        errors[`link_${index}`] = 'Please enter a valid URL (starting with http:// or https://)'
      }
    })

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    const validArtifacts = artifactLinks
      .map(link => link.trim())
      .filter(link => link.length > 0)

    const submissionData: {
      submission_notes?: string
      submission_artifacts?: string[]
    } = {}

    if (submissionNotes.trim()) {
      submissionData.submission_notes = submissionNotes.trim()
    }

    if (validArtifacts.length > 0) {
      submissionData.submission_artifacts = validArtifacts
    }

    onSubmit(submissionData)
  }

  const template = assignment.template

  const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-full'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Assignment"
      subtitle={template?.name}
      icon={<Upload size={15} />}
      iconVariant="dark"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" loading={loading} onClick={handleSubmit}>
            Submit Assignment
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="bg-panel-2 border border-line rounded-[11px] p-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Assignment Summary</p>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div><span className="text-muted">Points:</span><span className="ml-2 text-ink">{assignment.custom_max_points || template?.max_points || 0}</span></div>
            <div>
              <span className="text-muted">Due Date:</span>
              <span className="ml-2 text-ink">
                {assignment.due_date ? formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}
              </span>
            </div>
          </div>
          {template?.description && <p className="text-[12px] text-muted mt-2 line-clamp-2">{template.description}</p>}
        </div>

        <div>
          <label className="flex items-center text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5 gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />Notes to Admin (Optional)
          </label>
          <textarea value={submissionNotes} onChange={(e) => setSubmissionNotes(e.target.value)}
            placeholder="Add any notes, questions, or comments about your assignment submission..."
            rows={4} className={`${FIELD} resize-vertical`} disabled={loading} />
          <p className="mt-1 text-[11px] text-faint">Use this space to explain your work, ask questions, or provide context.</p>
        </div>

        <div>
          <label className="flex items-center text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5 gap-1.5">
            <Paperclip className="h-3.5 w-3.5" />External Links (Optional)
          </label>
          <p className="text-[11px] text-faint mb-3">Add links to Google Drive, YouTube, or other external resources.</p>
          <div className="space-y-2">
            {artifactLinks.map((link, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1">
                  <input type="url" value={link}
                    onChange={(e) => handleArtifactLinkChange(index, e.target.value)}
                    placeholder="https://example.com/your-work"
                    className={`${FIELD} ${validationErrors[`link_${index}`] ? 'border-neg-fg/50 bg-neg-bg' : ''}`}
                    disabled={loading} />
                  {validationErrors[`link_${index}`] && (
                    <p className="mt-0.5 text-[11px] text-neg-fg">{validationErrors[`link_${index}`]}</p>
                  )}
                </div>
                {link.trim() && validateUrl(link.trim()) && (
                  <a href={link.trim()} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-accent hover:bg-accent/10 rounded-field transition-colors" title="Preview link">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button onClick={() => handleRemoveArtifactLink(index)}
                  disabled={loading || artifactLinks.length === 1}
                  className="p-1.5 text-faint hover:text-neg-fg hover:bg-neg-bg rounded-field transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Remove link">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={handleAddArtifactLink} disabled={loading}
            className="mt-2 flex items-center gap-1 text-[12px] text-accent hover:underline disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" />Add another link
          </button>
        </div>

        {(submissionNotes.trim() || artifactLinks.some(l => l.trim())) && (
          <div className="p-4 bg-accent/6 border border-accent/20 rounded-field">
            <p className="text-[11px] font-semibold text-accent uppercase tracking-wide mb-2">Submission Preview</p>
            {submissionNotes.trim() && (
              <div className="mb-2">
                <p className="text-[11px] text-muted">Notes:</p>
                <p className="text-[13px] text-ink mt-0.5">{submissionNotes.trim()}</p>
              </div>
            )}
            {artifactLinks.some(l => l.trim()) && (
              <div>
                <p className="text-[11px] text-muted">Links:</p>
                <ul className="text-[12px] text-ink mt-0.5 space-y-0.5">
                  {artifactLinks.filter(l => l.trim()).map((l, i) => <li key={i} className="break-all">• {l.trim()}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default SubmissionDialog
