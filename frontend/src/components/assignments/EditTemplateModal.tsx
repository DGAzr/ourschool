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
import { Subject, Lesson, AssignmentTemplate, AssignmentTemplateUpdate } from '../../types'

interface EditTemplateModalProps {
  template: AssignmentTemplate
  subjects: Subject[]
  lessons: Lesson[]
  onClose: () => void
  onSuccess: () => void
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({ 
  template,
  subjects, 
  lessons, 
  onClose, 
  onSuccess 
}) => {
  const [formData, setFormData] = useState<AssignmentTemplateUpdate>({
    name: template.name,
    description: template.description || '',
    instructions: template.instructions || '',
    assignment_type: template.assignment_type,
    lesson_id: template.lesson_id || undefined,
    subject_id: template.subject_id,
    max_points: template.max_points,
    estimated_duration_minutes: template.estimated_duration_minutes || undefined,
    prerequisites: template.prerequisites || '',
    materials_needed: template.materials_needed || '',
    is_exportable: template.is_exportable,
    order_in_lesson: template.order_in_lesson
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
        lesson_id: formData.lesson_id || undefined,
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

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Edit Assignment Template</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Update the details for "{template.name}"
            </p>
          </div>

          {/* Form Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Basic Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Multiplication Practice Worksheet"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject *
                </label>
                <select
                  value={formData.subject_id || 0}
                  onChange={(e) => updateFormData('subject_id', parseInt(e.target.value))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value={0}>Select a subject</option>
                  {subjects?.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Lesson (Optional)
                </label>
                <select
                  value={formData.lesson_id || ''}
                  onChange={(e) => updateFormData('lesson_id', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Standalone (no lesson)</option>
                  {lessons.map(lesson => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assignment Type
                </label>
                <select
                  value={formData.assignment_type || 'homework'}
                  onChange={(e) => updateFormData('assignment_type', e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
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

            {/* Grading and Time */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum Points
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.max_points || 100}
                  onChange={(e) => updateFormData('max_points', parseInt(e.target.value))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Estimated Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.estimated_duration_minutes || ''}
                  onChange={(e) => updateFormData('estimated_duration_minutes', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Order in Lesson
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.order_in_lesson || 0}
                  onChange={(e) => updateFormData('order_in_lesson', parseInt(e.target.value))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => updateFormData('description', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief description of what this assignment covers..."
              />
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Instructions
              </label>
              <textarea
                value={formData.instructions || ''}
                onChange={(e) => updateFormData('instructions', e.target.value)}
                rows={4}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Detailed instructions for students on how to complete this assignment..."
              />
            </div>

            {/* Prerequisites */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prerequisites
              </label>
              <textarea
                value={formData.prerequisites || ''}
                onChange={(e) => updateFormData('prerequisites', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="What students should know or complete before starting this assignment..."
              />
            </div>

            {/* Materials */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Materials Needed
              </label>
              <textarea
                value={formData.materials_needed || ''}
                onChange={(e) => updateFormData('materials_needed', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="List any materials, resources, or tools needed for this assignment..."
              />
            </div>

            {/* Options */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_exportable"
                checked={formData.is_exportable || false}
                onChange={(e) => updateFormData('is_exportable', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_exportable" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                Allow this template to be exported and shared with other OurSchool systems
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name?.trim() || !formData.subject_id}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditTemplateModal