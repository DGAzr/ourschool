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

import { Select, Input, TextArea } from '../../ui'
import { Subject } from '../../../types'
import { useAssignmentTypes } from '../../../contexts/AssignmentTypesContext'

interface AssignmentFormFieldsProps {
  formData: {
    name?: string
    description?: string
    instructions?: string
    assignment_type?: string
    subject_id?: number
    max_points?: number
    estimated_duration_minutes?: number
    prerequisites?: string
    materials_needed?: string
    is_exportable?: boolean
  }
  subjects: Subject[]
  onUpdate: (field: string, value: any) => void
  showAllFields?: boolean
  disabled?: boolean
}

const AssignmentFormFields: React.FC<AssignmentFormFieldsProps> = ({
  formData,
  subjects,
  onUpdate,
  showAllFields = true,
  disabled = false
}) => {
  const { types, getTypeIcon, getTypeLabel } = useAssignmentTypes()

  // Offer active types; keep the current value selectable even if it is
  // inactive so editing an existing template never silently loses its type.
  const currentType = formData.assignment_type
  const activeTypes = types.filter(t => t.is_active)
  const typeOptions = [
    ...activeTypes.map(t => ({
      value: t.key,
      label: `${getTypeIcon(t.key)} ${t.name}`,
    })),
    ...(currentType && !activeTypes.some(t => t.key === currentType)
      ? [{ value: currentType, label: `${getTypeIcon(currentType)} ${getTypeLabel(currentType)}` }]
      : []),
  ]

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <Input
            label="Template Name"
            value={formData.name || ''}
            onChange={(e) => onUpdate('name', e.target.value)}
            placeholder="e.g., Multiplication Practice Worksheet"
            required
            disabled={disabled}
          />
        </div>

        <Select
          label="Subject"
          value={formData.subject_id || 0}
          onChange={(e) => onUpdate('subject_id', parseInt(e.target.value))}
          required
          disabled={disabled || !subjects.length}
          options={[
            { value: 0, label: !subjects.length ? 'Loading subjects...' : 'Select a subject' },
            ...subjects.map(subject => ({
              value: subject.id,
              label: subject.name
            }))
          ]}
        />

        <Select
          label="Assignment Type"
          value={formData.assignment_type || 'homework'}
          onChange={(e) => onUpdate('assignment_type', e.target.value)}
          disabled={disabled}
          options={typeOptions}
        />

      </div>

      {/* Grading and Time */}
      {showAllFields && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Input
            type="number"
            label="Maximum Points"
            value={formData.max_points || 100}
            onChange={(e) => onUpdate('max_points', parseInt(e.target.value))}
            min={1}
            max={1000}
            disabled={disabled}
          />

          <Input
            type="number"
            label="Estimated Duration (minutes)"
            value={formData.estimated_duration_minutes || ''}
            onChange={(e) => onUpdate('estimated_duration_minutes', e.target.value ? parseInt(e.target.value) : undefined)}
            min={1}
            placeholder="e.g., 30"
            disabled={disabled}
          />
        </div>
      )}

      {/* Description Fields */}
      {showAllFields && (
        <>
          <TextArea
            label="Description"
            value={formData.description || ''}
            onChange={(e) => onUpdate('description', e.target.value)}
            rows={3}
            placeholder="Brief description of what this assignment covers..."
            disabled={disabled}
          />

          <TextArea
            label="Instructions"
            value={formData.instructions || ''}
            onChange={(e) => onUpdate('instructions', e.target.value)}
            rows={4}
            placeholder="Detailed instructions for students on how to complete this assignment..."
            disabled={disabled}
          />

          <TextArea
            label="Prerequisites"
            value={formData.prerequisites || ''}
            onChange={(e) => onUpdate('prerequisites', e.target.value)}
            rows={2}
            placeholder="What students should know or complete before starting this assignment..."
            disabled={disabled}
          />

          <TextArea
            label="Materials Needed"
            value={formData.materials_needed || ''}
            onChange={(e) => onUpdate('materials_needed', e.target.value)}
            rows={2}
            placeholder="List any materials, resources, or tools needed for this assignment..."
            disabled={disabled}
          />

          {/* Exportable Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_exportable"
              checked={formData.is_exportable || false}
              onChange={(e) => onUpdate('is_exportable', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={disabled}
            />
            <label htmlFor="is_exportable" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
              Allow this template to be exported and shared with other OurSchool systems
            </label>
          </div>
        </>
      )}
    </div>
  )
}

export default AssignmentFormFields