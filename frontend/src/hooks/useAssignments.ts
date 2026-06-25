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

import { useState, useEffect, useCallback } from 'react'
import { assignmentsApi } from '../services/assignments'
import { subjectsApi } from '../services/subjects'
import { AssignmentTemplate, Subject, User, StudentAssignment } from '../types'

interface UseAssignmentsProps {
  isAdmin: boolean
  adminViewMode: 'templates' | 'grading'
  selectedSubject: number | null
  includeArchived?: boolean
}

export const useAssignments = ({ isAdmin, adminViewMode, selectedSubject, includeArchived }: UseAssignmentsProps) => {
  const [templates, setTemplates] = useState<AssignmentTemplate[]>([])
  const [studentAssignments, setStudentAssignments] = useState<StudentAssignment[]>([])
  const [submittedAssignments] = useState<StudentAssignment[]>([])
  const [allAssignments, setAllAssignments] = useState<StudentAssignment[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      if (isAdmin) {
        // Admin sees assignment templates and submitted assignments
        const [templatesData, subjectsData, studentsData] = await Promise.all([
          assignmentsApi.getAll({
            subject_id: selectedSubject || undefined,
            include_archived: includeArchived || undefined,
          }),
          subjectsApi.getAll(),
          assignmentsApi.getStudents()
        ])

        setTemplates(templatesData || [])
        setSubjects(subjectsData || [])
        setStudents(studentsData || [])

        // If we're in grading mode, fetch all assignments for admin control
        if (adminViewMode === 'grading') {
          try {
            const allAssignmentsData = await assignmentsApi.getAllAssignmentsForGrading({
              subject_id: selectedSubject || undefined
            })
            setAllAssignments(allAssignmentsData || [])
          } catch (err) {
            setAllAssignments([])
          }
        }
      } else {
        // Students see their assigned assignments
        const assignmentsData = await assignmentsApi.getMyAssignments({
          subject_id: selectedSubject || undefined
        })
        setStudentAssignments(assignmentsData || [])

        const subjectsData = await subjectsApi.getAll()
        setSubjects(subjectsData || [])
      }
      
      setError(null)
    } catch (err) {
      setError('Failed to load assignments. Please check your connection and ensure you are logged in.')
      
      // Set empty arrays as fallbacks
      setTemplates([])
      setStudentAssignments([])
      setAllAssignments([])
      setSubjects([])
    } finally {
      setLoading(false)
    }
  }, [isAdmin, selectedSubject, adminViewMode, includeArchived])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    templates,
    studentAssignments,
    submittedAssignments,
    allAssignments,
    subjects,
    students,
    loading,
    error,
    refetch: fetchData,
    setTemplates,
    setError
  }
}
