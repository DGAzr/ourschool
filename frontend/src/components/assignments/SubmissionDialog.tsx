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

import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, ExternalLink, Upload, MessageSquare, Paperclip } from 'lucide-react'
import { StudentAssignment } from '../../types'
import { formatDateOnly } from '../../utils/formatters'

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

  if (!isOpen) return null

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
    
    // Clear validation error for this link when user starts typing
    if (validationErrors[`link_${index}`]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[`link_${index}`]
        return newErrors
      })
    }
  }

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return true // Empty URLs are allowed
    
    const urlPattern = /^https?:\/\/(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?(?:\/?|[\/\?]\S+)$/i
    return urlPattern.test(url.trim())
  }

  const handleSubmit = () => {
    setValidationErrors({})
    
    // Validate artifact links
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

    // Filter out empty links
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

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                <Upload className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Submit Assignment
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {template?.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Assignment Summary */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Assignment Summary
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Points:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  {assignment.custom_max_points || template?.max_points || 0}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Due Date:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  {assignment.due_date 
                    ? formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'No due date'
                  }
                </span>
              </div>
            </div>
            {template?.description && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {template.description}
                </p>
              </div>
            )}
          </div>

          {/* Submission Notes */}
          <div className="mb-6">
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <MessageSquare className="h-4 w-4 mr-2" />
              Notes to Admin (Optional)
            </label>
            <textarea
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Add any notes, questions, or comments about your assignment submission..."
              rows={4}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Use this space to explain your work, ask questions, or provide context for your submission.
            </p>
          </div>

          {/* Artifact Links */}
          <div className="mb-6">
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Paperclip className="h-4 w-4 mr-2" />
              External Links (Optional)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Add links to external resources like Google Drive documents, YouTube videos, or other websites.
            </p>
            
            <div className="space-y-3">
              {artifactLinks.map((link, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="flex-1">
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => handleArtifactLinkChange(index, e.target.value)}
                      placeholder="https://example.com/your-work"
                      className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                        validationErrors[`link_${index}`]
                          ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                      } text-gray-900 dark:text-gray-100`}
                      disabled={loading}
                    />
                    {validationErrors[`link_${index}`] && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {validationErrors[`link_${index}`]}
                      </p>
                    )}
                  </div>
                  
                  {link.trim() && validateUrl(link.trim()) && (
                    <a
                      href={link.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                      title="Preview link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  
                  <button
                    onClick={() => handleRemoveArtifactLink(index)}
                    disabled={loading || artifactLinks.length === 1}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove link"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleAddArtifactLink}
              disabled={loading}
              className="mt-3 flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add another link
            </button>
          </div>

          {/* Preview */}
          {(submissionNotes.trim() || artifactLinks.some(link => link.trim())) && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Submission Preview
              </h4>
              {submissionNotes.trim() && (
                <div className="mb-3">
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Notes:</p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    {submissionNotes.trim()}
                  </p>
                </div>
              )}
              {artifactLinks.some(link => link.trim()) && (
                <div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Links:</p>
                  <ul className="text-sm text-yellow-800 dark:text-yellow-200 mt-1 space-y-1">
                    {artifactLinks
                      .filter(link => link.trim())
                      .map((link, index) => (
                        <li key={index} className="break-all">
                          • {link.trim()}
                        </li>
                      ))
                    }
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Submit Assignment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SubmissionDialog