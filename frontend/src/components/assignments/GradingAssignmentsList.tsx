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
import { BookOpen } from 'lucide-react'

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
      <div className="text-center py-14 bg-panel border border-line rounded-card-lg">
        <BookOpen className="h-10 w-10 text-faintest mx-auto mb-3" />
        <p className="text-[14px] font-semibold text-ink mb-1">No Assignments to Grade</p>
        <p className="text-[13px] text-muted">All assignments are up to date!</p>
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
