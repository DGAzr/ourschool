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
import { lessonsApi } from '../../../services/lessons'
import { Lesson, Subject, AssignmentTemplate, User } from '../../../types'

interface UseLessonDataReturn {
  // Data state
  lessons: Lesson[]
  subjects: Subject[]
  assignmentTemplates: AssignmentTemplate[]
  students: User[]
  
  // Loading state
  loading: boolean
  error: string | null
  
  // Filter state
  selectedSubject: number | null
  searchTerm: string
  expandedLessons: Set<number>
  
  // Actions
  setSelectedSubject: (id: number | null) => void
  setSearchTerm: (term: string) => void
  setExpandedLessons: (expanded: Set<number>) => void
  toggleLessonExpansion: (lessonId: number) => void
  refreshData: () => Promise<void>
  
  // Helper functions
  getFilteredLessons: () => Lesson[]
  getLocalDateString: () => string
}

export const useLessonData = (): UseLessonDataReturn => {
  // Data state
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [assignmentTemplates, setAssignmentTemplates] = useState<AssignmentTemplate[]>([])
  const [students, setStudents] = useState<User[]>([])
  
  // Loading state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter state
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set())

  // Helper function to get local date in YYYY-MM-DD format
  const getLocalDateString = useCallback(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  // Filter lessons based on search and subject
  const getFilteredLessons = useCallback(() => {
    return lessons.filter(lesson => {
      const matchesSearch = !searchTerm || 
        lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lesson.description && lesson.description.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesSubject = !selectedSubject || 
        (lesson.subjects && lesson.subjects.some(subject => subject.id === selectedSubject))
      
      return matchesSearch && matchesSubject
    })
  }, [lessons, searchTerm, selectedSubject])

  // Toggle lesson expansion
  const toggleLessonExpansion = useCallback((lessonId: number) => {
    setExpandedLessons(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(lessonId)) {
        newExpanded.delete(lessonId)
      } else {
        newExpanded.add(lessonId)
      }
      return newExpanded
    })
  }, [])

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [lessonsData, subjectsData, templatesData, studentsData] = await Promise.all([
        lessonsApi.getAll(selectedSubject ? { subject_id: selectedSubject } : {}),
        lessonsApi.getSubjects(),
        lessonsApi.getAssignmentTemplates(selectedSubject ? { subject_id: selectedSubject } : {}),
        lessonsApi.getStudents()
      ])
      setLessons(lessonsData)
      setSubjects(subjectsData)
      setAssignmentTemplates(templatesData)
      setStudents(studentsData)
      setError(null)
    } catch (err) {
      setError('Failed to load lessons data')
    } finally {
      setLoading(false)
    }
  }, [selectedSubject])

  const refreshData = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  // Load data when component mounts or when selectedSubject changes
  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    // Data state
    lessons,
    subjects,
    assignmentTemplates,
    students,
    
    // Loading state
    loading,
    error,
    
    // Filter state
    selectedSubject,
    searchTerm,
    expandedLessons,
    
    // Actions
    setSelectedSubject,
    setSearchTerm,
    setExpandedLessons,
    toggleLessonExpansion,
    refreshData,
    
    // Helper functions
    getFilteredLessons,
    getLocalDateString
  }
}