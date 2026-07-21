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

import { useEffect, useState } from 'react'

import Modal from '../ui/Modal/Modal'
import { Button, EmptyState, Input, Spinner } from '../ui'
import { assignmentsApi } from '../../services/assignments'
import { AssignmentTemplate, Subject } from '../../types'

interface TemplateLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  subjects: Subject[]
  onAttach: (template: AssignmentTemplate) => void
  /** When set, only templates for this subject are shown. */
  subjectId?: number | null
  /** Template ids already linked to the lesson — hidden from the list. */
  excludeTemplateIds?: number[]
  /** Opens the composer to create a new template in place. */
  onCreateNew: () => void
}

/** A modal listing assignment templates to link to the current lesson. */
const TemplateLibraryModal: React.FC<TemplateLibraryModalProps> = ({
  isOpen,
  onClose,
  subjects,
  onAttach,
  subjectId,
  excludeTemplateIds = [],
  onCreateNew,
}) => {
  const [search, setSearch] = useState('')
  // The fetched result is tagged with the subject key it was fetched for, so a
  // subject change reads as "loading" without a synchronous setState reset in
  // the effect (which the hooks lint rule forbids).
  const [fetched, setFetched] = useState<{
    key: number | null
    data: AssignmentTemplate[]
  } | null>(null)

  const subjectKey = subjectId ?? null
  const loading = isOpen && (fetched === null || fetched.key !== subjectKey)
  const templates = loading ? [] : (fetched?.data ?? [])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    assignmentsApi
      .getAll(subjectId ? { subject_id: subjectId } : undefined)
      .then((data) => {
        if (!cancelled) setFetched({ key: subjectKey, data: data || [] })
      })
      .catch(() => {
        if (!cancelled) setFetched({ key: subjectKey, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, subjectId, subjectKey])

  const subjectName = (id: number): string =>
    subjects.find((s) => s.id === id)?.name ?? ''

  const excluded = new Set(excludeTemplateIds)
  const visible = (templates ?? []).filter(
    (t) =>
      !excluded.has(t.id) &&
      t.name.toLowerCase().includes(search.toLowerCase())
  )

  const controls = (
    <div className="flex gap-2 mb-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates…"
      />
      <Button variant="outline" size="sm" onClick={onCreateNew}>
        + New assignment
      </Button>
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Template library" size="lg">
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : visible.length === 0 ? (
        <>
          {controls}
          <EmptyState
            title="No templates to link"
            subtext='No templates match. Create one right here with "New assignment".'
          />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {controls}
          {visible.map((template) => (
            <div
              key={template.id}
              className="flex items-center gap-3 border border-line rounded-[11px] px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-ink truncate">
                  {template.name}
                </div>
                <div className="text-[11.5px] text-muted flex flex-wrap gap-x-2">
                  <span>{subjectName(template.subject_id)}</span>
                  <span className="uppercase">{template.assignment_type}</span>
                  <span className="font-mono">{template.max_points} pts</span>
                  {template.estimated_duration_minutes ? (
                    <span className="font-mono">
                      {template.estimated_duration_minutes}m
                    </span>
                  ) : null}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onAttach(template)
                  onClose()
                }}
              >
                Attach →
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export default TemplateLibraryModal
