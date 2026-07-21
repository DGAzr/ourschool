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
 * The student's read-only schedule: upcoming planned lessons grouped by day,
 * with linked work, resource links, and attached documents. Defaults to
 * today-forward through the active term; a toggle reaches back to the term
 * start for review.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Clock, ExternalLink, Paperclip } from 'lucide-react'
import { lessonsApi } from '../services/lessons'
import { termsApi } from '../services/terms'
import { SubjectDot } from '../components/ui'
import DocumentThumb from '../components/materials/DocumentThumb'
import DocumentViewerModal from '../components/materials/DocumentViewerModal'
import { kindBadge } from '../components/materials/materialsLogic'
import { StudentLesson } from '../types/lesson'
import { PaperlessMaterial } from '../types/paperless'
import { Term } from '../types/term'
import { formatDateOnly } from '../utils/formatters'
import { todayISO } from '../utils/lessonPlanning'

const addDaysISO = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

const dayHeading = (iso: string, today: string): string => {
  if (iso === today) return 'Today'
  if (iso === addDaysISO(today, 1)) return 'Tomorrow'
  return formatDateOnly(iso, { weekday: 'long', month: 'short', day: 'numeric' })
}

const MyLessons: React.FC = () => {
  const [lessons, setLessons] = useState<StudentLesson[]>([])
  const [activeTerm, setActiveTerm] = useState<Term | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingMaterial, setViewingMaterial] = useState<PaperlessMaterial | null>(null)

  const today = todayISO()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const term = await termsApi.getActive()
        const start = showPast && term ? term.start_date : undefined
        // Guard against a stale active term whose end date is already behind
        // us — that would make the range empty.
        const end =
          term?.end_date && term.end_date >= today ? term.end_date : addDaysISO(today, 14)
        const data = await lessonsApi.myLessons({ start_date: start, end_date: end })
        if (cancelled) return
        setActiveTerm(term)
        setLessons(data || [])
        setError(null)
      } catch {
        if (!cancelled) setError('Failed to load your lessons.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPast])

  // Group by date, preserving the API's (date, position) ordering.
  const days = useMemo(() => {
    const byDate = new Map<string, StudentLesson[]>()
    for (const lesson of lessons) {
      byDate.set(lesson.date, [...(byDate.get(lesson.date) ?? []), lesson])
    }
    return Array.from(byDate.entries())
  }, [lessons])

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold text-faint uppercase tracking-[.08em] mb-1.5">
            My schedule
          </p>
          <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em] leading-none">My Lessons</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {showPast && activeTerm
              ? `Everything planned since ${formatDateOnly(activeTerm.start_date, { month: 'short', day: 'numeric' })}.`
              : 'What your teacher has planned, starting today.'}
          </p>
        </div>
        {activeTerm && (
          <button
            onClick={() => setShowPast(p => !p)}
            className="h-[34px] px-3.5 text-[13px] font-semibold rounded-[8px] bg-panel border border-line text-muted hover:text-ink hover:bg-track transition-colors"
          >
            {showPast ? 'Hide past lessons' : 'Show past lessons'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin" />
        </div>
      ) : days.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-[15px] font-semibold text-ink-2 mb-1">No lessons on the schedule</p>
          <p className="text-[13px] text-faint">When your teacher plans lessons for you, they'll show up here.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {days.map(([date, dayLessons]) => (
            <section key={date}>
              <h2
                className={`text-[11px] font-semibold uppercase tracking-[.08em] mb-3 ${
                  date === today ? 'text-accent' : date < today ? 'text-faintest' : 'text-faint'
                }`}
              >
                {dayHeading(date, today)}
              </h2>
              <div className="space-y-3">
                {dayLessons.map(lesson => (
                  <div
                    key={lesson.id}
                    className={`bg-panel border border-line rounded-card-lg overflow-hidden ${
                      lesson.status === 'taught' ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="h-1" style={{ backgroundColor: lesson.subject?.color || 'var(--accent)' }} />
                    <div className="p-5">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <SubjectDot color={lesson.subject?.color ?? '#74716A'} size={9} className="flex-none" />
                          <h3 className="text-[15px] font-semibold text-ink truncate">{lesson.title}</h3>
                        </div>
                        {lesson.status === 'taught' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-pos-bg text-pos-fg border border-[var(--pos-fg)]/20 flex-shrink-0">
                            Done
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[12.5px] text-muted mb-2">
                        {lesson.subject && <span>{lesson.subject.name}</span>}
                        {lesson.duration_minutes && (
                          <>
                            {lesson.subject && <span className="text-faintest">·</span>}
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {lesson.duration_minutes} min
                            </span>
                          </>
                        )}
                      </div>

                      {lesson.objective && (
                        <p className="text-[13px] text-ink-2 leading-relaxed mb-3">{lesson.objective}</p>
                      )}

                      {/* Linked work */}
                      {lesson.templates.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-3">
                          <span className="text-[11px] font-semibold text-faint uppercase tracking-[.06em]">Work:</span>
                          {lesson.templates.map(link => (
                            <span
                              key={link.id}
                              className="inline-flex items-center px-2.5 py-1 rounded-full bg-accent-soft text-accent text-[12px] font-semibold"
                            >
                              {link.template?.name ?? 'Assignment'}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Resource links */}
                      {lesson.resources.length > 0 && (
                        <div className="flex gap-2 flex-wrap mb-3">
                          {lesson.resources.map(resource =>
                            resource.url ? (
                              <a
                                key={resource.id}
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-panel-2 border border-line rounded-[7px] text-[12px] text-accent hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {resource.label}
                              </a>
                            ) : (
                              <span
                                key={resource.id}
                                className="inline-flex items-center px-2.5 py-1.5 bg-panel-2 border border-line rounded-[7px] text-[12px] text-muted"
                              >
                                {resource.label}
                              </span>
                            )
                          )}
                        </div>
                      )}

                      {/* Attached documents */}
                      {lesson.paperless_materials.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] flex items-center gap-1">
                            <Paperclip className="w-3 h-3" /> Materials
                          </p>
                          {lesson.paperless_materials.map(material => (
                            <div
                              key={material.document_id}
                              className="flex items-center gap-3 px-3 py-2 bg-panel-2 border border-line rounded-field"
                            >
                              <DocumentThumb
                                externalId={material.external_id}
                                title={material.title}
                                className="w-[28px] h-[36px] flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-ink truncate">{material.title}</p>
                                <p className="font-mono text-[9.5px] text-faint tracking-wide">
                                  {kindBadge(material.material_kind)}
                                  {material.page_count ? ` · ${material.page_count} pp` : ''}
                                </p>
                              </div>
                              <button
                                onClick={() => setViewingMaterial(material)}
                                className="h-[28px] px-3 text-[12.5px] font-semibold rounded-[7px] bg-panel border border-line text-muted hover:text-ink hover:bg-track transition-colors flex-shrink-0"
                              >
                                View
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <DocumentViewerModal material={viewingMaterial} onClose={() => setViewingMaterial(null)} />
    </div>
  )
}

export default MyLessons
