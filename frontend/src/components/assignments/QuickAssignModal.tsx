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
import { X } from 'lucide-react'
import { assignmentsApi } from '../../services/assignments'
import { subjectsApi } from '../../services/subjects'
import { Subject, User } from '../../types'

interface QuickAssignModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const QuickAssignModal: React.FC<QuickAssignModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])

  const [form, setForm] = useState({
    name: '',
    subject_id: 0,
    assignment_type: 'homework',
    max_points: 100,
    due_date: '',
    assigned_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
      setForm({ name: '', subject_id: 0, assignment_type: 'homework', max_points: 100, due_date: '', assigned_date: new Date().toISOString().split('T')[0] })
      setSelectedStudents([])
      setError(null)
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose() }
    if (isOpen) { document.addEventListener('keydown', handleEscape); return () => document.removeEventListener('keydown', handleEscape) }
  }, [isOpen, onClose])

  const loadData = async () => {
    try {
      setDataLoading(true)
      const [subjectsData, studentsData] = await Promise.all([
        subjectsApi.getAll(),
        assignmentsApi.getStudents(),
      ])
      setSubjects(subjectsData)
      setStudents(studentsData)
    } catch {
      setError('Failed to load form data')
    } finally {
      setDataLoading(false)
    }
  }

  const toggleStudent = (id: number) => {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Assignment name is required'); return }
    if (!form.subject_id) { setError('Please select a subject'); return }
    if (selectedStudents.length === 0) { setError('Please select at least one student'); return }

    try {
      setLoading(true)
      setError(null)
      const template = await assignmentsApi.create({
        name: form.name,
        subject_id: form.subject_id,
        assignment_type: form.assignment_type as any,
        max_points: form.max_points,
        is_exportable: false,
      })
      await assignmentsApi.assignToStudents({
        template_id: template.id,
        student_ids: selectedStudents,
        due_date: form.due_date || undefined,
        assigned_date: form.assigned_date || undefined,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create and assign')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Assign</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">Create and assign in one step</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            {dataLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assignment Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Chapter 5 Review"
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject <span className="text-red-500">*</span></label>
                    <select
                      value={form.subject_id}
                      onChange={e => setForm(f => ({ ...f, subject_id: parseInt(e.target.value) }))}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      disabled={loading}
                    >
                      <option value={0}>Select subject…</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                    <select
                      value={form.assignment_type}
                      onChange={e => setForm(f => ({ ...f, assignment_type: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      disabled={loading}
                    >
                      <option value="homework">Homework</option>
                      <option value="project">Project</option>
                      <option value="test">Test</option>
                      <option value="quiz">Quiz</option>
                      <option value="essay">Essay</option>
                      <option value="worksheet">Worksheet</option>
                      <option value="reading">Reading</option>
                      <option value="practice">Practice</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Points</label>
                    <input
                      type="number"
                      min={1}
                      value={form.max_points}
                      onChange={e => setForm(f => ({ ...f, max_points: parseInt(e.target.value) || 100 }))}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign Date</label>
                  <input
                    type="date"
                    value={form.assigned_date}
                    onChange={e => setForm(f => ({ ...f, assigned_date: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    The date this assignment was given (defaults to today)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Students <span className="text-red-500">*</span>
                    {selectedStudents.length > 0 && (
                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-normal">
                        {selectedStudents.length} selected
                      </span>
                    )}
                  </label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-md divide-y divide-gray-200 dark:divide-gray-600 max-h-40 overflow-y-auto">
                    {students.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-500">No students found</p>
                    ) : students.map(student => (
                      <label key={student.id} className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleStudent(student.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                          disabled={loading}
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {student.first_name} {student.last_name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex space-x-3">
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
              disabled={loading || dataLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating & Assigning…' : 'Create & Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default QuickAssignModal
