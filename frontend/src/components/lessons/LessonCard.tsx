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

import { CSSProperties } from 'react'
import { Paperclip } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Lesson, LessonSubjectSummary, LessonTemplateLink } from '../../types/lesson'
import { prepLabel, subjectTint } from '../../utils/lessonPlanning'
import StudentAvatars from './StudentAvatars'

interface LessonCardProps {
  lesson: Lesson
  onClick: (lesson: Lesson) => void
  /** True when rendered inside the DragOverlay (a static, non-sortable clone). */
  overlay?: boolean
}

const STATUS_PILL: Record<
  Lesson['status'],
  { label: string; className: string }
> = {
  ready: { label: 'Ready', className: 'text-pos-fg bg-pos-bg' },
  planned: { label: 'Planning', className: 'text-muted bg-track' },
  taught: { label: 'Taught ✓', className: 'text-faint bg-track' },
}

/** A single planned lesson tile within a day column. */
const LessonCard: React.FC<LessonCardProps> = ({ lesson, onClick, overlay }) => {
  const subject: LessonSubjectSummary | null | undefined = lesson.subject
  // Only links whose template still exists (SET NULL leaves dangling links).
  const templateLinks = lesson.templates.filter((l) => l.template)
  const tint = subjectTint(subject?.color) as CSSProperties
  const prep = prepLabel(lesson)
  const status = STATUS_PILL[lesson.status]
  const taught = lesson.status === 'taught'

  const prepColor =
    prep === 'Materials ready'
      ? 'text-pos-fg'
      : prep === 'No prep'
        ? 'text-faint'
        : 'text-accent'

  // Taught lessons are locked: not draggable, and skipped as sort targets.
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id, disabled: taught || overlay })

  const dragStyle: CSSProperties = overlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        // Hide the original while its overlay clone follows the cursor.
        opacity: isDragging ? 0 : undefined,
      }

  return (
    <button
      ref={overlay ? undefined : setNodeRef}
      type="button"
      onClick={() => onClick(lesson)}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      style={{
        ...tint,
        ...dragStyle,
        borderLeftColor: 'var(--subject-ink)',
      }}
      className={[
        'w-full text-left bg-panel border border-line border-l-[3px] rounded-[11px]',
        'px-3 py-2.5 flex flex-col gap-[7px] transition-shadow hover:shadow-sm',
        taught ? 'opacity-[0.62]' : '',
        taught ? '' : 'cursor-grab active:cursor-grabbing',
        overlay ? 'shadow-lg cursor-grabbing' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        {subject && (
          <span
            className="uppercase text-[10px] font-bold tracking-wide truncate"
            style={{ color: 'var(--subject-ink)' }}
          >
            {subject.name}
          </span>
        )}
        <div className="ml-auto">
          <StudentAvatars students={lesson.students} size={18} />
        </div>
      </div>

      <div className="text-[13.5px] font-semibold text-ink leading-snug">
        {lesson.title}
      </div>

      <div className="flex items-center gap-1.5 text-[11px]">
        {lesson.duration_minutes ? (
          <span className="font-mono text-faint">{lesson.duration_minutes}m</span>
        ) : null}
        {lesson.duration_minutes ? <span className="text-faintest">·</span> : null}
        <span className={`inline-flex items-center gap-1 ${prepColor}`}>
          <span
            className="w-[5px] h-[5px] rounded-full"
            style={{ backgroundColor: 'currentColor' }}
          />
          {prep}
        </span>
        {(lesson.paperless_materials?.length ?? 0) > 0 && (
          <>
            <span className="text-faintest">·</span>
            <span
              className="inline-flex items-center gap-0.5 text-faint"
              title={`${lesson.paperless_materials.length} attached document${
                lesson.paperless_materials.length === 1 ? '' : 's'
              }`}
            >
              <Paperclip size={10} />
              {lesson.paperless_materials.length}
            </span>
          </>
        )}
      </div>

      {templateLinks.length > 0 && (
        <div className="flex flex-col gap-1">
          {templateLinks.map((link: LessonTemplateLink) => (
            <div
              key={link.id}
              className="flex items-center gap-1.5 rounded-[7px] px-2 py-1"
              style={{ backgroundColor: 'var(--subject-soft)' }}
            >
              <span
                className="uppercase text-[9.5px] font-bold tracking-wide"
                style={{ color: 'var(--subject-ink)' }}
              >
                {link.template!.assignment_type}
              </span>
              <span
                className="text-[11.5px] font-semibold truncate"
                style={{ color: 'var(--subject-ink)' }}
              >
                {link.template!.name}
              </span>
            </div>
          ))}
        </div>
      )}

      <div>
        <span
          className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${status.className}`}
        >
          {status.label}
        </span>
      </div>
    </button>
  )
}

export default LessonCard
