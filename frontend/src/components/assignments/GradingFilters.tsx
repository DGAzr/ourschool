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
import { Subject, User } from '../../types'
import { ASSIGNMENT_STATUSES } from '../../constants'

const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-full'
const LABEL = 'block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5'

interface GradingFiltersProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedSubject: number | null
  setSelectedSubject: (id: number | null) => void
  selectedStudent: number | null
  setSelectedStudent: (id: number | null) => void
  selectedStatuses: string[]
  onStatusToggle: (status: string) => void
  onSelectAllStatuses: () => void
  onSelectActiveStatuses: () => void
  onClearAllStatuses: () => void
  subjects: Subject[]
  students: User[]
}

const GradingFilters: React.FC<GradingFiltersProps> = ({
  searchTerm, setSearchTerm,
  selectedSubject, setSelectedSubject,
  selectedStudent, setSelectedStudent,
  selectedStatuses, onStatusToggle,
  onSelectAllStatuses, onSelectActiveStatuses, onClearAllStatuses,
  subjects, students
}) => {
  const statusOptions = [
    { value: ASSIGNMENT_STATUSES.NOT_STARTED, label: 'Not Started' },
    { value: ASSIGNMENT_STATUSES.IN_PROGRESS,  label: 'In Progress' },
    { value: ASSIGNMENT_STATUSES.SUBMITTED,    label: 'Submitted' },
    { value: ASSIGNMENT_STATUSES.GRADED,       label: 'Graded' },
  ]

  const STATUS_ACTIVE: Record<string, string> = {
    not_started: 'bg-panel-2 border-line text-muted',
    in_progress:  'bg-accent/10 border-accent/30 text-accent',
    submitted:    'bg-pos-bg border-pos-fg/20 text-pos-fg',
    graded:       'bg-accent/10 border-accent/30 text-accent',
  }

  return (
    <div className="bg-panel border border-line rounded-card-lg p-5 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={LABEL}>Search Assignments</label>
          <input
            type="text"
            placeholder="Search by name or description…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL}>Subject</label>
          <select
            value={selectedSubject || ''}
            onChange={(e) => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
            className={FIELD}
          >
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Student</label>
          <select
            value={selectedStudent || ''}
            onChange={(e) => setSelectedStudent(e.target.value ? parseInt(e.target.value) : null)}
            className={FIELD}
          >
            <option value="">All Students</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={LABEL}>Status</label>
          <div className="flex gap-3">
            <button onClick={onSelectActiveStatuses} className="text-[11px] text-accent hover:underline">Active only</button>
            <span className="text-faintest">·</span>
            <button onClick={onSelectAllStatuses} className="text-[11px] text-muted hover:text-ink">All</button>
            <span className="text-faintest">·</span>
            <button onClick={onClearAllStatuses} className="text-[11px] text-muted hover:text-ink">None</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(s => {
            const active = selectedStatuses.includes(s.value)
            return (
              <label
                key={s.value}
                className={`flex items-center gap-2 px-3 py-2 border rounded-field cursor-pointer transition-colors text-[12px] font-medium ${
                  active ? STATUS_ACTIVE[s.value] ?? 'bg-panel-2 border-line text-muted' : 'border-line text-muted hover:border-field-border hover:text-ink'
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onStatusToggle(s.value)}
                  className="h-3.5 w-3.5 accent-[var(--accent)] rounded"
                />
                {s.label}
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default GradingFilters
