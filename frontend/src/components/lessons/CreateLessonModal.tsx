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
import { lessonsApi } from '../../services/lessons'
import { Subject } from '../../types'
import { 
  AssignmentModalBase, 
  AssignmentFormError, 
  AssignmentModalFooter
} from '../assignments/shared'
import LessonFormFields from './shared/LessonFormFields'
import { useLessonForm } from './shared/useLessonForm'

interface LessonCreate {
  title: string
  description?: string
  scheduled_date: string
  start_time?: string
  end_time?: string
  estimated_duration_minutes?: number
  materials_needed?: string
  objectives?: string
  prerequisites?: string
  resources?: string
  subject_ids?: number[]
}

interface CreateLessonModalProps {
  subjects: Subject[]
  onClose: () => void
  onSuccess: () => void
}

const CreateLessonModal: React.FC<CreateLessonModalProps> = ({ 
  subjects, 
  onClose, 
  onSuccess 
}) => {
  const initialData: LessonCreate = {
    title: '',
    description: '',
    scheduled_date: new Date().toISOString().split('T')[0], // Today's date
    start_time: '',
    end_time: '',
    estimated_duration_minutes: undefined,
    materials_needed: '',
    objectives: '',
    prerequisites: '',
    resources: '',
    subject_ids: []
  }

  const validateForm = (data: LessonCreate): string | null => {
    if (!data.title.trim()) {
      return 'Lesson title is required'
    }
    
    if (!data.scheduled_date) {
      return 'Scheduled date is required'
    }
    
    return null
  }

  const handleSubmit = async (data: LessonCreate) => {
    // Transform data for API - the lesson API expects individual subject assignment
    // For now, we'll create the lesson and handle subject assignment separately
    const lessonData = {
      title: data.title,
      description: data.description || undefined,
      scheduled_date: data.scheduled_date,
      start_time: data.start_time || undefined,
      end_time: data.end_time || undefined,
      materials_needed: data.materials_needed || undefined,
      objectives: data.objectives || undefined,
      prerequisites: data.prerequisites || undefined,
      resources: data.resources || undefined,
      estimated_duration_minutes: data.estimated_duration_minutes || undefined,
    }
    
    await lessonsApi.create(lessonData)
    onSuccess()
  }

  const {
    formData,
    loading,
    error,
    updateField,
    handleSubmit: onSubmit
  } = useLessonForm({
    initialData,
    onSubmit: handleSubmit,
    validate: validateForm
  })

  const isSubmitDisabled = !formData.title.trim() || !formData.scheduled_date

  const handleFormSubmit = () => {
    // Create a synthetic event to pass to the form handler
    const syntheticEvent = {
      preventDefault: () => {
        // Prevent default form submission
      },
      currentTarget: {}
    } as React.FormEvent
    onSubmit(syntheticEvent)
  }

  return (
    <AssignmentModalBase
      isOpen={true}
      onClose={onClose}
      title="Create Lesson"
      subtitle="Create a new lesson with learning objectives and materials"
      size="xl"
      footer={
        <AssignmentModalFooter
          onCancel={onClose}
          onSubmit={handleFormSubmit}
          submitText={loading ? 'Creating...' : 'Create Lesson'}
          loading={loading}
          disabled={isSubmitDisabled}
        />
      }
    >
      <form onSubmit={onSubmit}>
        <div className="space-y-6">
          <AssignmentFormError error={error} />
          
          <LessonFormFields
            formData={formData}
            subjects={subjects}
            onUpdate={(field, value) => updateField(field as keyof LessonCreate, value)}
            disabled={loading}
          />
        </div>
      </form>
    </AssignmentModalBase>
  )
}

export default CreateLessonModal