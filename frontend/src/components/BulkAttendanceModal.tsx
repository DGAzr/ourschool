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
import { attendanceApi } from '../services/attendance'
import { User } from '../types'

interface BulkAttendanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest w-full'
const LABEL = 'block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5'

const getLocalDateString = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const BulkAttendanceModal: React.FC<BulkAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [students, setStudents] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])

  const [bulkRecord, setBulkRecord] = useState({
    date: getLocalDateString(),
    status: 'present' as const,
    notes: ''
  })

  useEffect(() => {
    if (isOpen) {
      fetchStudents()
      setBulkRecord({ date: getLocalDateString(), status: 'present' as const, notes: '' })
      setSelectedStudents([])
      setError(null)
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose() }
    if (isOpen) { document.addEventListener('keydown', handleEscape); return () => document.removeEventListener('keydown', handleEscape) }
  }, [isOpen, onClose])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const data = await attendanceApi.getStudents()
      setStudents(data)
      setSelectedStudents(data.map((s: User) => s.id))
    } catch {
      setError('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const toggleStudent = (id: number) => {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedStudents.length === 0) { setError('Please select at least one student'); return }

    try {
      setLoading(true)
      setError(null)
      await attendanceApi.createBulk({
        student_ids: selectedStudents,
        date: bulkRecord.date,
        status: bulkRecord.status,
        notes: bulkRecord.notes,
      })
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to record attendance')
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
            <h3 className="text-[15px] font-semibold text-ink">Quick Attendance</h3>
            <p className="text-[12px] text-muted mt-0.5">Record attendance for one or more students</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-faint hover:text-ink hover:bg-track transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {error && (
              <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px]">{error}</div>
            )}

            {/* Date + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Date</label>
                <input
                  type="date"
                  value={bulkRecord.date}
                  onChange={e => setBulkRecord(r => ({ ...r, date: e.target.value }))}
                  className={FIELD}
                  disabled={loading}
                />
              </div>
              <div>
                <label className={LABEL}>Status</label>
                <select
                  value={bulkRecord.status}
                  onChange={e => setBulkRecord(r => ({ ...r, status: e.target.value as any }))}
                  className={FIELD}
                  disabled={loading}
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={LABEL}>Notes <span className="normal-case font-normal text-faint">(optional)</span></label>
              <textarea
                value={bulkRecord.notes}
                onChange={e => setBulkRecord(r => ({ ...r, notes: e.target.value }))}
                rows={2}
                className={FIELD}
                placeholder="Optional notes for this attendance record…"
                disabled={loading}
              />
            </div>

            {/* Students */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={LABEL + ' mb-0'}>
                  Students{selectedStudents.length > 0 && <span className="font-normal normal-case text-faint ml-1">({selectedStudents.length} selected)</span>}
                </label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setSelectedStudents(students.map(s => s.id))} className="text-[12px] font-medium text-accent hover:opacity-80 transition-opacity">
                    Select all
                  </button>
                  <button type="button" onClick={() => setSelectedStudents([])} className="text-[12px] font-medium text-faint hover:text-muted transition-colors">
                    Clear
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-[13px] text-faint">Loading…</p>
                </div>
              ) : (
                <div className="border border-field-border rounded-field overflow-hidden max-h-52 overflow-y-auto divide-y divide-line">
                  {students.map(student => (
                    <label key={student.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-track transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="w-4 h-4 rounded accent-[var(--accent)]"
                        disabled={loading}
                      />
                      <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-semibold text-accent">
                          {student.first_name[0]}{student.last_name[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium text-ink">{student.first_name} {student.last_name}</p>
                        <p className="text-[11.5px] text-faint truncate">
                          {student.grade_level ? `${student.grade_level} · ` : ''}{student.email}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
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
              disabled={loading || selectedStudents.length === 0}
              className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Recording…
                </>
              ) : `Record Attendance${selectedStudents.length > 0 ? ` (${selectedStudents.length})` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BulkAttendanceModal
