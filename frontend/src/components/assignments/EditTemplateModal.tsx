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
import { useAssignmentTypes } from '../../contexts/AssignmentTypesContext'
import { Subject, AssignmentTemplate, AssignmentTemplateUpdate } from '../../types'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { IconSelect, IconPickerButton } from '../ui'
import { getErrorMessage } from '../../services/api'

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
  const { types, getTypeIcon, getTypeLabel } = useAssignmentTypes()

  const [formData, setFormData] = useState<AssignmentTemplateUpdate>({
    name: template.name,
    description: template.description || '',
    instructions: template.instructions || '',
    assignment_type: template.assignment_type,
    subject_id: template.subject_id,
    icon: template.icon,
    max_points: template.max_points,
    estimated_duration_minutes: template.estimated_duration_minutes || undefined,
    prerequisites: template.prerequisites || '',
    materials_needed: template.materials_needed || '',
    is_exportable: template.is_exportable,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentType = formData.assignment_type
  const activeTypes = types.filter(t => t.is_active)
  const typeOptions = [
    ...activeTypes.map(t => ({
      value: t.key,
      label: t.name,
      icon: t.icon ?? getTypeIcon(t.key),
      iconColor: 'var(--accent)',
    })),
    ...(currentType && !activeTypes.some(t => t.key === currentType)
      ? [{ value: currentType, label: getTypeLabel(currentType), icon: getTypeIcon(currentType), iconColor: 'var(--accent)' }]
      : []),
  ]

  const selectedSubject = subjects?.find(s => s.id === formData.subject_id)
  const iconPreviewColor = selectedSubject?.color ?? 'var(--accent)'

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
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update assignment template'))
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = <K extends keyof AssignmentTemplateUpdate>(field: K, value: AssignmentTemplateUpdate[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-full'
  const LABEL = 'block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5'

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Assignment Template"
      subtitle={`Update the details for "${template.name}"`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={loading || !formData.name?.trim() || !formData.subject_id}
            onClick={() => {
              const form = document.getElementById('edit-template-form') as HTMLFormElement
              form?.requestSubmit()
            }}
          >
            Update Template
          </Button>
        </>
      }
    >
      <form id="edit-template-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-danger-soft border border-danger-line text-danger rounded-field px-4 py-3 text-[13px]">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <label className={LABEL}>Template Name *</label>
            <input type="text" value={formData.name || ''} onChange={(e) => updateFormData('name', e.target.value)}
              className={FIELD} placeholder="e.g., Multiplication Practice Worksheet" required />
          </div>
          <IconSelect
            label="Subject *"
            value={formData.subject_id || 0}
            onChange={v => updateFormData('subject_id', Number(v))}
            required
            disabled={!subjects?.length}
            options={[
              { value: 0, label: 'Select a subject' },
              ...(subjects ?? []).map(s => ({ value: s.id, label: s.name, icon: s.icon, iconColor: s.color }))
            ]}
          />
          <IconSelect
            label="Assignment Type"
            value={formData.assignment_type || 'homework'}
            onChange={v => updateFormData('assignment_type', String(v))}
            options={typeOptions}
          />
        </div>

        {/* Icon override */}
        <div>
          <label className={LABEL}>Icon <span className="font-normal normal-case text-faint">(optional — defaults to the assignment type icon)</span></label>
          <div className="flex items-center gap-3">
            <IconPickerButton
              value={formData.icon}
              color={iconPreviewColor}
              onSelect={name => updateFormData('icon', name)}
            />
            {formData.icon && <span className="text-[12px] text-muted">{formData.icon}</span>}
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
      </form>
    </Modal>
  )
}

export default EditTemplateModal
