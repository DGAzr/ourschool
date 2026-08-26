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

import { CSSProperties, useState } from 'react'
import { ArrowUpRight, FileText } from 'lucide-react'

import { Button } from '../ui'
import MarkdownRenderer from '../common/MarkdownRenderer'
import DocumentViewerModal from '../materials/DocumentViewerModal'
import {
  Lesson,
  LessonMaterial,
  LessonResource,
  LessonTemplateLink,
  LessonTemplateSummary,
} from '../../types/lesson'
import { PaperlessMaterial } from '../../types/paperless'
import { subjectTint } from '../../utils/lessonPlanning'
import LessonTemplateDetailModal from './LessonTemplateDetailModal'
import StudentAvatars from './StudentAvatars'

interface TeachCardProps {
  lesson: Lesson
  onMarkTaught: (lesson: Lesson) => void
  onToggleMaterial: (
    lessonId: number,
    materialId: number,
    isGathered: boolean
  ) => void
}

/** A single run-sheet card for Teach mode. */
const TeachCard: React.FC<TeachCardProps> = ({
  lesson,
  onMarkTaught,
  onToggleMaterial,
}) => {
  const tint = subjectTint(lesson.subject?.color) as CSSProperties
  const taught = lesson.status === 'taught'
  // Only links whose template still exists (SET NULL leaves dangling links).
  const templateLinks = lesson.templates.filter((l) => l.template)
  // Attached Paperless documents open in the in-app viewer mid-lesson.
  const paperlessDocs = lesson.paperless_materials ?? []
  const [viewingMaterial, setViewingMaterial] =
    useState<PaperlessMaterial | null>(null)
  const [viewingTemplateLink, setViewingTemplateLink] =
    useState<LessonTemplateLink | null>(null)

  return (
    <div
      style={tint}
      className={`bg-panel border border-line rounded-[14px] px-5 py-[18px] ${
        taught ? 'opacity-60' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center font-mono text-[12px] flex-shrink-0"
          style={{
            backgroundColor: 'var(--subject-soft)',
            color: 'var(--subject-ink)',
          }}
        >
          {lesson.duration_minutes ? `${lesson.duration_minutes}m` : '—'}
        </div>
        <div className="flex-1 min-w-0">
          {lesson.subject && (
            <div
              className="uppercase text-[10px] font-bold tracking-wide"
              style={{ color: 'var(--subject-ink)' }}
            >
              {lesson.subject.name}
            </div>
          )}
          <h3 className="text-[18px] font-semibold text-ink leading-snug">
            {lesson.title}
          </h3>
        </div>
        <Button
          variant={taught ? 'outline' : 'primary'}
          size="sm"
          onClick={() => onMarkTaught(lesson)}
        >
          {taught ? 'Taught ✓' : 'Mark taught'}
        </Button>
      </div>

      {lesson.objective && (
        <p className="italic text-[15px] text-ink-2 mt-3 pb-3 border-b border-line-2">
          {lesson.objective}
        </p>
      )}

      {/* Two-column body */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px] mt-3">
        {/* Materials */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-faint mb-2">
            Materials
          </div>
          {lesson.materials.length === 0 && paperlessDocs.length === 0 ? (
            <p className="text-[12.5px] text-faint">Nothing to print or gather.</p>
          ) : lesson.materials.length === 0 ? null : (
            <div className="flex flex-col gap-1.5">
              {lesson.materials.map((material: LessonMaterial) => (
                <label
                  key={material.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={material.is_gathered}
                    onChange={(e) =>
                      onToggleMaterial(lesson.id, material.id, e.target.checked)
                    }
                    className="accent-pos"
                  />
                  <span
                    className={`text-[13px] ${
                      material.is_gathered
                        ? 'line-through text-faint'
                        : 'text-ink'
                    }`}
                  >
                    {material.label}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Attached Paperless documents — one click opens the viewer. */}
          {paperlessDocs.length > 0 && (
            <div className={lesson.materials.length > 0 ? 'mt-3' : ''}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-faint mb-2">
                Documents
              </div>
              <div className="flex flex-col gap-1">
                {paperlessDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setViewingMaterial(doc)}
                    className="text-left text-[13px] text-info-fg inline-flex items-center gap-1.5 hover:underline"
                  >
                    <FileText size={13} className="flex-shrink-0" />
                    <span className="truncate">{doc.title}</span>
                    {doc.page_count ? (
                      <span className="text-faint text-[11px] flex-shrink-0">
                        {doc.page_count} pp
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Assignment + Resources */}
        <div>
          {templateLinks.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-faint mb-2">
                {templateLinks.length > 1 ? 'Assignments' : 'Assignment'}
              </div>
              <div className="flex flex-col gap-1.5">
                {templateLinks.map((link: LessonTemplateLink) => {
                  const summary = link.template as LessonTemplateSummary
                  return (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => setViewingTemplateLink(link)}
                      className="inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 w-fit cursor-pointer hover:ring-1 hover:ring-[var(--subject-ink)] focus-visible:ring-1 focus-visible:ring-[var(--subject-ink)] outline-none transition-shadow"
                      style={{ backgroundColor: 'var(--subject-soft)' }}
                    >
                      <span
                        className="uppercase text-[9.5px] font-bold tracking-wide"
                        style={{ color: 'var(--subject-ink)' }}
                      >
                        {summary.assignment_type}
                      </span>
                      <span
                        className="text-[11.5px] font-semibold"
                        style={{ color: 'var(--subject-ink)' }}
                      >
                        {summary.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {lesson.resources.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-faint mb-2">
                Resources
              </div>
              <div className="flex flex-col gap-1">
                {lesson.resources.map((resource: LessonResource) =>
                  resource.url ? (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] text-info-fg inline-flex items-center gap-1 hover:underline"
                    >
                      {resource.label}
                      <ArrowUpRight size={13} />
                    </a>
                  ) : (
                    <span key={resource.id} className="text-[13px] text-ink-2">
                      {resource.label}
                    </span>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Note callout (markdown-rendered) */}
      {lesson.notes && (
        <div className="mt-3 rounded-[10px] border border-accent-line bg-accent-soft px-3 py-2 text-[12.5px] text-ink-2">
          <MarkdownRenderer content={lesson.notes} />
        </div>
      )}

      {/* Footer: students */}
      {lesson.students.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line-2">
          <span className="text-[11.5px] text-faint">With</span>
          <StudentAvatars students={lesson.students} size={22} />
          <span className="text-[12.5px] text-muted">
            {lesson.students
              .map((s) => `${s.first_name} ${s.last_name}`.trim() || s.username)
              .join(', ')}
          </span>
        </div>
      )}

      <DocumentViewerModal
        material={viewingMaterial}
        onClose={() => setViewingMaterial(null)}
      />
      <LessonTemplateDetailModal
        link={viewingTemplateLink}
        lessonId={lesson.id}
        students={lesson.students}
        onClose={() => setViewingTemplateLink(null)}
      />
    </div>
  )
}

export default TeachCard
