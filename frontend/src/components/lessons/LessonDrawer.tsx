/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { Lesson } from '../../types/lesson'
import { formatDateOnly } from '../../utils/formatters'
import LessonCard from './LessonCard'

interface LessonDrawerProps {
  columnId: string
  lessons: Lesson[]
  defaultDate: string
  onAdd: () => void
  onLessonClick: (lesson: Lesson) => void
  onSchedule: (lesson: Lesson, date: string) => void
}

/** Persistent unscheduled-lesson rail and drawer drop target. */
const LessonDrawer: React.FC<LessonDrawerProps> = ({
  columnId,
  lessons,
  defaultDate,
  onAdd,
  onLessonClick,
  onSchedule,
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const [dates, setDates] = useState<Record<number, string>>({})
  const { setNodeRef, isOver } = useDroppable({ id: columnId })

  return (
    <aside
      ref={setNodeRef}
      className={`rounded-[12px] border p-2.5 min-w-0 transition-colors ${
        isOver ? 'border-accent bg-accent-soft' : 'border-line bg-panel-2'
      }`}
      aria-label={`Lesson Drawer, ${lessons.length} lessons`}
    >
      <div className="flex items-center justify-between gap-2 px-1 mb-2">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="flex items-center gap-2 min-w-0 text-left"
          aria-expanded={!collapsed}
        >
          <span className="text-[13px] font-bold text-ink">Lesson Drawer</span>
          <span className="font-mono text-[10.5px] text-muted bg-track rounded-full px-2 py-0.5">
            {lessons.length}
          </span>
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent"
        >
          <Plus size={13} /> New lesson
        </button>
      </div>

      {!collapsed ? (
        <div className="flex flex-col gap-2.5 min-h-[72px]">
          <SortableContext
            items={lessons.map((lesson) => lesson.id)}
            strategy={verticalListSortingStrategy}
          >
            {lessons.map((lesson) => {
              const scheduleDate = dates[lesson.id] ?? defaultDate
              return (
                <div key={lesson.id} className="flex flex-col gap-1.5">
                  <LessonCard lesson={lesson} onClick={onLessonClick} />
                  {lesson.last_scheduled_date ? (
                    <p className="px-1 text-[10.5px] text-faint">
                      Was scheduled {formatDateOnly(lesson.last_scheduled_date, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      aria-label={`Schedule ${lesson.title}`}
                      value={scheduleDate}
                      onChange={(event) =>
                        setDates((previous) => ({
                          ...previous,
                          [lesson.id]: event.target.value,
                        }))
                      }
                      className="min-w-0 flex-1 bg-field-bg border border-field-border text-ink text-[11px] rounded-[7px] px-2 py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => scheduleDate && onSchedule(lesson, scheduleDate)}
                      className="text-[11px] font-semibold rounded-[7px] px-2 py-1.5 bg-accent text-white"
                    >
                      Schedule
                    </button>
                  </div>
                </div>
              )
            })}
          </SortableContext>
          {lessons.length === 0 ? (
            <div className="border border-dashed border-btn-border rounded-[10px] px-3 py-7 text-center text-[11.5px] text-faint">
              Drag lessons here to hold them for later.
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}

export default LessonDrawer
