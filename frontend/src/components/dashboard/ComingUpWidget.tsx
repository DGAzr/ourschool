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

/**
 * Student dashboard card: the next few planned lessons over the coming week,
 * linking to the full My Lessons schedule.
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { lessonsApi } from '../../services/lessons'
import { SubjectDot } from '../ui'
import { StudentLesson } from '../../types/lesson'
import { formatDateOnly } from '../../utils/formatters'
import { todayISO } from '../../utils/lessonPlanning'

const MAX_LESSONS = 5

const addDaysISO = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

const dayLabel = (iso: string, today: string): string => {
  if (iso === today) return 'Today'
  if (iso === addDaysISO(today, 1)) return 'Tomorrow'
  return formatDateOnly(iso, { weekday: 'short', month: 'short', day: 'numeric' })
}

const ComingUpWidget: React.FC = () => {
  const [lessons, setLessons] = useState<StudentLesson[]>([])
  const [loading, setLoading] = useState(true)

  const today = todayISO()

  useEffect(() => {
    lessonsApi
      .myLessons({ start_date: today, end_date: addDaysISO(today, 7) })
      .then(data => setLessons(data || []))
      .catch(() => setLessons([]))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const upcoming = lessons.filter(l => l.status !== 'taught').slice(0, MAX_LESSONS)

  return (
    <div className="bg-panel border border-line rounded-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-2">
        <h3 className="text-[15px] font-semibold text-ink">Coming up</h3>
        <Link to="/my-lessons" className="text-[12.5px] font-semibold text-accent hover:text-ink transition-colors">
          View all
        </Link>
      </div>
      {loading ? (
        <div className="py-8 text-center text-[13px] text-faint">Loading…</div>
      ) : upcoming.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[13.5px] font-semibold text-ink-2 mb-1">No lessons this week</p>
          <p className="text-[12.5px] text-faint">Planned lessons will show up here.</p>
        </div>
      ) : (
        <div className="p-3 space-y-1">
          {upcoming.map(lesson => (
            <Link
              key={lesson.id}
              to="/my-lessons"
              className="flex items-start gap-3 px-3 py-2.5 rounded-[9px] hover:bg-track transition-colors"
            >
              <SubjectDot color={lesson.subject?.color ?? '#74716A'} size={9} className="flex-none mt-[5px]" />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-ink leading-snug truncate">{lesson.title}</p>
                <p className="text-[12px] text-faint mt-0.5 flex items-center gap-1.5">
                  <span className={lesson.date === today ? 'text-accent font-semibold' : ''}>
                    {dayLabel(lesson.date, today)}
                  </span>
                  {lesson.duration_minutes && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> {lesson.duration_minutes}m
                      </span>
                    </>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default ComingUpWidget
