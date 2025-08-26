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

import React from 'react'
import { Input, TextArea } from '../../ui'
import { Subject } from '../../../types'

interface LessonFormFieldsProps {
  formData: {
    title?: string
    description?: string
    scheduled_date?: string
    start_time?: string
    end_time?: string
    estimated_duration_minutes?: number
    difficulty_level?: string
    materials_needed?: string
    objectives?: string
    prerequisites?: string
    resources?: string
    subject_ids?: number[]
  }
  subjects: Subject[]
  onUpdate: (field: string, value: any) => void
  disabled?: boolean
}

const LessonFormFields: React.FC<LessonFormFieldsProps> = ({
  formData,
  subjects,
  onUpdate,
  disabled = false
}) => {
  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <Input
            label="Lesson Title"
            value={formData.title || ''}
            onChange={(e) => onUpdate('title', e.target.value)}
            placeholder="e.g., Introduction to Fractions"
            required
            disabled={disabled}
          />
        </div>

        <Input
          type="date"
          label="Scheduled Date"
          value={formData.scheduled_date || ''}
          onChange={(e) => onUpdate('scheduled_date', e.target.value)}
          required
          disabled={disabled}
        />

      </div>

      {/* Time Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Input
          type="time"
          label="Start Time (Optional)"
          value={formData.start_time || ''}
          onChange={(e) => onUpdate('start_time', e.target.value)}
          disabled={disabled}
        />

        <Input
          type="time"
          label="End Time (Optional)"
          value={formData.end_time || ''}
          onChange={(e) => onUpdate('end_time', e.target.value)}
          disabled={disabled}
        />

        <Input
          type="number"
          label="Estimated Duration (minutes)"
          value={formData.estimated_duration_minutes || ''}
          onChange={(e) => onUpdate('estimated_duration_minutes', e.target.value ? parseInt(e.target.value) : undefined)}
          min={1}
          placeholder="e.g., 45"
          disabled={disabled}
        />
      </div>

      {/* Subject Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Subjects
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {subjects.map(subject => (
            <label key={subject.id} className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.subject_ids?.includes(subject.id) || false}
                onChange={(e) => {
                  const currentIds = formData.subject_ids || []
                  const newIds = e.target.checked
                    ? [...currentIds, subject.id]
                    : currentIds.filter(id => id !== subject.id)
                  onUpdate('subject_ids', newIds)
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={disabled}
              />
              <span 
                className="text-sm font-medium"
                style={{ color: subject.color || '#6B7280' }}
              >
                {subject.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Description Fields */}
      <TextArea
        label="Description"
        value={formData.description || ''}
        onChange={(e) => onUpdate('description', e.target.value)}
        rows={3}
        placeholder="Brief description of what this lesson covers..."
        disabled={disabled}
      />

      <TextArea
        label="Learning Objectives"
        value={formData.objectives || ''}
        onChange={(e) => onUpdate('objectives', e.target.value)}
        rows={3}
        placeholder="What students should learn from this lesson..."
        disabled={disabled}
      />

      <TextArea
        label="Prerequisites"
        value={formData.prerequisites || ''}
        onChange={(e) => onUpdate('prerequisites', e.target.value)}
        rows={2}
        placeholder="What students should know before this lesson..."
        disabled={disabled}
      />

      <TextArea
        label="Materials Needed"
        value={formData.materials_needed || ''}
        onChange={(e) => onUpdate('materials_needed', e.target.value)}
        rows={2}
        placeholder="List any materials, resources, or tools needed for this lesson..."
        disabled={disabled}
      />

      <TextArea
        label="Resources"
        value={formData.resources || ''}
        onChange={(e) => onUpdate('resources', e.target.value)}
        rows={2}
        placeholder="Additional resources, links, or references for this lesson..."
        disabled={disabled}
      />
    </div>
  )
}

export default LessonFormFields