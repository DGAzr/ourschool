/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui'
import TeachView from '../components/lessons/TeachView'
import LessonEditor from '../components/lessons/LessonEditor'
import { assignmentsApi } from '../services/assignments'
import { lessonsApi } from '../services/lessons'
import { subjectsApi } from '../services/subjects'
import { Subject, User } from '../types'
import { Lesson } from '../types/lesson'
import { useLessons } from '../hooks/useLessons'
import {
  calendarDateHref,
  useCalendarDateParam,
} from '../hooks/useCalendarDateParam'
import { todayISO } from '../utils/dates'

const TeachRunSheet: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [selectedDate, setSelectedDate] = useCalendarDateParam()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
  const {
    lessons,
    loading,
    error,
    refetch,
    markTaught,
    toggleMaterial,
  } = useLessons({ startDate: selectedDate, endDate: selectedDate })
  const latestRefetch = useRef(refetch)
  const rolloverStarted = useRef(false)

  useEffect(() => {
    latestRefetch.current = refetch
  }, [refetch])

  useEffect(() => {
    subjectsApi.getAll().then(setSubjects).catch(() => setSubjects([]))
    assignmentsApi.getStudents().then(setStudents).catch(() => setStudents([]))
  }, [])

  useEffect(() => {
    if (rolloverStarted.current) return
    rolloverStarted.current = true
    lessonsApi
      .rollover(todayISO())
      .then((result) => {
        result.warnings.forEach((warning) => toast(warning, 'danger'))
        if (result.moved_count > 0) void latestRefetch.current()
      })
      .catch(() => undefined)
  }, [toast])

  const handleMarkTaught = useCallback(
    async (lesson: Lesson) => {
      const ok = await markTaught(lesson)
      if (!ok) toast('Could not update the lesson.', 'danger')
    },
    [markTaught, toast]
  )

  const handleToggleMaterial = useCallback(
    async (lessonId: number, materialId: number, isGathered: boolean) => {
      const ok = await toggleMaterial(lessonId, materialId, isGathered)
      if (!ok) toast('Could not update the material.', 'danger')
    },
    [toast, toggleMaterial]
  )

  const handleEditorFinished = useCallback(
    (warnings: string[]) => {
      setEditingLesson(null)
      warnings.forEach((warning) => toast(warning, 'danger'))
      void refetch()
    },
    [refetch, toast]
  )

  return (
    <div>
      <TeachView
        subjects={subjects}
        selectedDate={selectedDate}
        lessons={lessons}
        loading={loading}
        error={error}
        onSelectDate={setSelectedDate}
        onEditLesson={setEditingLesson}
        onMarkTaught={(lesson) => void handleMarkTaught(lesson)}
        onToggleMaterial={(lessonId, materialId, isGathered) =>
          void handleToggleMaterial(lessonId, materialId, isGathered)
        }
        onOpenPlanner={() => navigate(calendarDateHref('/lessons', selectedDate))}
      />

      {editingLesson && (
        <LessonEditor
          key={editingLesson.id}
          initialDate={editingLesson.date}
          lesson={editingLesson}
          subjects={subjects}
          students={students}
          onClose={() => setEditingLesson(null)}
          onSaved={handleEditorFinished}
          onDeleted={handleEditorFinished}
        />
      )}
    </div>
  )
}

const Teach: React.FC = () => {
  const { user } = useAuth()

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-muted">
        Teaching tools are available to teachers only.
      </div>
    )
  }

  return <TeachRunSheet />
}

export default Teach
