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
import GradingAssignmentCard from './GradingAssignmentCard'
import { StudentAssignment, User } from '../../types'

interface GradingAssignmentsListProps {
  assignments: StudentAssignment[]
  students: User[]
  onGradeAssignment: (assignment: StudentAssignment) => void
  onEditAssignment: (assignment: StudentAssignment) => void
  onArchiveAssignment: (assignment: StudentAssignment) => void
  onDeleteAssignment: (assignment: StudentAssignment) => void
  onUpdateAssignmentStatus: (assignmentId: number, status: string) => void
}

const GradingAssignmentsList: React.FC<GradingAssignmentsListProps> = ({
  assignments,
  students,
  onGradeAssignment,
  onEditAssignment,
  onArchiveAssignment,
  onDeleteAssignment,
  onUpdateAssignmentStatus
}) => {
  if (assignments.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Assignments to Grade</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">All assignments are up to date!</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">Assignments will appear here when students submit their work or when you need to review their progress.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {assignments.map(assignment => (
        <GradingAssignmentCard
          key={assignment.id}
          assignment={assignment}
          student={students.find(s => s.id === assignment.student_id)}
          onGrade={() => onGradeAssignment(assignment)}
          onEdit={() => onEditAssignment(assignment)}
          onArchive={() => onArchiveAssignment(assignment)}
          onDelete={() => onDeleteAssignment(assignment)}
          onUpdateStatus={(assignmentId, status) => onUpdateAssignmentStatus(assignmentId, status)}
        />
      ))}
    </div>
  )
}

export default GradingAssignmentsList