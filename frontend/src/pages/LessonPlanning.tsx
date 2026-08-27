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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { Spinner, useToast } from '../components/ui'
import { subjectsApi } from '../services/subjects'
import { assignmentsApi } from '../services/assignments'
import { settingsApi } from '../services/settings'
import { Subject, User } from '../types'
import { Lesson } from '../types/lesson'
import { useLessons } from '../hooks/useLessons'
import { lessonsApi } from '../services/lessons'
import { getErrorMessage } from '../services/api'
import {
  DEFAULT_DAYS,
  clampDaysShown,
  generateDays,
  rangeLabel as formatRangeLabel,
  readiness as computeReadiness,
  stepRange,
  todayISO,
} from '../utils/lessonPlanning'
import PlannerHeader from '../components/lessons/PlannerHeader'
import ReadinessStrip from '../components/lessons/ReadinessStrip'
import LessonBoard from '../components/lessons/LessonBoard'
import LessonEditor from '../components/lessons/LessonEditor'
import {
  calendarDateHref,
  useCalendarDateParam,
} from '../hooks/useCalendarDateParam'
import { isValidISODate } from '../utils/dates'

const DAYS_STORAGE_KEY = 'lessonPlanning.daysShown'

type DrawerState =
  | { mode: 'create'; date: string | null }
  | { mode: 'edit'; lesson: Lesson }
  | null

const readStoredDays = (): number => {
  const raw = localStorage.getItem(DAYS_STORAGE_KEY)
  if (!raw) return DEFAULT_DAYS
  return clampDaysShown(Number(raw))
}

