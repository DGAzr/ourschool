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
      <div className="bg-panel border border-line rounded-card-lg p-6">
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-panel-2 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="h-6 w-6 text-faintest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-[14px] font-semibold text-ink mb-1">No Assignments Yet</p>
          <p className="text-[13px] text-muted mb-2">Your assignments will appear here once they're assigned by your teacher.</p>
          <p className="text-[12px] text-faint">Check back soon or contact your teacher if you think you should have assignments.</p>
        </div>
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