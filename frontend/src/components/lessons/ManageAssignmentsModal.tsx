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
import { Plus, Trash2, Edit, GripVertical, Clock, Target } from 'lucide-react'
import { lessonsApi } from '../../services/lessons'
import { Lesson, AssignmentTemplate } from '../../types'
import { 
  AssignmentModalBase, 
  AssignmentFormError, 
  AssignmentModalFooter
} from '../assignments/shared'
import { Select, Input, TextArea } from '../ui'

interface LessonAssignment {
  id: number
  assignment_template_id: number
  assignment_template: AssignmentTemplate
  order_in_lesson: number
  planned_duration_minutes?: number
  custom_instructions?: string
  is_required: boolean
  custom_max_points?: number
}

interface ManageAssignmentsModalProps {
  lesson: Lesson
  onClose: () => void
  onSuccess: () => void
}

const ManageAssignmentsModal: React.FC<ManageAssignmentsModalProps> = ({ 
  lesson, 
  onClose, 
  onSuccess 
}) => {
  const [assignments, setAssignments] = useState<LessonAssignment[]>([])
  const [templates, setTemplates] = useState<AssignmentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [, setEditingAssignment] = useState<LessonAssignment | null>(null)
  
  const [addForm, setAddForm] = useState({
    assignment_template_id: 0,
    order_in_lesson: 0,
    planned_duration_minutes: '',
    custom_instructions: '',
    is_required: true,
    custom_max_points: ''
  })

  useEffect(() => {
    loadData()
  }, [lesson.id])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [assignmentsData, templatesData] = await Promise.all([
        lessonsApi.getLessonAssignments(lesson.id),
        lessonsApi.getAssignmentTemplates({ lesson_id: lesson.id })
      ])
      
      setAssignments(assignmentsData || [])
      setTemplates(templatesData || [])
      
      // Set next order number for new assignments
      const maxOrder = assignmentsData?.length ? Math.max(...assignmentsData.map((a: LessonAssignment) => a.order_in_lesson)) : 0
      setAddForm(prev => ({ ...prev, order_in_lesson: maxOrder + 1 }))
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAssignment = async () => {
    try {
      setError(null)
      
      if (!addForm.assignment_template_id) {
        setError('Please select an assignment template')
        return
      }

      const assignmentData = {
        assignment_template_id: addForm.assignment_template_id,
        order_in_lesson: addForm.order_in_lesson,
        planned_duration_minutes: addForm.planned_duration_minutes ? parseInt(addForm.planned_duration_minutes) : undefined,
        custom_instructions: addForm.custom_instructions || undefined,
        is_required: addForm.is_required,
        custom_max_points: addForm.custom_max_points ? parseInt(addForm.custom_max_points) : undefined
      }

      await lessonsApi.addAssignmentToLesson(lesson.id, assignmentData)
      
      // Reset form
      setAddForm({
        assignment_template_id: 0,
        order_in_lesson: assignments.length + 1,
        planned_duration_minutes: '',
        custom_instructions: '',
        is_required: true,
        custom_max_points: ''
      })
      setShowAddForm(false)
      
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add assignment')
    }
  }

  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!window.confirm('Are you sure you want to remove this assignment from the lesson?')) {
      return
    }

    try {
      setError(null)
      await lessonsApi.removeLessonAssignment(lesson.id, assignmentId)
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove assignment')
    }
  }

  const handleUpdateOrder = async (assignmentId: number, newOrder: number) => {
    try {
      setError(null)
      await lessonsApi.updateLessonAssignment(lesson.id, assignmentId, { order_in_lesson: newOrder })
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update assignment order')
    }
  }
  
  // Mark as used to avoid warning
  void handleUpdateOrder

  const availableTemplates = templates.filter(template => 
    !assignments.some(assignment => assignment.assignment_template_id === template.id)
  )

  return (
    <AssignmentModalBase
      isOpen={true}
      onClose={onClose}
      title="Manage Lesson Assignments"
      subtitle={`Organize assignments for "${lesson.title}"`}
      size="xl"
      footer={
        <AssignmentModalFooter
          onCancel={onClose}
          onSubmit={onSuccess}
          submitText="Done"
          loading={false}
          disabled={false}
        />
      }
    >
      <div className="space-y-6">
        <AssignmentFormError error={error} />
        
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading assignments...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Current Assignments */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Current Assignments ({assignments.length})
                </h3>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Assignment
                </button>
              </div>

              {assignments.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-gray-600 dark:text-gray-400">
                    No assignments added to this lesson yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments
                    .sort((a, b) => a.order_in_lesson - b.order_in_lesson)
                    .map((assignment) => (
                    <div key={assignment.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="flex flex-col items-center">
                            <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              #{assignment.order_in_lesson}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {assignment.assignment_template.name}
                              </h4>
                              {assignment.is_required && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                                  Required
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                              {assignment.planned_duration_minutes && (
                                <div className="flex items-center">
                                  <Clock className="h-4 w-4 mr-1" />
                                  {assignment.planned_duration_minutes} min
                                </div>
                              )}
                              {assignment.custom_max_points && (
                                <div className="flex items-center">
                                  <Target className="h-4 w-4 mr-1" />
                                  {assignment.custom_max_points} pts
                                </div>
                              )}
                            </div>
                            
                            {assignment.custom_instructions && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                {assignment.custom_instructions}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setEditingAssignment(assignment)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            title="Edit assignment"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveAssignment(assignment.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            title="Remove assignment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Assignment Form */}
            {showAddForm && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Add Assignment to Lesson
                </h4>
                
                <div className="space-y-4">
                  <Select
                    label="Assignment Template"
                    value={addForm.assignment_template_id}
                    onChange={(e) => setAddForm({ ...addForm, assignment_template_id: parseInt(e.target.value) })}
                    required
                    options={[
                      { value: 0, label: 'Select an assignment template' },
                      ...availableTemplates.map(template => ({
                        value: template.id,
                        label: `${template.name} (${template.assignment_type})`
                      }))
                    ]}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      type="number"
                      label="Order in Lesson"
                      value={addForm.order_in_lesson}
                      onChange={(e) => setAddForm({ ...addForm, order_in_lesson: parseInt(e.target.value) })}
                      min={1}
                      required
                    />
                    
                    <Input
                      type="number"
                      label="Planned Duration (minutes)"
                      value={addForm.planned_duration_minutes}
                      onChange={(e) => setAddForm({ ...addForm, planned_duration_minutes: e.target.value })}
                      min={1}
                      placeholder="Optional"
                    />
                    
                    <Input
                      type="number"
                      label="Custom Max Points"
                      value={addForm.custom_max_points}
                      onChange={(e) => setAddForm({ ...addForm, custom_max_points: e.target.value })}
                      min={1}
                      placeholder="Optional"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_required"
                      checked={addForm.is_required}
                      onChange={(e) => setAddForm({ ...addForm, is_required: e.target.checked })}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_required" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                      Required assignment
                    </label>
                  </div>
                  
                  <TextArea
                    label="Custom Instructions"
                    value={addForm.custom_instructions}
                    onChange={(e) => setAddForm({ ...addForm, custom_instructions: e.target.value })}
                    rows={3}
                    placeholder="Optional custom instructions for this assignment in this lesson..."
                  />
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddAssignment}
                      disabled={!addForm.assignment_template_id}
                      className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Assignment
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AssignmentModalBase>
  )
}

export default ManageAssignmentsModal