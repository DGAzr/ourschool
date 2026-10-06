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

import { useState, useEffect } from 'react'
import { assignmentPage, templatePage, assignmentsApi } from '../services/assignments'
import { subjectsApi } from '../services/subjects'
import { AssignmentTemplate, Subject, User, StudentAssignment } from '../types'
import { usePagedData, useDebouncedSearch } from './usePagedData'

interface UseAssignmentsProps {
  isAdmin: boolean
  adminViewMode: 'templates' | 'grading'
  selectedSubject: number | null
  includeArchived?: boolean
  enabled?: boolean
  search?: string
  assignmentType?: string
  studentId?: number | null
  templateId?: number | null
  termId?: number | null
  termBasis?: 'assigned' | 'original_due' | 'effective'
  tab?: string
  dueTo?: string
  effectiveDue?: boolean
  activeStudents?: boolean
  includeUndated?: boolean
  today?: string
}

export const useAssignments = ({ isAdmin, adminViewMode, selectedSubject, includeArchived,
  enabled = true, search = '', assignmentType, studentId, templateId, termId,
  termBasis = 'effective', tab = 'all', dueTo, effectiveDue, activeStudents, includeUndated, today,
}: UseAssignmentsProps) => {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [metadata, setMetadata] = useState({ loaded: false, error: null as string | null })
  const [error, setError] = useState<string | null>(null)
  const settledSearch = useDebouncedSearch(search)
  const templatesMode = isAdmin && adminViewMode === 'templates'
  const templateData = usePagedData<AssignmentTemplate>({
    subject_id: selectedSubject, archived: !!includeArchived,
    search: settledSearch, assignment_type: assignmentType,
  }, templatePage, enabled && templatesMode)
  const assignmentData = usePagedData<StudentAssignment>({
    subject_id: selectedSubject, student_id: studentId, template_id: templateId,
    term_id: termId, term_basis: termBasis, student_view: !isAdmin, tab,
    search: settledSearch, assignment_type: assignmentType,
    due_to: dueTo, effective_due: effectiveDue, active_students: activeStudents, include_undated: includeUndated, today,
  }, assignmentPage, enabled && !templatesMode)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    Promise.all([subjectsApi.getAll(), isAdmin ? assignmentsApi.getStudents() : Promise.resolve([])])
      .then(([subjectData, studentData]) => {
        if (!cancelled) {
          setSubjects(subjectData); setStudents(studentData)
          setMetadata({ loaded: true, error: null })
        }
      }).catch(() => { if (!cancelled) setMetadata({ loaded: true, error: 'Unable to load students and subjects' }) })
    return () => { cancelled = true }
  }, [isAdmin, enabled])
  const page = templatesMode ? templateData : assignmentData
  return {
    templates: templateData.items,
    studentAssignments: isAdmin ? [] : assignmentData.items,
    submittedAssignments: [] as StudentAssignment[],
    allAssignments: isAdmin ? assignmentData.items : [],
    subjects, students,
    loading: enabled && (!metadata.loaded || page.loading),
    error: error ?? metadata.error ?? page.error,
    refetch: () => { setError(null); page.refetch() },
    setError, counts: page.counts, pagination: page.pagination, pageKey: page.pageKey,
  }
}
