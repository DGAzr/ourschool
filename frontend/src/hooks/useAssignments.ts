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

  // No synchronous spinner toggle here: loading starts true for the initial
  // load, and user-triggered refreshes go through `refetch` below. State is
  // only set from promise callbacks, never synchronously.
  const fetchData = useCallback(() => {
    const load = isAdmin
      ? // Admin sees assignment templates and submitted assignments
        Promise.all([
          assignmentsApi.getAll({
            subject_id: selectedSubject || undefined,
            include_archived: includeArchived || undefined,
          }),
          subjectsApi.getAll(),
          assignmentsApi.getStudents(),
          // In grading mode, also fetch all assignments for admin control;
          // a failure here falls back to an empty list without failing the load
          adminViewMode === 'grading'
            ? assignmentsApi
                .getAllAssignmentsForGrading({ subject_id: selectedSubject || undefined })
                .catch(() => [] as StudentAssignment[])
            : Promise.resolve(null),
        ]).then(([templatesData, subjectsData, studentsData, allAssignmentsData]) => {
          setTemplates(templatesData || [])
          setSubjects(subjectsData || [])
          setStudents(studentsData || [])
          if (adminViewMode === 'grading') {
            setAllAssignments(allAssignmentsData || [])
          }
          setError(null)
        })
      : // Students see their assigned assignments
        Promise.all([
          assignmentsApi.getMyAssignments({ subject_id: selectedSubject || undefined }),
          subjectsApi.getAll(),
        ]).then(([assignmentsData, subjectsData]) => {
          setStudentAssignments(assignmentsData || [])
          setSubjects(subjectsData || [])
          setError(null)
        })

    return load
      .catch(() => {
        setError('Failed to load assignments. Please check your connection and ensure you are logged in.')

        // Set empty arrays as fallbacks
        setTemplates([])
        setStudentAssignments([])
        setAllAssignments([])
        setSubjects([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isAdmin, selectedSubject, adminViewMode, includeArchived])

  // User-triggered refresh: shows the loading spinner while refetching.
  const refetch = useCallback(async () => {
    setLoading(true)
    await fetchData()
  }, [fetchData])

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
    refetch,
    setTemplates,
    setError
  }
}
