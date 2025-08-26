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
import { lessonsApi } from '../services/lessons'
import { AssignmentTemplate, Subject, Lesson, User, StudentAssignment } from '../types'

interface UseAssignmentsProps {
  isAdmin: boolean
  adminViewMode: 'templates' | 'grading'
  selectedSubject: number | null
  selectedLesson: number | null
}

export const useAssignments = ({ isAdmin, adminViewMode, selectedSubject, selectedLesson }: UseAssignmentsProps) => {
  const [templates, setTemplates] = useState<AssignmentTemplate[]>([])
  const [studentAssignments, setStudentAssignments] = useState<StudentAssignment[]>([])
  const [submittedAssignments, setSubmittedAssignments] = useState<StudentAssignment[]>([])
  const [allAssignments, setAllAssignments] = useState<StudentAssignment[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      if (isAdmin) {
        // Admin sees assignment templates and submitted assignments
        const [templatesData, subjectsData, lessonsData, studentsData] = await Promise.all([
          assignmentsApi.getAll({
            subject_id: selectedSubject || undefined,
            lesson_id: selectedLesson || undefined
          }),
          lessonsApi.getSubjects(),
          lessonsApi.getAll({
            subject_id: selectedSubject || undefined
          }),
          assignmentsApi.getStudents()
        ])
        
        setTemplates(templatesData || [])
        setSubjects(subjectsData || [])
        setLessons(lessonsData || [])
        setStudents(studentsData || [])

        // If we're in grading mode, fetch all assignments for admin control
        if (adminViewMode === 'grading') {
          try {
            // Fetch ALL assignments (not just submitted ones) for full admin control
            const allAssignmentsData = await assignmentsApi.getAllAssignmentsForGrading({
              subject_id: selectedSubject || undefined
            })
            setAllAssignments(allAssignmentsData || [])
            
            // Also fetch just submitted assignments for backward compatibility
            const submittedData = await assignmentsApi.getSubmittedAssignments({
              status: 'submitted',
              subject_id: selectedSubject || undefined
            })
            setSubmittedAssignments(submittedData || [])
          } catch (err) {
            setAllAssignments([])
            setSubmittedAssignments([])
          }
        }
      } else {
        // Students see their assigned assignments
        try {
          const assignmentsData = await assignmentsApi.getMyAssignments({
            subject_id: selectedSubject || undefined
          })
          setStudentAssignments(assignmentsData || [])
        } catch (err) {
          throw err
        }
        
        try {
          const subjectsData = await lessonsApi.getSubjects()
          setSubjects(subjectsData || [])
        } catch (err) {
          throw err
        }
      }
      
      setError(null)
    } catch (err) {
      setError('Failed to load assignments. Please check your connection and ensure you are logged in.')
      
      // Set empty arrays as fallbacks
      setTemplates([])
      setStudentAssignments([])
      setAllAssignments([])
      setSubjects([])
      setLessons([])
    } finally {
      setLoading(false)
    }
  }, [isAdmin, selectedLesson, selectedSubject, adminViewMode])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    templates,
    studentAssignments,
    submittedAssignments,
    allAssignments,
    subjects,
    lessons,
    students,
    loading,
    error,
    refetch: fetchData,
    setTemplates,
    setError
  }
}
