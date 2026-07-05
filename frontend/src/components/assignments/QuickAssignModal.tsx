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
import { subjectsApi } from '../../services/subjects'
import { Subject, User } from '../../types'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { getErrorMessage } from '../../services/api'

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
        assignment_type: form.assignment_type,
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
    } catch (err) {
      if (templateId !== null) {
        assignmentsApi.delete(templateId).catch(() => {})
      }
      const msg: string = getErrorMessage(err, 'Failed to create and assign')
      setError(msg.toLowerCase().includes('active term') ? 'NO_ACTIVE_TERM' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Assign"
      subtitle="Create and assign in one step"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={loading || dataLoading}
            onClick={() => {
              const form = document.getElementById('quick-assign-form') as HTMLFormElement
              form?.requestSubmit()
            }}
          >
            Create & Assign
          </Button>
        </>
      }
    >
      <form id="quick-assign-form" onSubmit={handleSubmit} className="space-y-5">
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
      </form>
    </Modal>
  )
}

export default QuickAssignModal
