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
import { assignmentsApi } from '../../services/assignments'
import { AssignmentTemplate, User, StudentAssignment } from '../../types'
import { formatDateOnly } from '../../utils/formatters'

interface AssignTemplateModalProps {
  template: AssignmentTemplate
  students: User[]
  onClose: () => void
  onSuccess: () => void
}

const AssignTemplateModal: React.FC<AssignTemplateModalProps> = ({ 
  template, 
  students, 
  onClose, 
  onSuccess 
}) => {
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])
  const [assignedStudents, setAssignedStudents] = useState<StudentAssignment[]>([])
  const [dueDate, setDueDate] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [customMaxPoints, setCustomMaxPoints] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [unassignLoading, setUnassignLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'assign' | 'manage'>('assign')

  // Fetch assigned students when modal opens
  useEffect(() => {
    const fetchAssignedStudents = async () => {
      try {
        const assignments = await assignmentsApi.getTemplateAssignments(template.id)
        setAssignedStudents(assignments)
        // Set active tab based on whether there are active assignments (not completed ones)
        const activeAssignments = assignments.filter(assignment => 
          !['submitted', 'graded', 'excused'].includes(assignment.status)
        )
        if (activeAssignments.length > 0) {
          setActiveTab('manage')
        }
      } catch (err) {
        // Failed to fetch assigned students
      }
    }
    
    fetchAssignedStudents()
  }, [template.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Only handle form submission on assign tab
    if (activeTab !== 'assign') {
      return
    }
    
    if (selectedStudents.length === 0) {
      setError('Please select at least one student')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const assignmentData = {
        template_id: template.id,
        student_ids: selectedStudents,
        due_date: dueDate || undefined,
        custom_instructions: customInstructions || undefined,
        custom_max_points: customMaxPoints || undefined
      }
      
      await assignmentsApi.assignToStudents(assignmentData)
      
      // Refresh the assigned students list and switch to manage tab
      const assignments = await assignmentsApi.getTemplateAssignments(template.id)
      setAssignedStudents(assignments)
      setSelectedStudents([])
      setActiveTab('manage')
      
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to assign template to students')
    } finally {
      setLoading(false)
    }
  }

  const handleUnassign = async (assignmentId: number) => {
    try {
      setUnassignLoading(true)
      setError(null)
      await assignmentsApi.deleteStudentAssignment(assignmentId)
      
      // Refresh assigned students list
      const assignments = await assignmentsApi.getTemplateAssignments(template.id)
      setAssignedStudents(assignments)
      
      // If no more active assignments, switch to assign tab
      const activeAssignments = assignments.filter(assignment => 
        !['submitted', 'graded', 'excused'].includes(assignment.status)
      )
      if (activeAssignments.length === 0) {
        setActiveTab('assign')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unassign student')
    } finally {
      setUnassignLoading(false)
    }
  }

  const toggleStudent = (studentId: number) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  // All students are available for assignment (templates can be assigned multiple times)
  const availableStudents = students

  // Filter to only show active assignments (not completed ones)
  const activeAssignments = assignedStudents.filter(assignment => 
    !['submitted', 'graded', 'excused'].includes(assignment.status)
  )

  const toggleAllStudents = () => {
    if (selectedStudents.length === availableStudents.length) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(availableStudents.map(s => s.id))
    }
  }

  const getStudentName = (studentId: number) => {
    const student = students.find(s => s.id === studentId)
    return student ? `${student.first_name} ${student.last_name}` : 'Unknown Student'
  }

  const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-full'
  const LABEL = 'block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-panel border border-line rounded-card-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-line">
            <h3 className="text-[15px] font-semibold text-ink">Manage Template Assignment</h3>
            <p className="text-[13px] text-muted mt-0.5">
              "{template.name}" — {activeAssignments.length} active assignment{activeAssignments.length !== 1 ? 's' : ''}
            </p>

            <div className="flex mt-4 gap-1 bg-panel-2 border border-line rounded-field p-1">
              {(['assign', 'manage'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded-[6px] transition-colors ${
                    activeTab === tab ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  {tab === 'assign' ? `Assign to Students (${availableStudents.length})` : `Manage Assigned (${activeAssignments.length})`}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 py-4 space-y-5">
            {error && (
              <div className="bg-neg-bg border border-neg-fg/20 text-neg-fg px-4 py-3 rounded-field text-[13px]">
                {error}
              </div>
            )}

            {activeTab === 'assign' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Due Date (Optional)</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={FIELD} />
                  </div>
                  <div>
                    <label className={LABEL}>Custom Max Points (Optional)</label>
                    <input
                      type="number" min="1" max="1000"
                      value={customMaxPoints || ''}
                      onChange={(e) => setCustomMaxPoints(e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder={`Default: ${template.max_points}`}
                      className={FIELD}
                    />
                  </div>
                </div>

                <div>
                  <label className={LABEL}>Custom Instructions (Optional)</label>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={3}
                    className={FIELD}
                    placeholder="Any specific instructions for this assignment..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={LABEL}>Select Students ({selectedStudents.length} of {availableStudents.length} selected)</label>
                    {availableStudents.length > 0 && (
                      <button type="button" onClick={toggleAllStudents} className="text-[11px] text-accent hover:underline">
                        {selectedStudents.length === availableStudents.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className="border border-line rounded-field max-h-48 overflow-y-auto">
                    {availableStudents.length === 0 ? (
                      <div className="p-4 text-center text-[13px] text-muted">No students available</div>
                    ) : (
                      availableStudents.map((student) => {
                        const studentActive = assignedStudents.filter(a =>
                          a.student_id === student.id && !['submitted', 'graded', 'excused'].includes(a.status)
                        )
                        return (
                          <label key={student.id} className="flex items-center p-3 hover:bg-panel-2 cursor-pointer border-b border-line last:border-b-0">
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(student.id)}
                              onChange={() => toggleStudent(student.id)}
                              className="h-3.5 w-3.5 accent-[var(--accent)] rounded"
                            />
                            <span className="ml-3 text-[13px] text-ink flex-1">{student.first_name} {student.last_name}</span>
                            {studentActive.length > 0 && (
                              <span className="text-[11px] text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                                Active ({studentActive.length})
                              </span>
                            )}
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Currently Assigned Students</p>
                <div className="border border-line rounded-field max-h-64 overflow-y-auto">
                  {activeAssignments.length === 0 ? (
                    <div className="p-4 text-center text-[13px] text-muted">No active assignments for this template</div>
                  ) : (
                    activeAssignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 border-b border-line last:border-b-0">
                        <div className="flex-1">
                          <p className="text-[13px] font-medium text-ink">{getStudentName(assignment.student_id)}</p>
                          <p className="text-[11px] text-muted">
                            {assignment.status} · Assigned: {formatDateOnly(assignment.assigned_date, { month: 'short', day: 'numeric' })}
                            {assignment.due_date && ` · Due: ${formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric' })}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnassign(assignment.id)}
                          disabled={unassignLoading}
                          className="ml-3 px-3 py-1 text-[12px] font-medium text-neg-fg bg-neg-bg border border-neg-fg/20 rounded-field hover:opacity-80 disabled:opacity-50 transition-opacity"
                        >
                          {unassignLoading ? 'Removing…' : 'Unassign'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-line flex justify-end gap-3">
            <button
              type="button" onClick={onClose} disabled={loading || unassignLoading}
              className="px-4 py-2 text-[13px] font-medium text-ink border border-btn-border bg-panel rounded-field hover:bg-track disabled:opacity-50"
            >
              {activeTab === 'manage' ? 'Done' : 'Cancel'}
            </button>
            {activeTab === 'assign' && (
              <button
                type="submit" disabled={loading || selectedStudents.length === 0}
                className="px-4 py-2 text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg rounded-field hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Assigning…' : `Assign to ${selectedStudents.length} Student${selectedStudents.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default AssignTemplateModal