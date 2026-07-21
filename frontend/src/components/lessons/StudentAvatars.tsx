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

import { LessonStudentSummary } from '../../types/lesson'
import { avatarColor, studentInitials } from '../../utils/lessonPlanning'

interface StudentAvatarsProps {
  students: LessonStudentSummary[]
  /** Diameter in px @default 18 */
  size?: number
}

/**
 * Overlapping initials-on-color circles. Users have no color field, so the
 * background is derived deterministically from the student id.
 */
const StudentAvatars: React.FC<StudentAvatarsProps> = ({ students, size = 18 }) => {
  if (students.length === 0) return null
  return (
    <div className="flex flex-row-reverse">
      {[...students].reverse().map((student, idx) => (
        <div
          key={student.id}
          title={`${student.first_name} ${student.last_name}`.trim() || student.username}
          className="rounded-full flex items-center justify-center font-semibold text-white ring-[1.5px] ring-panel"
          style={{
            width: size,
            height: size,
            marginRight: idx === students.length - 1 ? 0 : -5,
            backgroundColor: avatarColor(student.id),
            fontSize: Math.round(size * 0.42),
          }}
        >
          {studentInitials(student)}
        </div>
      ))}
    </div>
  )
}

export default StudentAvatars
