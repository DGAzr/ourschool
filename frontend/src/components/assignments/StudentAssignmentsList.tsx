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
import StudentAssignmentCard from './StudentAssignmentCard'
import { StudentAssignment } from '../../types'

interface StudentAssignmentsListProps {
  assignments: StudentAssignment[]
  onStartAssignment: (assignmentId: number) => void
  onCompleteAssignment: (assignment: StudentAssignment) => void
}

const StudentAssignmentsList: React.FC<StudentAssignmentsListProps> = ({
  assignments,
  onStartAssignment,
  onCompleteAssignment
}) => {
  if (assignments.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Assignments Yet</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Your assignments will appear here once they're assigned by your teacher.</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">Check back soon or contact your teacher if you think you should have assignments.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {assignments.map(assignment => (
        <StudentAssignmentCard
          key={assignment.id}
          assignment={assignment}
          onStart={() => onStartAssignment(assignment.id)}
          onComplete={() => onCompleteAssignment(assignment)}
        />
      ))}
    </div>
  )
}

export default StudentAssignmentsList