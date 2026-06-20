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
import { assignmentsApi } from '../../services/assignments'
import { Subject, AssignmentTemplate, AssignmentTemplateUpdate } from '../../types'

interface EditTemplateModalProps {
  template: AssignmentTemplate
  subjects: Subject[]
  onClose: () => void
  onSuccess: () => void
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({
  template,
  subjects,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<AssignmentTemplateUpdate>({
    name: template.name,
    description: template.description || '',
    instructions: template.instructions || '',
    assignment_type: template.assignment_type,
    subject_id: template.subject_id,
    max_points: template.max_points,
    estimated_duration_minutes: template.estimated_duration_minutes || undefined,
    prerequisites: template.prerequisites || '',
    materials_needed: template.materials_needed || '',
    is_exportable: template.is_exportable,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name?.trim()) {
      setError('Template name is required')
      return
    }
    
    if (!formData.subject_id) {
      setError('Please select a subject')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const templateData = {
        ...formData,
        description: formData.description || undefined,
        instructions: formData.instructions || undefined,
        prerequisites: formData.prerequisites || undefined,
        materials_needed: formData.materials_needed || undefined,
        estimated_duration_minutes: formData.estimated_duration_minutes || undefined
      }
      
      await assignmentsApi.update(template.id, templateData)
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to update assignment template')
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: keyof AssignmentTemplateUpdate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-full'
  const LABEL = 'block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-panel border border-line rounded-card-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-line">
            <h3 className="text-[15px] font-semibold text-ink">Edit Assignment Template</h3>
            <p className="text-[13px] text-muted mt-0.5">Update the details for "{template.name}"</p>
          </div>

          <div className="px-6 py-5 space-y-5">
            {error && (
              <div className="bg-neg-bg border border-neg-fg/20 text-neg-fg px-4 py-3 rounded-field text-[13px]">{error}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="lg:col-span-2">
                <label className={LABEL}>Template Name *</label>
                <input type="text" value={formData.name || ''} onChange={(e) => updateFormData('name', e.target.value)}
                  className={FIELD} placeholder="e.g., Multiplication Practice Worksheet" required />
              </div>
              <div>
                <label className={LABEL}>Subject *</label>
                <select value={formData.subject_id || 0} onChange={(e) => updateFormData('subject_id', parseInt(e.target.value))} className={FIELD} required>
                  <option value={0}>Select a subject</option>
                  {subjects?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Assignment Type</label>
                <select value={formData.assignment_type || 'homework'} onChange={(e) => updateFormData('assignment_type', e.target.value)} className={FIELD}>
                  <option value="homework">📝 Homework</option>
                  <option value="project">🏗️ Project</option>
                  <option value="test">📊 Test</option>
                  <option value="quiz">❓ Quiz</option>
                  <option value="essay">✍️ Essay</option>
                  <option value="presentation">🎤 Presentation</option>
                  <option value="worksheet">📄 Worksheet</option>
                  <option value="reading">📚 Reading</option>
                  <option value="practice">🎯 Practice</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Maximum Points</label>
                <input type="number" min="1" max="1000" value={formData.max_points || 100}
                  onChange={(e) => updateFormData('max_points', parseInt(e.target.value))} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Estimated Duration (minutes)</label>
                <input type="number" min="1" value={formData.estimated_duration_minutes || ''}
                  onChange={(e) => updateFormData('estimated_duration_minutes', e.target.value ? parseInt(e.target.value) : undefined)}
                  className={FIELD} placeholder="e.g., 30" />
              </div>
            </div>

            <div>
              <label className={LABEL}>Description</label>
              <textarea value={formData.description || ''} onChange={(e) => updateFormData('description', e.target.value)}
                rows={3} className={FIELD} placeholder="Brief description of what this assignment covers..." />
            </div>

            <div>
              <label className={LABEL}>Instructions</label>
              <textarea value={formData.instructions || ''} onChange={(e) => updateFormData('instructions', e.target.value)}
                rows={4} className={FIELD} placeholder="Detailed instructions for students on how to complete this assignment..." />
            </div>

            <div>
              <label className={LABEL}>Prerequisites</label>
              <textarea value={formData.prerequisites || ''} onChange={(e) => updateFormData('prerequisites', e.target.value)}
                rows={2} className={FIELD} placeholder="What students should know or complete before starting this assignment..." />
            </div>

            <div>
              <label className={LABEL}>Materials Needed</label>
              <textarea value={formData.materials_needed || ''} onChange={(e) => updateFormData('materials_needed', e.target.value)}
                rows={2} className={FIELD} placeholder="List any materials, resources, or tools needed for this assignment..." />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox" id="is_exportable"
                checked={formData.is_exportable || false}
                onChange={(e) => updateFormData('is_exportable', e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--accent)] rounded"
              />
              <span className="text-[13px] text-ink">Allow this template to be exported and shared with other OurSchool systems</span>
            </label>
          </div>

          <div className="px-6 py-4 border-t border-line flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={loading}
              className="px-4 py-2 text-[13px] font-medium text-ink border border-btn-border bg-panel rounded-field hover:bg-track disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading || !formData.name?.trim() || !formData.subject_id}
              className="px-4 py-2 text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg rounded-field hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Updating…' : 'Update Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditTemplateModal