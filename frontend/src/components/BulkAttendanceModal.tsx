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
import { attendanceApi } from '../services/attendance'
import { AttendanceStatus, User } from '../types'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { getErrorMessage } from '../services/api'

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

// Outer shell remounts the content per open/close so all form state resets
// through its useState initializers (no reset-in-effect needed).
const BulkAttendanceModal: React.FC<BulkAttendanceModalProps> = (props) => (
  <BulkAttendanceModalContent key={props.isOpen ? 'open' : 'closed'} {...props} />
)

const BulkAttendanceModalContent: React.FC<BulkAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [students, setStudents] = useState<User[]>([])
  const [loading, setLoading] = useState(isOpen)
  const [error, setError] = useState<string | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])

  const [bulkRecord, setBulkRecord] = useState<{
    date: string
    status: AttendanceStatus
    notes: string
  }>({
    date: getLocalDateString(),
    status: 'present',
    notes: ''
  })

  useEffect(() => {
    if (!isOpen) return
    const fetchStudents = async () => {
      try {
        const data = await attendanceApi.getStudents()
        setStudents(data)
        setSelectedStudents(data.map((s: User) => s.id))
      } catch {
        setError('Failed to load students')
      } finally {
        setLoading(false)
      }
    }
    fetchStudents()
  }, [isOpen])

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
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to record attendance'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Attendance"
      subtitle="Record attendance for one or more students"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={loading || selectedStudents.length === 0}
            onClick={() => {
              const form = document.getElementById('bulk-attendance-form') as HTMLFormElement
              form?.requestSubmit()
            }}
          >
            Record Attendance{selectedStudents.length > 0 ? ` (${selectedStudents.length})` : ''}
          </Button>
        </>
      }
    >
      <form id="bulk-attendance-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px]">{error}</div>
        )}

        {/* Date + Status */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="bulk-attendance-date" className={LABEL}>Date</label>
            <input
              id="bulk-attendance-date"
              type="date"
              value={bulkRecord.date}
              onChange={e => setBulkRecord(r => ({ ...r, date: e.target.value }))}
              className={FIELD}
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="bulk-attendance-status" className={LABEL}>Status</label>
            <select
              id="bulk-attendance-status"
              value={bulkRecord.status}
              onChange={e => setBulkRecord(r => ({ ...r, status: e.target.value as AttendanceStatus }))}
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
          <label htmlFor="bulk-attendance-notes" className={LABEL}>Notes <span className="normal-case font-normal text-faint">(optional)</span></label>
          <textarea
            id="bulk-attendance-notes"
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

          {loading && students.length === 0 ? (
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
      </form>
    </Modal>
  )
}

export default BulkAttendanceModal
