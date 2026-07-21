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

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

import { DayInfo } from '../../utils/lessonPlanning'
import { Lesson } from '../../types/lesson'
import DayColumn from './DayColumn'
import LessonCard from './LessonCard'

interface LessonBoardProps {
  days: DayInfo[]
  lessons: Lesson[]
  onAdd: (dateISO: string) => void
  onLessonClick: (lesson: Lesson) => void
  /**
   * Persist a drag: `dateISO` is the destination day and `orderedIds` is its
   * full top-to-bottom order (moved card included). Returns once persisted.
   */
  onReorder: (dateISO: string, orderedIds: number[]) => void
}

/** Prefix marking a droppable that is a day column (vs. a lesson card). */
const COLUMN_PREFIX = 'col:'

/** The horizontally-scrollable week board: one DayColumn per visible day. */
const LessonBoard: React.FC<LessonBoardProps> = ({
  days,
  lessons,
  onAdd,
  onLessonClick,
  onReorder,
}) => {
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)

  // Bucket lessons by ISO date, each column ordered by position (then id as a
  // stable tiebreaker) so optimistic reorders render in the new order.
  const byDate = useMemo(() => {
    const map = new Map<string, Lesson[]>()
    for (const lesson of lessons) {
      const list = map.get(lesson.date)
      if (list) list.push(lesson)
      else map.set(lesson.date, [lesson])
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.position - b.position || a.id - b.id)
    }
    return map
  }, [lessons])

  const lessonById = useMemo(() => {
    const map = new Map<number, Lesson>()
    for (const lesson of lessons) map.set(lesson.id, lesson)
    return map
  }, [lessons])

  // A small activation distance lets a plain click still open the editor while
  // a deliberate drag starts a sort.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const lesson = lessonById.get(Number(event.active.id))
    setActiveLesson(lesson ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLesson(null)
    const { active, over } = event
    if (!over) return

    const activeId = Number(active.id)
    const moved = lessonById.get(activeId)
    if (!moved || moved.status === 'taught') return

    // Resolve the destination day + the card we dropped onto (if any).
    const overId = String(over.id)
    let destDate: string
    let overLessonId: number | null = null
    if (overId.startsWith(COLUMN_PREFIX)) {
      destDate = overId.slice(COLUMN_PREFIX.length)
    } else {
      overLessonId = Number(over.id)
      const overLesson = lessonById.get(overLessonId)
      if (!overLesson) return
      destDate = overLesson.date
    }

    // Build the destination day's current order, minus the moved card.
    const destList = (byDate.get(destDate) ?? []).filter(
      (l) => l.id !== activeId
    )

    // Find the insertion index. Dropping on a card inserts before it; dropping
    // on the column (or an empty day) appends.
    let insertAt = destList.length
    if (overLessonId !== null) {
      const idx = destList.findIndex((l) => l.id === overLessonId)
      if (idx !== -1) insertAt = idx
    }

    const orderedIds = [
      ...destList.slice(0, insertAt).map((l) => l.id),
      activeId,
      ...destList.slice(insertAt).map((l) => l.id),
    ]

    // No-op if nothing actually changed (same day, same order).
    const current = (byDate.get(destDate) ?? []).map((l) => l.id)
    const unchanged =
      moved.date === destDate &&
      current.length === orderedIds.length &&
      current.every((id, i) => id === orderedIds[i])
    if (unchanged) return

    onReorder(destDate, orderedIds)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto -mx-1 px-1 pb-2">
        <div
          className="grid gap-3 items-start"
          style={{
            gridTemplateColumns: `repeat(${days.length}, minmax(168px, 1fr))`,
          }}
        >
          {days.map((day) => (
            <DayColumn
              key={day.iso}
              day={day}
              columnId={`${COLUMN_PREFIX}${day.iso}`}
              lessons={byDate.get(day.iso) ?? []}
              onAdd={onAdd}
              onLessonClick={onLessonClick}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeLesson ? (
          <LessonCard lesson={activeLesson} onClick={() => undefined} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export default LessonBoard
