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
import { X, ClipboardList } from 'lucide-react'
import { assignmentsApi } from '../services/assignments'
import { lessonsApi } from '../services/lessons'
import { Subject, Lesson, AssignmentTemplateCreate } from '../types'

interface QuickCreateTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const QuickCreateTemplateModal: React.FC<QuickCreateTemplateModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<AssignmentTemplateCreate>({
    name: '',
    description: '',
    instructions: '',
    assignment_type: 'homework',
    lesson_id: undefined,
    subject_id: 0,
    max_points: 100,
    estimated_duration_minutes: 30,
    prerequisites: '',
    materials_needed: '',
    is_exportable: true,
    order_in_lesson: 0
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
      // Reset form when modal opens
      setFormData({
        name: '',
        description: '',
        instructions: '',
        assignment_type: 'homework',
        lesson_id: undefined,
        subject_id: 0,
        max_points: 100,
        estimated_duration_minutes: 30,
        prerequisites: '',
        materials_needed: '',
        is_exportable: true,
        order_in_lesson: 0
      })
      setError(null)
    }
  }, [isOpen])

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

  const loadData = async () => {
    try {
      setDataLoading(true)
      const [subjectsData, lessonsData] = await Promise.all([
        lessonsApi.getSubjects(),
        lessonsApi.getAll()
      ])
      setSubjects(subjectsData)
      setLessons(lessonsData || [])
    } catch (err) {
      setError('Failed to load subjects and lessons')
    } finally {
      setDataLoading(false)
    }
  }

  const updateField = (field: keyof AssignmentTemplateCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null) // Clear error when user types
  }

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Template name is required'
    }
    
    if (!formData.subject_id) {
      if (!subjects || subjects.length === 0) {
        return 'Subjects are not loaded. Please check your connection and ensure you are logged in.'
      } else {
        return 'Please select a subject'
      }
    }
    
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
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
      
      await assignmentsApi.create(templateData)
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create assignment template')
    } finally {
      setLoading(false)
    }
  }

  const isSubmitDisabled = !formData.name.trim() || !formData.subject_id || loading || dataLoading

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900 dark:to-green-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                <ClipboardList className="h-4 w-4 text-white" />
              </div>
              Quick Create Assignment
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Create a reusable assignment template that can be assigned to students
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {dataLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-b-2 border-green-500 rounded-full mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading form data...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Assignment Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter assignment name..."
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subject *
                    </label>
                    <select
                      value={formData.subject_id}
                      onChange={(e) => updateField('subject_id', parseInt(e.target.value))}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-green-500 focus:border-green-500"
                      disabled={loading}
                    >
                      <option value={0}>Select a subject...</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Type
                    </label>
                    <select
                      value={formData.assignment_type}
                      onChange={(e) => updateField('assignment_type', e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-green-500 focus:border-green-500"
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Lesson (Optional)
                    </label>
                    <select
                      value={formData.lesson_id || ''}
                      onChange={(e) => updateField('lesson_id', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-green-500 focus:border-green-500"
                      disabled={loading}
                    >
                      <option value="">No lesson association</option>
                      {lessons.map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          {lesson.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Points
                    </label>
                    <input
                      type="number"
                      value={formData.max_points}
                      onChange={(e) => updateField('max_points', parseInt(e.target.value))}
                      min="1"
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-green-500 focus:border-green-500"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-green-500 focus:border-green-500"
                    placeholder="Brief description of the assignment..."
                    disabled={loading}
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Instructions
                  </label>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) => updateField('instructions', e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-green-500 focus:border-green-500"
                    placeholder="Detailed instructions for students..."
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default QuickCreateTemplateModal