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

const today = () => new Date().toISOString().split('T')[0]

const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest w-full'
const LABEL = 'block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5'

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
    assigned_date: today(),
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
      setForm({ name: '', subject_id: 0, assignment_type: 'homework', max_points: 100, due_date: '', assigned_date: today() })
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

  const toggleAll = () => {
    setSelectedStudents(prev => prev.length === students.length ? [] : students.map(s => s.id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Assignment name is required'); return }
    if (!form.subject_id) { setError('Please select a subject'); return }
    if (selectedStudents.length === 0) { setError('Please select at least one student'); return }

    let templateId: number | null = null
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
      templateId = template.id
      await assignmentsApi.assignToStudents({
        template_id: template.id,
        student_ids: selectedStudents,
        due_date: form.due_date || undefined,
        assigned_date: form.assigned_date || undefined,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      if (templateId !== null) {
        assignmentsApi.delete(templateId).catch(() => {})
      }
      const msg: string = err.message || 'Failed to create and assign'
      setError(msg.toLowerCase().includes('active term') ? 'NO_ACTIVE_TERM' : msg)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-panel border border-line rounded-card-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Quick Assign</h3>
            <p className="text-[12px] text-muted mt-0.5">Create and assign in one step</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-faint hover:text-ink hover:bg-track transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {error && (
              <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px] leading-relaxed">
                {error === 'NO_ACTIVE_TERM' ? (
                  <>
                    <span className="font-semibold">No active term.</span>{' '}
                    Assignments require an active school term. Go to{' '}
                    <a href="/settings" className="underline font-semibold hover:opacity-80" onClick={onClose}>
                      Settings → Terms
                    </a>{' '}
                    to set one.
                  </>
                ) : error}
              </div>
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
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className={FIELD}
                    placeholder="e.g., Chapter 5 Review"
                    disabled={loading}
                    autoFocus
                  />
                </div>

                {/* Subject + Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Subject <span className="text-neg-fg normal-case">*</span></label>
                    <select
                      value={form.subject_id}
                      onChange={e => setForm(f => ({ ...f, subject_id: parseInt(e.target.value) }))}
                      className={FIELD}
                      disabled={loading}
                    >
                      <option value={0}>Select…</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Type</label>
                    <select
                      value={form.assignment_type}
                      onChange={e => setForm(f => ({ ...f, assignment_type: e.target.value }))}
                      className={FIELD}
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

                {/* Points + Assignment Date + Due Date */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL}>Max Points</label>
                    <input
                      type="number"
                      min={1}
                      value={form.max_points}
                      onChange={e => setForm(f => ({ ...f, max_points: parseInt(e.target.value) || 100 }))}
                      className={FIELD}
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Assignment Date</label>
                    <input
                      type="date"
                      value={form.assigned_date}
                      onChange={e => setForm(f => ({ ...f, assigned_date: e.target.value }))}
                      className={FIELD}
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Due Date</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                      className={FIELD}
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Students */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={LABEL + ' mb-0'}>
                      Students <span className="text-neg-fg normal-case">*</span>
                    </label>
                    {students.length > 1 && (
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-[12px] font-medium text-accent hover:opacity-80 transition-opacity"
                      >
                        {selectedStudents.length === students.length ? 'Deselect all' : 'Select all'}
                      </button>
                    )}
                  </div>
                  <div className="border border-field-border rounded-field overflow-hidden max-h-44 overflow-y-auto divide-y divide-line">
                    {students.length === 0 ? (
                      <p className="px-3 py-2.5 text-[13px] text-faint">No students found</p>
                    ) : students.map(student => (
                      <label
                        key={student.id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-track transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleStudent(student.id)}
                          className="w-4 h-4 rounded accent-[var(--accent)]"
                          disabled={loading}
                        />
                        <span className="text-[13.5px] text-ink">
                          {student.first_name} {student.last_name}
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedStudents.length > 0 && (
                    <p className="text-[11.5px] text-muted mt-1.5">{selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line bg-panel-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-[34px] px-4 text-[13px] font-semibold text-muted hover:text-ink transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || dataLoading}
              className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Creating…
                </>
              ) : 'Create & Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default QuickAssignModal
