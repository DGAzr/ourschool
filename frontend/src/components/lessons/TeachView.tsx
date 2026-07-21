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

import { Button, EmptyState, Spinner, useToast } from '../ui'
import { Subject } from '../../types'
import { Lesson } from '../../types/lesson'
import { useLessons } from '../../hooks/useLessons'
import { subjectTint, todayISO } from '../../utils/lessonPlanning'
import StudentAvatars from './StudentAvatars'
import TeachCard from './TeachCard'

interface TeachViewProps {
  subjects: Subject[]
  onLessonClick: (lesson: Lesson) => void
  /** The Week planner / Teach mode view switch, shown top-right of the header. */
  toggle?: React.ReactNode
}

/** The Teach-mode run-sheet for today, with student + subject filters. */
const TeachView: React.FC<TeachViewProps> = ({
  subjects,
  onLessonClick,
  toggle,
}) => {
  const today = todayISO()
  const { toast } = useToast()
  const { lessons, loading, markTaught, toggleMaterial } = useLessons({
    startDate: today,
    endDate: today,
  })

  const [studentFilter, setStudentFilter] = useState<number | null>(null)
  const [subjectFilter, setSubjectFilter] = useState<number | null>(null)

  // Filter options derived from today's lessons.
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

  // Overall readiness computed over ALL today's lessons, not the filtered set.
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

  const handleMarkTaught = async (lesson: Lesson) => {
    const ok = await markTaught(lesson)
    if (!ok) toast('Could not update the lesson.', 'danger')
  }

  const handleToggleMaterial = async (
    lessonId: number,
    materialId: number,
    isGathered: boolean
  ) => {
    const ok = await toggleMaterial(lessonId, materialId, isGathered)
    if (!ok) toast('Could not update the material.', 'danger')
  }

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const chipBase =
    'inline-flex items-center gap-1.5 px-[11px] py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors'

  return (
    <div className="mx-auto max-w-[760px]">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="uppercase text-[11px] font-bold tracking-wide text-accent">
            Teach mode · {dateLabel}
          </div>
          <h1 className="text-[27px] font-bold tracking-[-0.02em] text-ink mt-1">
            {allGathered ? 'Everything is gathered. Be present.' : 'Almost ready for today.'}
          </h1>
          <p className="text-[14px] text-muted mt-1">
            {allGathered
              ? "Today's materials are all set — focus on the teaching."
              : `${materialsRemaining} material${materialsRemaining === 1 ? '' : 's'} still to gather before you're set.`}
          </p>
        </div>
        {toggle}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : lessons.length === 0 ? (
        <EmptyState title="No lessons scheduled for today" subtext="Plan one from the Week planner." />
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
                No lessons match this filter today
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {filtered.map((lesson) => (
                <div key={lesson.id} onDoubleClick={() => onLessonClick(lesson)}>
                  <TeachCard
                    lesson={lesson}
                    onMarkTaught={handleMarkTaught}
                    onToggleMaterial={handleToggleMaterial}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default TeachView
