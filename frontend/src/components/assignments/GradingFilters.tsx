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
import { ASSIGNMENT_STATUS_COLORS, ASSIGNMENT_STATUSES } from '../../constants'

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
  searchTerm,
  setSearchTerm,
  selectedSubject,
  setSelectedSubject,
  selectedStudent,
  setSelectedStudent,
  selectedStatuses,
  onStatusToggle,
  onSelectAllStatuses,
  onSelectActiveStatuses,
  onClearAllStatuses,
  subjects,
  students
}) => {
  const isStatusSelected = (status: string) => selectedStatuses.includes(status)

  const statusOptions = [
    { 
      value: ASSIGNMENT_STATUSES.NOT_STARTED, 
      label: 'Not Started',
      selectedClasses: `${ASSIGNMENT_STATUS_COLORS.not_started.border} ${ASSIGNMENT_STATUS_COLORS.not_started.bg}`,
      checkboxClasses: ASSIGNMENT_STATUS_COLORS.not_started.checkbox
    },
    { 
      value: ASSIGNMENT_STATUSES.IN_PROGRESS, 
      label: 'In Progress',
      selectedClasses: `${ASSIGNMENT_STATUS_COLORS.in_progress.border} ${ASSIGNMENT_STATUS_COLORS.in_progress.bg}`,
      checkboxClasses: ASSIGNMENT_STATUS_COLORS.in_progress.checkbox
    },
    { 
      value: ASSIGNMENT_STATUSES.SUBMITTED, 
      label: 'Submitted',
      selectedClasses: `${ASSIGNMENT_STATUS_COLORS.submitted.border} ${ASSIGNMENT_STATUS_COLORS.submitted.bg}`,
      checkboxClasses: ASSIGNMENT_STATUS_COLORS.submitted.checkbox
    },
    { 
      value: ASSIGNMENT_STATUSES.GRADED, 
      label: 'Graded',
      selectedClasses: `${ASSIGNMENT_STATUS_COLORS.graded.border} ${ASSIGNMENT_STATUS_COLORS.graded.bg}`,
      checkboxClasses: ASSIGNMENT_STATUS_COLORS.graded.checkbox
    }
  ]

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 border border-gray-100 dark:border-gray-700">
      <div className="space-y-6">
        {/* Top Row - Search, Subject, Student */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Search Assignments</label>
            <input
              type="text"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Subject</label>
            <select
              value={selectedSubject || ''}
              onChange={(e) => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="">All Subjects</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Student</label>
            <select
              value={selectedStudent || ''}
              onChange={(e) => setSelectedStudent(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="">All Students</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter with Checkboxes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Assignment Status</label>
            <div className="flex space-x-2">
              <button
                onClick={onSelectActiveStatuses}
                className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium"
              >
                Active Only
              </button>
              <span className="text-xs text-gray-400">|</span>
              <button
                onClick={onSelectAllStatuses}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              >
                All
              </button>
              <span className="text-xs text-gray-400">|</span>
              <button
                onClick={onClearAllStatuses}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium"
              >
                None
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {statusOptions.map(status => (
              <label
                key={status.value}
                className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                  isStatusSelected(status.value)
                    ? status.selectedClasses + ' shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isStatusSelected(status.value)}
                  onChange={() => onStatusToggle(status.value)}
                  className={`mr-3 h-4 w-4 rounded ${status.checkboxClasses}`}
                />
                <span className={`text-sm font-medium ${
                  isStatusSelected(status.value)
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {status.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GradingFilters