const LessonPlanningContent: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { toast } = useToast()
  const navigate = useNavigate()

  const [rangeStart, setRangeStart] = useCalendarDateParam()
  const [daysShown, setDaysShown] = useState<number>(() => readStoredDays())
  const [skipWeekends, setSkipWeekends] = useState<boolean>(true)

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [drawerLessons, setDrawerLessons] = useState<Lesson[]>([])

  // Persist the chosen day count.
  useEffect(() => {
    localStorage.setItem(DAYS_STORAGE_KEY, String(daysShown))
  }, [daysShown])

  // Load reference data + the org's skip_weekends setting.
  useEffect(() => {
    if (!isAdmin) return
    subjectsApi.getAll().then(setSubjects).catch(() => setSubjects([]))
    assignmentsApi.getStudents().then(setStudents).catch(() => setStudents([]))
    settingsApi
      .getGroupedSettings()
      .then((s) => setSkipWeekends(s.attendance.skip_weekends))
      .catch(() => undefined)
  }, [isAdmin])

  const days = useMemo(
    () => generateDays(rangeStart, daysShown, skipWeekends),
    [rangeStart, daysShown, skipWeekends]
  )

  const startDate = days[0]?.iso ?? rangeStart
  const endDate = days[days.length - 1]?.iso ?? rangeStart

  const { lessons, loading, error, refetch, toggleMaterial } = useLessons({
    startDate,
    endDate,
  })

  const refreshDrawer = useCallback(async () => {
    const data = await lessonsApi.drawer()
    setDrawerLessons(data || [])
  }, [])

  // Reconcile overdue lessons using the browser's school date, then load the
  // canonical drawer. The operation is idempotent, including StrictMode runs.
  useEffect(() => {
    if (!isAdmin) return
    lessonsApi
      .rollover(todayISO())
      .then((result) => {
        setDrawerLessons(result.lessons || [])
        result.warnings.forEach((warning) => toast(warning, 'danger'))
        if (result.moved_count > 0) void refetch()
      })
      .catch(() => refreshDrawer().catch(() => setDrawerLessons([])))
  }, [isAdmin, refetch, refreshDrawer, toast])

  const readiness = useMemo(() => computeReadiness(lessons), [lessons])
  const rangeLabel = useMemo(() => formatRangeLabel(days), [days])

  const handleStepRange = useCallback(
    (dir: 1 | -1) => {
      setRangeStart(stepRange(rangeStart, daysShown, skipWeekends, dir))
    },
    [daysShown, rangeStart, setRangeStart, skipWeekends]
  )

  const handleStepDays = useCallback((delta: 1 | -1) => {
    setDaysShown((prev) => clampDaysShown(prev + delta))
  }, [])

  const handleAdd = useCallback((dateISO: string) => {
    setDrawer({ mode: 'create', date: dateISO })
  }, [])

  const handleLessonClick = useCallback((lesson: Lesson) => {
    setDrawer({ mode: 'edit', lesson })
  }, [])

  const handleSaved = useCallback(
    (warnings: string[]) => {
      setDrawer(null)
      warnings.forEach((w) => toast(w, 'danger'))
      refetch()
      void refreshDrawer()
    },
    [refetch, refreshDrawer, toast]
  )

  const handleReorder = useCallback(
    async (dateISO: string | null, orderedIds: number[]): Promise<boolean> => {
      try {
        const result = await lessonsApi.reorder(dateISO, orderedIds)
        result.warnings.forEach((warning) => toast(warning, 'danger'))
        await Promise.all([refetch(), refreshDrawer()])
        return true
      } catch (err) {
        toast(getErrorMessage(err, 'Move failed — the change was undone.'), 'danger')
        return false
      }
    },
    [refetch, refreshDrawer, toast]
  )

  const handleSchedule = useCallback(
    async (lesson: Lesson, dateISO: string): Promise<boolean> => {
      try {
        const result = await lessonsApi.update(lesson.id, { date: dateISO })
        result.warnings.forEach((warning) => toast(warning, 'danger'))
        await Promise.all([refetch(), refreshDrawer()])
        return true
      } catch (err) {
        toast(getErrorMessage(err, 'Scheduling failed — the lesson stayed in the drawer.'), 'danger')
        return false
      }
    },
    [refetch, refreshDrawer, toast]
  )

  const handleToggleMaterial = useCallback(
    async (lessonId: number, materialId: number, isGathered: boolean) => {
      const ok = await toggleMaterial(lessonId, materialId, isGathered)
      if (!ok) toast('Could not update the material.', 'danger')
    },
    [toast, toggleMaterial]
  )

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted">
        Lesson planning is available to teachers only.
      </div>
    )
  }

  return (
    <div>
      <PlannerHeader
        rangeLabel={rangeLabel}
        selectedDate={rangeStart}
        daysShown={daysShown}
        skipWeekends={skipWeekends}
        onStepRange={handleStepRange}
        onSelectDate={setRangeStart}
        onStepDays={handleStepDays}
        onPlanLesson={() => handleAdd(rangeStart)}
        onOpenTeach={() => navigate(calendarDateHref('/teach', rangeStart))}
      />
      <ReadinessStrip readiness={readiness} />

      {error && (
        <div className="text-danger text-sm mb-4">{error}</div>
      )}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <LessonBoard
          days={days}
          lessons={lessons}
          drawerLessons={drawerLessons}
          onAdd={handleAdd}
          onLessonClick={handleLessonClick}
          onReorder={handleReorder}
          onSchedule={handleSchedule}
          onToggleMaterial={handleToggleMaterial}
          onAddToDrawer={() => setDrawer({ mode: 'create', date: null })}
        />
      )}

      {drawer && (
        <LessonEditor
          key={drawer.mode === 'edit' ? drawer.lesson.id : `create-${drawer.date}`}
          initialDate={drawer.mode === 'create' ? drawer.date : drawer.lesson.date}
          lesson={drawer.mode === 'edit' ? drawer.lesson : null}
          subjects={subjects}
          students={students}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
          onDeleted={handleSaved}
        />
      )}
    </div>
  )
}

const LessonPlanning: React.FC = () => {
  const [searchParams] = useSearchParams()
  if (searchParams.get('view') === 'teach') {
    const rawDate = searchParams.get('date')
    const date = isValidISODate(rawDate) ? rawDate : todayISO()
    return <Navigate to={calendarDateHref('/teach', date)} replace />
  }
  return <LessonPlanningContent />
}

export default LessonPlanning
