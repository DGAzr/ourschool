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
import { assignmentsApi } from '../services/assignments'
import { subjectsApi } from '../services/subjects'
import { useAssignmentTypes } from '../contexts/AssignmentTypesContext'
import { Subject, AssignmentTemplateCreate } from '../types'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { IconSelect } from './ui'

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
  const { types, getTypeIcon } = useAssignmentTypes()
  const activeTypes = types.filter(t => t.is_active)
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

  const isSubmitDisabled = !formData.name.trim() || !formData.subject_id || loading || dataLoading

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Create Assignment"
      subtitle="Create a reusable template that can be assigned to students"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={isSubmitDisabled}
            onClick={() => {
              const form = document.getElementById('quick-create-template-form') as HTMLFormElement
              form?.requestSubmit()
            }}
          >
            Create Template
          </Button>
        </>
      }
    >
      <form id="quick-create-template-form" onSubmit={handleSubmit} className="space-y-5">
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
              <IconSelect
                label="Subject *"
                value={formData.subject_id}
                onChange={v => updateField('subject_id', Number(v))}
                required
                disabled={loading}
                options={[
                  { value: 0, label: 'Select…' },
                  ...subjects.map(s => ({ value: s.id, label: s.name, icon: s.icon, iconColor: s.color }))
                ]}
              />
              <IconSelect
                label="Type"
                value={formData.assignment_type}
                onChange={v => updateField('assignment_type', String(v))}
                disabled={loading}
                options={activeTypes.length
                  ? activeTypes.map(t => ({ value: t.key, label: t.name, icon: t.icon ?? getTypeIcon(t.key), iconColor: 'var(--accent)' }))
                  : [{ value: 'homework', label: 'Homework', icon: getTypeIcon('homework'), iconColor: 'var(--accent)' }]
                }
              />
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
      </form>
    </Modal>
  )
}

export default QuickCreateTemplateModal
