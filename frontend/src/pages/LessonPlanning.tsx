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
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { SegmentedControl, Spinner, useToast } from '../components/ui'
import { subjectsApi } from '../services/subjects'
import { assignmentsApi } from '../services/assignments'
import { settingsApi } from '../services/settings'
import { Subject, User } from '../types'
import { Lesson } from '../types/lesson'
import { useLessons } from '../hooks/useLessons'
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
import TeachView from '../components/lessons/TeachView'

type PlannerView = 'planner' | 'teach'

const DAYS_STORAGE_KEY = 'lessonPlanning.daysShown'

type DrawerState =
  | { mode: 'create'; date: string }
  | { mode: 'edit'; lesson: Lesson }
  | null

const readStoredDays = (): number => {
  const raw = localStorage.getItem(DAYS_STORAGE_KEY)
  if (!raw) return DEFAULT_DAYS
  return clampDaysShown(Number(raw))
}

const LessonPlanning: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { toast } = useToast()

  // ?view=teach deep-links straight to the run-sheet (Dashboard "Needs you").
  const [searchParams] = useSearchParams()
  const [view, setView] = useState<PlannerView>(
    searchParams.get('view') === 'teach' ? 'teach' : 'planner'
  )
  const [rangeStart, setRangeStart] = useState<string>(() => todayISO())
  const [daysShown, setDaysShown] = useState<number>(() => readStoredDays())
  const [skipWeekends, setSkipWeekends] = useState<boolean>(true)

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [drawer, setDrawer] = useState<DrawerState>(null)

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

  const { lessons, loading, error, refetch, reorder } = useLessons({
    startDate,
    endDate,
  })

  const readiness = useMemo(() => computeReadiness(lessons), [lessons])
  const rangeLabel = useMemo(() => formatRangeLabel(days), [days])

  const handleStepRange = useCallback(
    (dir: 1 | -1) => {
      setRangeStart((prev) => stepRange(prev, daysShown, skipWeekends, dir))
    },
    [daysShown, skipWeekends]
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
    },
    [refetch, toast]
  )

  const handleReorder = useCallback(
    (dateISO: string, orderedIds: number[]) => {
      reorder(dateISO, orderedIds).then((warnings) =>
        warnings.forEach((w) => toast(w, 'danger'))
      )
    },
    [reorder, toast]
  )

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted">
        Lesson planning is available to teachers only.
      </div>
    )
  }

  const viewToggle = (
    <SegmentedControl<PlannerView>
      segments={[
        { value: 'planner', label: 'Week planner' },
        { value: 'teach', label: 'Teach mode' },
      ]}
      value={view}
      onChange={setView}
    />
  )

  return (
    <div>
      {view === 'planner' ? (
        <>
          <PlannerHeader
            rangeLabel={rangeLabel}
            daysShown={daysShown}
            skipWeekends={skipWeekends}
            onStepRange={handleStepRange}
            onStepDays={handleStepDays}
            onPlanLesson={() => handleAdd(todayISO())}
            toggle={viewToggle}
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
              onAdd={handleAdd}
              onLessonClick={handleLessonClick}
              onReorder={handleReorder}
            />
          )}
        </>
      ) : (
        <TeachView
          subjects={subjects}
          onLessonClick={handleLessonClick}
          toggle={viewToggle}
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

export default LessonPlanning
