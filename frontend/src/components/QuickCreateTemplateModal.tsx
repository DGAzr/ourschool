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
import { X } from 'lucide-react'
import { assignmentsApi } from '../services/assignments'
import { subjectsApi } from '../services/subjects'
import { Subject, AssignmentTemplateCreate } from '../types'

interface QuickCreateTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest w-full'
const LABEL = 'block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5'

const QuickCreateTemplateModal: React.FC<QuickCreateTemplateModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<AssignmentTemplateCreate>({
    name: '',
    description: '',
    instructions: '',
    assignment_type: 'homework',
    subject_id: 0,
    max_points: 100,
    estimated_duration_minutes: 30,
    prerequisites: '',
    materials_needed: '',
    is_exportable: true,
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
      setFormData({
        name: '',
        description: '',
        instructions: '',
        assignment_type: 'homework',
        subject_id: 0,
        max_points: 100,
        estimated_duration_minutes: 30,
        prerequisites: '',
        materials_needed: '',
        is_exportable: true,
      })
      setError(null)
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose() }
    if (isOpen) { document.addEventListener('keydown', handleEscape); return () => document.removeEventListener('keydown', handleEscape) }
  }, [isOpen, onClose])

  const loadData = async () => {
    try {
      setDataLoading(true)
      const subjectsData = await subjectsApi.getAll()
      setSubjects(subjectsData)
    } catch {
      setError('Failed to load subjects')
    } finally {
      setDataLoading(false)
    }
  }

  const updateField = (field: keyof AssignmentTemplateCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) { setError('Assignment name is required'); return }
    if (!formData.subject_id) { setError('Please select a subject'); return }

    try {
      setLoading(true)
      setError(null)
      await assignmentsApi.create({
        ...formData,
        description: formData.description || undefined,
        instructions: formData.instructions || undefined,
        prerequisites: formData.prerequisites || undefined,
        materials_needed: formData.materials_needed || undefined,
        estimated_duration_minutes: formData.estimated_duration_minutes || undefined,
      })
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create assignment template')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const isSubmitDisabled = !formData.name.trim() || !formData.subject_id || loading || dataLoading

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-panel border border-line rounded-card-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Quick Create Assignment</h3>
            <p className="text-[12px] text-muted mt-0.5">Create a reusable template that can be assigned to students</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-faint hover:text-ink hover:bg-track transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {error && (
              <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px]">{error}</div>
            )}

            {dataLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-[13px] text-faint">Loading…</p>
              </div>
            ) : (
              <>
                {/* Name */}
                <div>
                  <label className={LABEL}>Assignment Name <span className="text-neg-fg normal-case">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => updateField('name', e.target.value)}
                    className={FIELD}
                    placeholder="e.g., Chapter 5 Review"
                    disabled={loading}
                    autoFocus
                  />
                </div>

                {/* Subject + Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Subject <span className="text-neg-fg normal-case">*</span></label>
                    <select
                      value={formData.subject_id}
                      onChange={e => updateField('subject_id', parseInt(e.target.value))}
                      className={FIELD}
                      disabled={loading}
                    >
                      <option value={0}>Select…</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Type</label>
                    <select
                      value={formData.assignment_type}
                      onChange={e => updateField('assignment_type', e.target.value)}
                      className={FIELD}
                      disabled={loading}
                    >
                      <option value="homework">Homework</option>
                      <option value="project">Project</option>
                      <option value="test">Test</option>
                      <option value="quiz">Quiz</option>
                      <option value="essay">Essay</option>
                      <option value="presentation">Presentation</option>
                      <option value="worksheet">Worksheet</option>
                      <option value="reading">Reading</option>
                      <option value="practice">Practice</option>
                    </select>
                  </div>
                </div>

                {/* Max Points */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Max Points</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.max_points}
                      onChange={e => updateField('max_points', parseInt(e.target.value) || 100)}
                      className={FIELD}
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Est. Duration (min)</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.estimated_duration_minutes}
                      onChange={e => updateField('estimated_duration_minutes', parseInt(e.target.value) || undefined)}
                      className={FIELD}
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className={LABEL}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={e => updateField('description', e.target.value)}
                    rows={3}
                    className={FIELD}
                    placeholder="Brief description of the assignment…"
                    disabled={loading}
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className={LABEL}>Instructions</label>
                  <textarea
                    value={formData.instructions}
                    onChange={e => updateField('instructions', e.target.value)}
                    rows={4}
                    className={FIELD}
                    placeholder="Detailed instructions for students…"
                    disabled={loading}
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line bg-panel-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-[34px] px-4 text-[13px] font-semibold text-muted hover:text-ink transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Creating…
                </>
              ) : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default QuickCreateTemplateModal
