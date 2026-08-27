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

import { CSSProperties, useMemo, useState } from 'react'

import { Button, EmptyState, Spinner } from '../ui'
import { Subject } from '../../types'
import { Lesson } from '../../types/lesson'
import { subjectTint, todayISO } from '../../utils/lessonPlanning'
import { parseISO } from '../../utils/dates'
import StudentAvatars from './StudentAvatars'
import TeachCard from './TeachCard'

interface TeachViewProps {
  subjects: Subject[]
  selectedDate: string
  lessons: Lesson[]
  loading: boolean
  error: string | null
  onSelectDate: (date: string) => void
  onEditLesson: (lesson: Lesson) => void
  onMarkTaught: (lesson: Lesson) => void
  onToggleMaterial: (
    lessonId: number,
    materialId: number,
    isGathered: boolean
  ) => void
  onOpenPlanner: () => void
}

/** The Teach run-sheet for one day, with student and subject filters. */
const TeachView: React.FC<TeachViewProps> = ({
  subjects,
  selectedDate,
  lessons,
  loading,
  error,
  onSelectDate,
  onEditLesson,
  onMarkTaught,
  onToggleMaterial,
  onOpenPlanner,
}) => {
  const [studentFilterState, setStudentFilterState] = useState<{
    date: string
    value: number | null
  }>({ date: selectedDate, value: null })
  const [subjectFilterState, setSubjectFilterState] = useState<{
    date: string
    value: number | null
  }>({ date: selectedDate, value: null })
  const studentFilter =
    studentFilterState.date === selectedDate ? studentFilterState.value : null
  const subjectFilter =
    subjectFilterState.date === selectedDate ? subjectFilterState.value : null
  const setStudentFilter = (value: number | null) =>
    setStudentFilterState({ date: selectedDate, value })
  const setSubjectFilter = (value: number | null) =>
    setSubjectFilterState({ date: selectedDate, value })

  // Filter options derived from the selected day's lessons.
  const studentOptions = useMemo(() => {
    const map = new Map<number, Lesson['students'][number]>()
    for (const lesson of lessons) {
      for (const student of lesson.students) map.set(student.id, student)
    }
    return [...map.values()]
  }, [lessons])

  const subjectOptions = useMemo(() => {
    const ids = new Set<number>()
    for (const lesson of lessons) {
      if (lesson.subject_id != null) ids.add(lesson.subject_id)
    }
    return subjects.filter((s) => ids.has(s.id))
  }, [lessons, subjects])

  const filtered = useMemo(
    () =>
      lessons.filter((lesson) => {
        if (studentFilter != null && !lesson.students.some((s) => s.id === studentFilter)) {
          return false
        }
        if (subjectFilter != null && lesson.subject_id !== subjectFilter) return false
        return true
      }),
    [lessons, studentFilter, subjectFilter]
  )

  // Overall readiness is computed over every lesson that day, not the filtered set.
  const materialsRemaining = useMemo(
    () =>
      lessons.reduce(
        (sum, lesson) =>
          sum + lesson.materials.filter((m) => !m.is_gathered).length,
        0
      ),
    [lessons]
  )
  const allGathered = materialsRemaining === 0

  const filterActive = studentFilter != null || subjectFilter != null
  const clearFilters = () => {
    setStudentFilter(null)
    setSubjectFilter(null)
  }

  const dateLabel = parseISO(selectedDate).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const isToday = selectedDate === todayISO()
  const dayReference = isToday ? 'today' : dateLabel

  const chipBase =
    'inline-flex items-center gap-1.5 px-[11px] py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors'

  return (
    <div className="mx-auto max-w-[760px]">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="uppercase text-[11px] font-bold tracking-wide text-accent">
            Teach · {dateLabel}
          </div>
          <h1 className="text-[27px] font-bold tracking-[-0.02em] text-ink mt-1">
            {allGathered
              ? `Everything is gathered for ${dayReference}.`
              : `Almost ready for ${dayReference}.`}
          </h1>
          <p className="text-[14px] text-muted mt-1">
            {allGathered
              ? `Materials for ${dayReference} are all set — focus on the teaching.`
              : `${materialsRemaining} material${materialsRemaining === 1 ? '' : 's'} still to gather before you're set.`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button variant="outline" size="sm" onClick={onOpenPlanner}>
            Plan lessons
          </Button>
          <input
            type="date"
            aria-label="Choose teaching date"
            value={selectedDate}
            onChange={(event) => {
              if (!event.target.value) return
              onSelectDate(event.target.value)
            }}
            className="bg-field-bg border border-field-border text-ink text-[12.5px] rounded-[8px] px-2.5 py-1.5"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <div role="alert" className="rounded-[10px] border border-danger-line bg-danger-soft px-4 py-3 text-sm text-ink-2">
          {error}
        </div>
      ) : lessons.length === 0 ? (
        <EmptyState
          title={`No lessons scheduled for ${dateLabel}`}
          subtext="Choose another day or plan lessons for this date."
          action={
            <Button variant="primary" size="sm" onClick={onOpenPlanner}>
              Plan lessons
            </Button>
          }
        />
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 mb-[18px] pb-4 border-b border-line-2">
            {/* Students */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="uppercase text-[10.5px] font-bold tracking-wide text-faint">
                Student
              </span>
              <button
                type="button"
                onClick={() => setStudentFilter(null)}
                className={`${chipBase} ${
                  studentFilter == null
                    ? 'border-accent-line bg-accent-soft text-ink'
                    : 'border-line bg-panel text-muted hover:text-ink'
                }`}
              >
                All
              </button>
              {studentOptions.map((student) => {
                const active = studentFilter === student.id
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setStudentFilter(active ? null : student.id)}
                    className={`${chipBase} pl-1.5 ${
                      active
                        ? 'border-accent-line bg-accent-soft text-ink'
                        : 'border-line bg-panel text-muted hover:text-ink'
                    }`}
                  >
                    <StudentAvatars students={[student]} size={18} />
                    {student.first_name}
                  </button>
                )
              })}
            </div>

            {/* Subjects */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="uppercase text-[10.5px] font-bold tracking-wide text-faint">
                Subject
              </span>
              <button
                type="button"
                onClick={() => setSubjectFilter(null)}
                className={`${chipBase} ${
                  subjectFilter == null
                    ? 'border-accent-line bg-accent-soft text-ink'
                    : 'border-line bg-panel text-muted hover:text-ink'
                }`}
              >
                All subjects
              </button>
              {subjectOptions.map((subject) => {
                const active = subjectFilter === subject.id
                const tint = subjectTint(subject.color) as CSSProperties
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => setSubjectFilter(active ? null : subject.id)}
                    style={
                      active
                        ? {
                            ...tint,
                            backgroundColor: 'var(--subject-soft)',
                            borderColor: 'var(--subject-line)',
                            color: 'var(--subject-ink)',
                          }
                        : undefined
                    }
                    className={`${chipBase} ${
                      active ? '' : 'border-line bg-panel text-muted hover:text-ink'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: active
                          ? 'var(--subject-ink)'
                          : subject.color,
                      }}
                    />
                    {subject.name}
                  </button>
                )
              })}
            </div>

            {filterActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-[12.5px] font-semibold text-accent"
              >
                Clear · {filtered.length} of {lessons.length}
              </button>
            )}
          </div>

          {/* Lesson list */}
          {filtered.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-btn-border px-5 py-[46px] text-center">
              <p className="text-[13.5px] text-muted mb-3">
                No lessons match this filter on {dateLabel}
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {filtered.map((lesson) => (
                <TeachCard
                  key={lesson.id}
                  lesson={lesson}
                  onEdit={onEditLesson}
                  onMarkTaught={onMarkTaught}
                  onToggleMaterial={onToggleMaterial}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default TeachView
