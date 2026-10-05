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

import { useState } from 'react'

import Modal from '../ui/Modal/Modal'
import { Button, EmptyState, Input, Spinner } from '../ui'
import { templatePage } from '../../services/assignments'
import { usePagedData, useDebouncedSearch } from '../../hooks/usePagedData'
import PageNavigation from '../assignments/PageNavigation'
import { AssignmentTemplate, Subject } from '../../types'

interface TemplateLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  subjects: Subject[]
  onAttach: (template: AssignmentTemplate) => void
  /** Initial subject filter inherited from the lesson, visible and clearable. */
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
  const [subjectOverride, setSubjectOverride] = useState<{ inherited: number | null | undefined; value: number | null } | null>(null)
  const selectedSubject = subjectOverride && subjectOverride.inherited === subjectId ? subjectOverride.value : subjectId
  const [search, setSearch] = useState('')
  const settledSearch = useDebouncedSearch(search)
  const { items: templates, loading, error, pagination } = usePagedData<AssignmentTemplate>({
    subject_id: selectedSubject, search: settledSearch, with_stats: false,
  }, templatePage, isOpen)

  const subjectName = (id: number): string =>
    subjects.find((s) => s.id === id)?.name ?? ''

  const excluded = new Set(excludeTemplateIds)
  const visible = (templates ?? []).filter(
    (t) =>
      !excluded.has(t.id)
  )

  const controls = (
    <div className="flex flex-wrap gap-2 mb-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates…"
        aria-label="Search template library"
      />
      <Button variant="outline" size="sm" onClick={onCreateNew}>
        + New assignment
      </Button>
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Template library" size="lg">
      {error && <p role="alert" className="text-neg-fg">{error}</p>}
      {controls}
      <div className="flex flex-wrap items-center gap-2 text-[12px] mb-3">
        <label className="flex items-center gap-2 text-muted">Subject filter
          <select aria-label="Template library subject" value={selectedSubject ?? ''} onChange={e => setSubjectOverride({ inherited: subjectId, value: e.target.value ? Number(e.target.value) : null })} className="max-w-full bg-panel border border-line rounded-field px-2 min-h-10 text-ink">
            <option value="">All subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        {selectedSubject != null && <span className="text-accent">Filtered to {subjectName(selectedSubject)}</span>}
        {(selectedSubject != null || search) && <button onClick={() => { setSubjectOverride({ inherited: subjectId, value: null }); setSearch('') }} className="min-h-10 text-accent font-semibold">Clear filters</button>}
        <span className="text-muted">{loading ? 'Loading matches…' : `${pagination.total} matching templates · ${visible.length} available on this page`}</span>
      </div>
      {excludeTemplateIds.length > 0 && <p className="text-[12px] text-muted mb-2">Activities already linked to this lesson are hidden.</p>}
      <PageNavigation {...pagination} />
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : visible.length === 0 ? (
        <>
          <EmptyState
            title="No templates to link"
            subtext='No templates match. Create one right here with "New assignment".'
          />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((template) => (
            <div
              key={template.id}
              className="flex items-center gap-3 border border-line rounded-[11px] px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-ink break-words">
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
                aria-label={`Attach ${template.name}`}
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
