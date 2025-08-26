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
import { assignmentsApi } from '../../services/assignments'
import { Subject, Lesson, AssignmentTemplateCreate } from '../../types'
import { 
  AssignmentModalBase, 
  AssignmentFormFields, 
  AssignmentFormError, 
  AssignmentModalFooter,
  useAssignmentForm 
} from './shared'

interface CreateTemplateModalProps {
  subjects: Subject[]
  lessons: Lesson[]
  onClose: () => void
  onSuccess: () => void
}

const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({ 
  subjects, 
  lessons, 
  onClose, 
  onSuccess 
}) => {
  const initialData: AssignmentTemplateCreate = {
    name: '',
    description: '',
    instructions: '',
    assignment_type: 'homework',
    lesson_id: undefined,
    subject_id: 0,
    max_points: 100,
    estimated_duration_minutes: undefined,
    prerequisites: '',
    materials_needed: '',
    is_exportable: true,
    order_in_lesson: 0
  }

  const validateForm = (data: AssignmentTemplateCreate): string | null => {
    if (!data.name.trim()) {
      return 'Template name is required'
    }
    
    if (!data.subject_id) {
      if (!subjects || subjects.length === 0) {
        return 'Subjects are not loaded. Please check your connection and ensure you are logged in.'
      } else {
        return 'Please select a subject'
      }
    }
    
    return null
  }

  const handleSubmit = async (data: AssignmentTemplateCreate) => {
    const templateData = {
      ...data,
      lesson_id: data.lesson_id || undefined,
      description: data.description || undefined,
      instructions: data.instructions || undefined,
      prerequisites: data.prerequisites || undefined,
      materials_needed: data.materials_needed || undefined,
      estimated_duration_minutes: data.estimated_duration_minutes || undefined
    }
    
    await assignmentsApi.create(templateData)
    onSuccess()
  }

  const {
    formData,
    loading,
    error,
    updateField,
    handleSubmit: onSubmit
  } = useAssignmentForm({
    initialData,
    onSubmit: handleSubmit,
    validate: validateForm
  })

  const isSubmitDisabled = !formData.name.trim() || !formData.subject_id

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
      title="Create Assignment"
      subtitle="Create a reusable assignment template that can be assigned to multiple students"
      size="xl"
      footer={
        <AssignmentModalFooter
          onCancel={onClose}
          onSubmit={handleFormSubmit}
          submitText={loading ? 'Creating...' : 'Create Template'}
          loading={loading}
          disabled={isSubmitDisabled}
        />
      }
    >
      <form onSubmit={onSubmit}>
        <div className="space-y-6">
          <AssignmentFormError error={error} />
          
          <AssignmentFormFields
            formData={formData}
            subjects={subjects}
            lessons={lessons}
            onUpdate={(field, value) => updateField(field as keyof AssignmentTemplateCreate, value)}
            showAllFields={true}
            disabled={loading}
          />
        </div>
      </form>
    </AssignmentModalBase>
  )
}

export default CreateTemplateModal