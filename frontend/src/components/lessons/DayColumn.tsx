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

import { Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { DayInfo } from '../../utils/lessonPlanning'
import { Lesson } from '../../types/lesson'
import LessonCard from './LessonCard'

interface DayColumnProps {
  day: DayInfo
  /** Droppable id for this column (used when a card is dropped on empty space). */
  columnId: string
  lessons: Lesson[]
  onAdd: (dateISO: string) => void
  onLessonClick: (lesson: Lesson) => void
  onStash: (lesson: Lesson) => void
}

/** One board column: a day header, its lesson stack, and an "+ Add" affordance. */
const DayColumn: React.FC<DayColumnProps> = ({
  day,
  columnId,
  lessons,
  onAdd,
  onLessonClick,
  onStash,
}) => {
  // The whole column is a drop target so a card can land on an empty day.
  const { setNodeRef } = useDroppable({ id: columnId })
  const sortableIds = lessons.map((l) => l.id)
  const wrapperClass = day.isToday
    ? 'bg-panel-2 border border-accent-line'
    : day.isWeekend
      ? 'bg-panel-2 border border-line-2'
      : 'border border-transparent'

  const nameColor = day.isToday
    ? 'text-accent'
    : day.isWeekend
      ? 'text-faint'
      : 'text-ink'

  return (
    <div className={`rounded-[12px] px-2 py-2.5 ${wrapperClass}`}>
      <div className="flex items-start justify-between mb-2 px-1">
        <div>
          <div className={`text-[13px] font-bold leading-none ${nameColor}`}>
            {day.weekdayLabel}
          </div>
          <div className="font-mono text-[11.5px] text-faint mt-1">{day.dayNum}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {day.isToday && (
            <span className="uppercase text-[9.5px] font-bold tracking-wide px-[7px] py-0.5 rounded-full text-accent bg-accent-soft border border-accent-line">
              Today
            </span>
          )}
          {day.isWeekend && (
            <span className="uppercase text-[9.5px] font-bold tracking-wide px-[7px] py-0.5 rounded-full text-faint bg-track">
              Wknd
            </span>
          )}
        </div>
      </div>

      <div ref={setNodeRef} className="flex flex-col gap-[9px]">
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          {lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onClick={onLessonClick}
              onStash={onStash}
            />
          ))}
        </SortableContext>

        <button
          type="button"
          onClick={() => onAdd(day.iso)}
          className="w-full py-[9px] rounded-[10px] border border-dashed border-btn-border text-[12px] font-semibold text-faint hover:text-ink hover:border-faint transition-colors flex items-center justify-center gap-1"
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}

export default DayColumn
