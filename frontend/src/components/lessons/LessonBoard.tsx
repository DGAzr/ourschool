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
import LessonDrawer from './LessonDrawer'

interface LessonBoardProps {
  days: DayInfo[]
  lessons: Lesson[]
  drawerLessons: Lesson[]
  onAdd: (dateISO: string) => void
  onLessonClick: (lesson: Lesson) => void
  /**
   * Persist a drag: `dateISO` is the destination day and `orderedIds` is its
   * full top-to-bottom order (moved card included). Returns once persisted.
   */
  onReorder: (dateISO: string | null, orderedIds: number[]) => Promise<boolean>
  onSchedule: (lesson: Lesson, dateISO: string) => Promise<boolean>
  onToggleMaterial: (
    lessonId: number,
    materialId: number,
    isGathered: boolean
  ) => void
  onAddToDrawer: () => void
}

/** Prefix marking a droppable that is a day column (vs. a lesson card). */
const COLUMN_PREFIX = 'col:'
const DRAWER_COLUMN_ID = 'lesson-drawer'

/** The horizontally-scrollable week board: one DayColumn per visible day. */
const LessonBoard: React.FC<LessonBoardProps> = ({
  days,
  lessons,
  drawerLessons,
  onAdd,
  onLessonClick,
  onReorder,
  onSchedule,
  onToggleMaterial,
  onAddToDrawer,
}) => {
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
  const [optimisticLessons, setOptimisticLessons] = useState<Lesson[] | null>(null)
  const [drawerCollapsed, setDrawerCollapsed] = useState(false)
  const displayLessons = useMemo(
    () => optimisticLessons ?? [...lessons, ...drawerLessons],
    [optimisticLessons, lessons, drawerLessons],
  )

  // Bucket lessons by ISO date, each column ordered by position (then id as a
  // stable tiebreaker) so optimistic reorders render in the new order.
  const byDate = useMemo(() => {
    const map = new Map<string, Lesson[]>()
    for (const lesson of displayLessons) {
      if (lesson.date === null) continue
      const list = map.get(lesson.date)
      if (list) list.push(lesson)
      else map.set(lesson.date, [lesson])
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.position - b.position || a.id - b.id)
    }
    return map
  }, [displayLessons])

  const drawer = useMemo(
    () =>
      displayLessons
        .filter((lesson) => lesson.date === null)
        .sort((a, b) => a.position - b.position || a.id - b.id),
    [displayLessons]
  )

  const lessonById = useMemo(() => {
    const map = new Map<number, Lesson>()
    for (const lesson of displayLessons) map.set(lesson.id, lesson)
    return map
  }, [displayLessons])

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

  const moveLesson = async (
    moved: Lesson,
    destDate: string | null,
    overLessonId: number | null = null
  ) => {
    const destList = (destDate === null ? drawer : byDate.get(destDate) ?? []).filter(
      (lesson) => lesson.id !== moved.id
    )
    let insertAt = destList.length
    if (overLessonId !== null) {
      const idx = destList.findIndex((lesson) => lesson.id === overLessonId)
      if (idx !== -1) insertAt = idx
    }
    const orderedIds = [
      ...destList.slice(0, insertAt).map((lesson) => lesson.id),
      moved.id,
      ...destList.slice(insertAt).map((lesson) => lesson.id),
    ]
    const current = (destDate === null ? drawer : byDate.get(destDate) ?? []).map(
      (lesson) => lesson.id
    )
    const unchanged =
      moved.date === destDate &&
      current.length === orderedIds.length &&
      current.every((id, index) => id === orderedIds[index])
    if (unchanged) return

    const rank = new Map(orderedIds.map((id, index) => [id, index]))
    setOptimisticLessons(
      displayLessons.map((lesson) =>
        rank.has(lesson.id)
          ? { ...lesson, date: destDate, position: rank.get(lesson.id)! }
          : lesson
      )
    )
    await onReorder(destDate, orderedIds)
    setOptimisticLessons(null)
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
    let destDate: string | null
    let overLessonId: number | null = null
    if (overId === DRAWER_COLUMN_ID) {
      destDate = null
    } else if (overId.startsWith(COLUMN_PREFIX)) {
      destDate = overId.slice(COLUMN_PREFIX.length)
    } else {
      overLessonId = Number(over.id)
      const overLesson = lessonById.get(overLessonId)
      if (!overLesson) return
      destDate = overLesson.date
    }

    void moveLesson(moved, destDate, overLessonId)
  }

  const scheduleLesson = async (lesson: Lesson, date: string) => {
    const position = (byDate.get(date) ?? []).length
    setOptimisticLessons(
      displayLessons.map((item) =>
        item.id === lesson.id ? { ...item, date, position } : item
      )
    )
    await onSchedule(lesson, date)
    setOptimisticLessons(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={`grid grid-cols-1 gap-3 items-start transition-[grid-template-columns] duration-200 ${
          drawerCollapsed
            ? 'xl:grid-cols-[minmax(0,1fr)_44px]'
            : 'xl:grid-cols-[minmax(0,1fr)_260px]'
        }`}
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
                onStash={(lesson) => void moveLesson(lesson, null)}
              />
            ))}
          </div>
        </div>
        <LessonDrawer
          columnId={DRAWER_COLUMN_ID}
          lessons={drawer}
          visibleLessons={lessons}
          defaultDate={days[0]?.iso ?? ''}
          collapsed={drawerCollapsed}
          onCollapsedChange={setDrawerCollapsed}
          onAdd={onAddToDrawer}
          onLessonClick={onLessonClick}
          onSchedule={(lesson, date) => void scheduleLesson(lesson, date)}
          onToggleMaterial={onToggleMaterial}
        />
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
