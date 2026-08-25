/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  PackageCheck,
  Plus,
} from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { Lesson } from '../../types/lesson'
import { formatDateOnly } from '../../utils/formatters'
import LessonCard from './LessonCard'

interface LessonDrawerProps {
  columnId: string
  lessons: Lesson[]
  visibleLessons: Lesson[]
  defaultDate: string
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onAdd: () => void
  onLessonClick: (lesson: Lesson) => void
  onSchedule: (lesson: Lesson, date: string) => void
}

type DrawerTab = 'lessons' | 'materials'

interface MaterialSummary {
  gathered: number
  total: number
}

const materialSummary = (lessons: Lesson[]): MaterialSummary => {
  const materials = lessons.flatMap((lesson) => lesson.materials)
  return {
    gathered: materials.filter((material) => material.is_gathered).length,
    total: materials.length,
  }
}

interface MaterialsPanelProps {
  lessons: Lesson[]
  onLessonClick: (lesson: Lesson) => void
}

/** Compact prep checklist for the lessons in the active planner range. */
const MaterialsPanel: React.FC<MaterialsPanelProps> = ({ lessons, onLessonClick }) => {
  const lessonsWithMaterials = useMemo(
    () =>
      [...lessons]
        .filter((lesson) => lesson.materials.length > 0)
        .sort(
          (a, b) =>
            (a.date ?? '').localeCompare(b.date ?? '') ||
            a.position - b.position ||
            a.id - b.id
        ),
    [lessons]
  )
  const summary = useMemo(() => materialSummary(lessons), [lessons])

  if (lessonsWithMaterials.length === 0) {
    return (
      <div className="border border-dashed border-btn-border rounded-[10px] px-3 py-7 text-center text-[11.5px] text-faint">
        No materials are needed for the lessons in view.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-[9px] bg-track px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-ink">Gather list</span>
          <span className="font-mono text-muted">
            {summary.gathered} / {summary.total} ready
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-panel">
          <div
            className="h-full rounded-full bg-pos transition-[width]"
            style={{
              width: `${summary.total === 0 ? 0 : (summary.gathered / summary.total) * 100}%`,
            }}
          />
        </div>
      </div>

      {lessonsWithMaterials.map((lesson) => {
        const lessonSummary = materialSummary([lesson])
        return (
          <section
            key={lesson.id}
            className="rounded-[10px] border border-line bg-panel px-3 py-2.5"
          >
            <button
              type="button"
              onClick={() => onLessonClick(lesson)}
              className="w-full text-left"
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-faint">
                {formatDateOnly(lesson.date ?? undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="mt-0.5 flex items-start justify-between gap-2">
                <span className="text-[12.5px] font-semibold leading-snug text-ink">
                  {lesson.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted">
                  {lessonSummary.gathered}/{lessonSummary.total}
                </span>
              </span>
            </button>
            <ul className="mt-2 flex flex-col gap-1.5">
              {lesson.materials.map((material) => (
                <li
                  key={material.id}
                  className={`flex items-start gap-2 text-[11.5px] leading-snug ${
                    material.is_gathered ? 'text-faint' : 'text-ink'
                  }`}
                >
                  {material.is_gathered ? (
                    <Check
                      size={13}
                      aria-hidden="true"
                      className="mt-px shrink-0 text-pos-fg"
                    />
                  ) : (
                    <Circle
                      size={12}
                      aria-hidden="true"
                      className="mt-px shrink-0 text-accent"
                    />
                  )}
                  <span className={material.is_gathered ? 'line-through' : ''}>
                    {material.label}
                  </span>
                  <span className="sr-only">
                    {material.is_gathered ? 'Gathered' : 'Still needed'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** Persistent unscheduled-lesson rail and drawer drop target. */
const LessonDrawer: React.FC<LessonDrawerProps> = ({
  columnId,
  lessons,
  visibleLessons,
  defaultDate,
  collapsed,
  onCollapsedChange,
  onAdd,
  onLessonClick,
  onSchedule,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>('lessons')
  const [dates, setDates] = useState<Record<number, string>>({})
  const { setNodeRef, isOver } = useDroppable({ id: columnId })
  const materials = useMemo(() => materialSummary(visibleLessons), [visibleLessons])

  const activeCount =
    activeTab === 'lessons' ? lessons.length : materials.total - materials.gathered

  if (collapsed) {
    return (
      <aside
        ref={setNodeRef}
        className={`rounded-[12px] border min-w-0 transition-colors ${
          isOver ? 'border-accent bg-accent-soft' : 'border-line bg-panel-2'
        }`}
        aria-label={`Lesson Drawer, ${lessons.length} lessons`}
      >
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left xl:min-h-[120px] xl:flex-col xl:justify-start xl:px-2"
          aria-label="Expand Lesson Drawer"
          aria-expanded="false"
        >
          <span className="flex min-w-0 items-center gap-2 xl:flex-col">
            {activeTab === 'lessons' ? (
              <BookOpen size={14} className="shrink-0 text-ink" />
            ) : (
              <PackageCheck size={14} className="shrink-0 text-ink" />
            )}
            <span className="text-[13px] font-bold text-ink xl:sr-only">
              {activeTab === 'lessons' ? 'Lesson Drawer' : 'Materials Drawer'}
            </span>
            <span className="font-mono text-[10.5px] text-muted bg-track rounded-full px-2 py-0.5 xl:px-1.5">
              {activeCount}
            </span>
          </span>
          <ChevronDown size={14} className="shrink-0 xl:hidden" />
          <ChevronLeft size={14} className="hidden shrink-0 xl:block" />
        </button>
      </aside>
    )
  }

  return (
    <aside
      ref={setNodeRef}
      className={`rounded-[12px] border p-2.5 min-w-0 transition-colors ${
        isOver ? 'border-accent bg-accent-soft' : 'border-line bg-panel-2'
      }`}
      aria-label={`Lesson Drawer, ${lessons.length} lessons`}
    >
      <div className="flex items-center justify-between gap-2 px-1 mb-2">
        <span className="text-[13px] font-bold text-ink">Lesson Drawer</span>
        <div className="flex items-center gap-2">
          {activeTab === 'lessons' ? (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent"
            >
              <Plus size={13} /> New lesson
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onCollapsedChange(true)}
            className="inline-flex rounded-[6px] p-0.5 text-muted hover:bg-track hover:text-ink"
            aria-label="Collapse Lesson Drawer"
            aria-expanded="true"
          >
            <ChevronUp size={14} className="xl:hidden" />
            <ChevronRight size={14} className="hidden xl:block" />
          </button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Lesson drawer views"
        className="mb-2.5 grid grid-cols-2 rounded-[8px] bg-track p-0.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'lessons'}
          onClick={() => setActiveTab('lessons')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[11px] font-semibold ${
            activeTab === 'lessons'
              ? 'bg-panel text-ink shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          <BookOpen size={12} /> Lessons
          <span className="font-mono text-[9.5px]">{lessons.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'materials'}
          onClick={() => setActiveTab('materials')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[11px] font-semibold ${
            activeTab === 'materials'
              ? 'bg-panel text-ink shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          <PackageCheck size={12} /> Materials
          <span className="font-mono text-[9.5px]">
            {materials.total - materials.gathered}
          </span>
        </button>
      </div>

      {activeTab === 'lessons' ? (
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
      ) : (
        <MaterialsPanel lessons={visibleLessons} onLessonClick={onLessonClick} />
      )}
    </aside>
  )
}

export default LessonDrawer
