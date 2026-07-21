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

import React, { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

import { Button, Drawer, Pill, Spinner, SubjectDot, useToast } from '../ui'
import DocumentThumb from './DocumentThumb'
import { paperlessApi } from '../../services/paperless'
import { lessonsApi } from '../../services/lessons'
import { getErrorMessage } from '../../services/api'
import {
  PaperlessDocument,
  PaperlessDocumentDetail,
} from '../../types/paperless'
import { Subject } from '../../types/subject'
import { Lesson } from '../../types/lesson'
import {
  formatRelativeTime,
  groupLessonsByDate,
  kindBadge,
} from './materialsLogic'

interface DocumentDetailDrawerProps {
  doc: PaperlessDocument | null
  subjects: Subject[]
  onClose: () => void
  /** Called after a successful attach so the grid can refresh usage counts. */
  onAttached: () => void
}

const todayISO = () => new Date().toISOString().slice(0, 10)

/**
 * Right drawer opened from a Materials card: large preview, metadata grid,
 * "Attached to lessons" list, and an "Add to a lesson" popover listing
 * today's and all upcoming lessons, grouped by date.
 *
 * The outer component remounts the content per document so detail/popover
 * state starts fresh (ConfirmDialog pattern — no state-sync effect).
 */
const DocumentDetailDrawer: React.FC<DocumentDetailDrawerProps> = (props) =>
  props.doc ? <DrawerContent key={props.doc.id} {...props} doc={props.doc} /> : null

interface DrawerContentProps extends DocumentDetailDrawerProps {
  doc: PaperlessDocument
}

const DrawerContent: React.FC<DrawerContentProps> = ({
  doc,
  subjects,
  onClose,
  onAttached,
}) => {
  const { toast } = useToast()
  const [detail, setDetail] = useState<PaperlessDocumentDetail | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [upcomingLessons, setUpcomingLessons] = useState<Lesson[]>([])
  const [attachingId, setAttachingId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const subject = subjects.find((s) => s.id === doc.subject_id)

  useEffect(() => {
    paperlessApi
      .getDocument(doc.id)
      .then(setDetail)
      .catch(() => setDetail(null))
    // Today onward — an open-ended range (no end_date) returns all future
    // lessons so a material can be planned into any upcoming lesson.
    lessonsApi
      .list({ start_date: todayISO() })
      .then(setUpcomingLessons)
      .catch(() => setUpcomingLessons([]))
  }, [doc.id])

  const lessonGroups = groupLessonsByDate(upcomingLessons)

  // Close the popover on outside click.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const attachedLessonIds = new Set(
    (detail?.used_in ?? []).map((usage) => usage.lesson_id)
  )

  const handleAttach = async (lesson: Lesson) => {
    setAttachingId(lesson.id)
    try {
      await paperlessApi.attachToLesson(lesson.id, doc.id)
      toast(`Added to "${lesson.title}"`)
      const refreshed = await paperlessApi.getDocument(doc.id)
      setDetail(refreshed)
      onAttached()
    } catch (err) {
      toast(getErrorMessage(err, 'Could not attach document'), 'danger')
    } finally {
      setAttachingId(null)
    }
  }

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={doc.asn ? `ASN ${doc.asn}` : 'Document'}
      footer={
        <div ref={menuRef} className="relative w-full">
          {menuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-panel border border-line rounded-card shadow-menu p-1.5 animate-pop max-h-64 overflow-y-auto">
              {lessonGroups.length === 0 ? (
                <p className="px-3 py-2.5 text-[12.5px] text-faint">
                  No upcoming lessons planned.
                </p>
              ) : (
                lessonGroups.map((group) => (
                  <div key={group.date}>
                    <p className="px-3 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[.06em] text-faint">
                      {group.label}
                    </p>
                    {group.lessons.map((lesson) => {
                      const added = attachedLessonIds.has(lesson.id)
                      return (
                        <button
                          key={lesson.id}
                          disabled={added || attachingId !== null}
                          onClick={() => handleAttach(lesson)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left transition-colors ${
                            added ? 'cursor-default' : 'hover:bg-track/60'
                          }`}
                        >
                          <SubjectDot
                            color={lesson.subject?.color ?? undefined}
                            size={8}
                          />
                          <span className="flex-1 text-[13px] text-ink truncate">
                            {lesson.title}
                          </span>
                          {attachingId === lesson.id ? (
                            <Spinner size="sm" />
                          ) : (
                            <span
                              className={`text-[12px] font-semibold ${
                                added ? 'text-pos-fg' : 'text-accent'
                              }`}
                            >
                              {added ? 'Added' : 'Add'}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          )}
          <Button
            fullWidth
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Add to a lesson
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
          {/* Large preview */}
          <div className="flex justify-center pt-1">
            <DocumentThumb
              externalId={doc.external_id}
              title={doc.title}
              accentColor={subject?.color}
              className="w-[190px] h-[246px] shadow-float"
            />
          </div>

          <div>
            <h2 className="text-[18px] font-bold text-ink leading-snug">
              {doc.title}
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill text-[11px] font-semibold"
                style={{
                  color: subject?.color ?? 'var(--muted)',
                  background: subject?.color
                    ? `color-mix(in srgb, ${subject.color} 12%, transparent)`
                    : 'var(--track)',
                }}
              >
                <SubjectDot color={subject?.color ?? undefined} size={6} />
                {subject?.name ?? 'Unmapped'}
              </span>
              <Pill variant="neutral" className="font-mono tracking-wide">
                {kindBadge(doc.material_kind)}
              </Pill>
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-faint mb-0.5">
                Correspondent
              </p>
              <p className="text-ink-2">{doc.correspondent ?? '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-faint mb-0.5">
                Pages
              </p>
              <p className="text-ink-2">{doc.page_count ?? '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-faint mb-0.5">
                Added
              </p>
              <p className="text-ink-2">
                {doc.paperless_added
                  ? formatRelativeTime(doc.paperless_added)
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-faint mb-0.5">
                Used in
              </p>
              <p className="text-ink-2">
                {detail
                  ? `${detail.used_in.length} lesson${detail.used_in.length === 1 ? '' : 's'}`
                  : '…'}
              </p>
            </div>
          </div>

          {/* Attached to lessons */}
          {detail && detail.used_in.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-faint mb-2">
                Attached to lessons
              </p>
              <div className="space-y-1.5">
                {detail.used_in.map((usage) => {
                  const usageSubject = subjects.find(
                    (s) => s.id === usage.subject_id
                  )
                  return (
                    <div
                      key={usage.lesson_id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-[9px] bg-panel-2 border border-line-2"
                    >
                      <SubjectDot
                        color={usageSubject?.color ?? undefined}
                        size={8}
                      />
                      <span className="flex-1 text-[13px] text-ink truncate">
                        {usage.lesson_title}
                      </span>
                      <span className="font-mono text-[10.5px] text-faint">
                        {usage.date}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Attached to assignment templates */}
          {detail && detail.used_in_templates.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-faint mb-2">
                Attached to assignments
              </p>
              <div className="space-y-1.5">
                {detail.used_in_templates.map((usage) => (
                  <div
                    key={usage.template_id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-[9px] bg-panel-2 border border-line-2"
                  >
                    <span className="flex-1 text-[13px] text-ink truncate">
                      {usage.template_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
    </Drawer>
  )
}

export default DocumentDetailDrawer
