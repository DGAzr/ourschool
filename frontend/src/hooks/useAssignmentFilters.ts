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

import { useState, useMemo } from 'react'
import { AssignmentTemplate, StudentAssignment } from '../types'

export const useAssignmentFilters = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['not_started', 'in_progress', 'submitted'])
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null)

  const filterTemplates = useMemo(() => {
    return (templates: AssignmentTemplate[]) => {
      return templates.filter(template => {
        const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             template.description?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesSubject = !selectedSubject || template.subject_id === selectedSubject
        const matchesLesson = !selectedLesson || template.lesson_id === selectedLesson
        const matchesType = !selectedType || template.assignment_type === selectedType
        
        return matchesSearch && matchesSubject && matchesLesson && matchesType
      })
    }
  }, [searchTerm, selectedSubject, selectedLesson, selectedType])

  const filterStudentAssignments = useMemo(() => {
    return (assignments: StudentAssignment[]) => {
      return assignments.filter(assignment => {
        const template = assignment.template
        const matchesSearch = template?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             template?.description?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesSubject = !selectedSubject || template?.subject_id === selectedSubject
        const matchesType = !selectedType || template?.assignment_type === selectedType
        
        return matchesSearch && matchesSubject && matchesType
      })
    }
  }, [searchTerm, selectedSubject, selectedType])

  const filterGradingAssignments = useMemo(() => {
    return (assignments: StudentAssignment[]) => {
      return assignments.filter(assignment => {
        const template = assignment.template
        const matchesSearch = template?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             template?.description?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesSubject = !selectedSubject || template?.subject_id === selectedSubject
        // Multi-select status filtering
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(assignment.status)
        // Student filtering
        const matchesStudent = !selectedStudent || assignment.student_id === selectedStudent
        
        return matchesSearch && matchesSubject && matchesStatus && matchesStudent
      })
    }
  }, [searchTerm, selectedSubject, selectedStatuses, selectedStudent])

  return {
    searchTerm,
    setSearchTerm,
    selectedSubject,
    setSelectedSubject,
    selectedLesson,
    setSelectedLesson,
    selectedType,
    setSelectedType,
    selectedDifficulty,
    setSelectedDifficulty,
    selectedStatuses,
    setSelectedStatuses,
    selectedStudent,
    setSelectedStudent,
    filterTemplates,
    filterStudentAssignments,
    filterGradingAssignments
  }
}
