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

import React, { useState } from 'react'
import { Check, Search } from 'lucide-react'

import Modal from '../ui/Modal/Modal'
import { Button, Spinner, useToast } from '../ui'
import DocumentThumb from '../materials/DocumentThumb'
import SyncPill from '../paperless/SyncPill'
import { getErrorMessage } from '../../services/api'
import { usePaperlessDocuments } from '../../hooks/usePaperlessDocuments'
import { usePaperlessStatus } from '../../hooks/usePaperlessStatus'
import {
  MaterialKind,
  PaperlessDocument,
  PaperlessMaterial,
} from '../../types/paperless'
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_KIND_ORDER,
  kindBadge,
} from '../materials/materialsLogic'
import {
  attachButtonLabel,
  pickerFooterLabel,
  pruneSelection,
  toggleSelection,
  withAttachedFlags,
} from './paperlessPickerLogic'

interface PaperlessPickerModalProps {
  isOpen: boolean
  onClose: () => void
  /** Lesson target: enables objective ranking + server-side attached flags. */
  lessonId?: number
  /** Template target: attached flags come from the caller's current links. */
  attachedDocumentIds?: number[]
  subjectId?: number | null
  subjectName?: string | null
  /**
   * Writes one attachment and returns the link row. Receives the full
   * document so local-accumulate callers (assign flow, where no target
   * exists yet) can build a pending material without a server round-trip.
   */
  attach: (doc: PaperlessDocument) => Promise<PaperlessMaterial>
  /** Wording for the primary button, e.g. "Attach 2 to lesson". */
  attachNoun?: 'lesson' | 'assignment'
  /** Overrides the success toast, e.g. for deferred (assign-time) attaching. */
  successMessage?: (count: number) => string
  /** Called once with all newly attached materials. */
  onAttached: (materials: PaperlessMaterial[]) => void
}

type KindChip = 'all' | MaterialKind

/**
 * "Pull from Paperless" — centered picker modal, pre-filtered to the target's
 * subject and (for lessons) ranked by match to the objective. Multi-select →
 * "Attach n to lesson/assignment".
 *
 * The outer component remounts the content on every open so search, chip and
 * selection state start fresh (same pattern as ConfirmDialog — no
 * state-sync-in-effect).
 */
const PaperlessPickerModal: React.FC<PaperlessPickerModalProps> = (props) =>
  props.isOpen ? <PickerContent {...props} /> : null

const PickerContent: React.FC<PaperlessPickerModalProps> = ({
  onClose,
  lessonId,
  attachedDocumentIds = [],
  subjectId,
  subjectName,
  attach,
  attachNoun = 'lesson',
  successMessage,
  onAttached,
}) => {
  const { toast } = useToast()
  const { status } = usePaperlessStatus()
  const [chip, setChip] = useState<KindChip>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [attaching, setAttaching] = useState(false)

  const {
    documents: fetched,
    total,
    loading,
    loadingMore,
    hasMore,
    loadMore,
  } = usePaperlessDocuments({
    subjectIds: subjectId ? [subjectId] : [],
    kinds: chip === 'all' ? [] : [chip],
    query,
    lessonId,
    limit: 40,
  })
  const documents = withAttachedFlags(fetched, attachedDocumentIds)
  // Selection is pruned at render time (no state-sync effect): docs that
  // became attached or fell out of the current filter stay in `selected`
  // harmlessly but never count or submit.
  const effectiveSelected = pruneSelection(selected, documents)

  const handleAttach = async () => {
    setAttaching(true)
    const attached: PaperlessMaterial[] = []
    try {
      for (const docId of effectiveSelected) {
        // Ids in effectiveSelected always come from `documents`.
        const doc = documents.find((d) => d.id === docId)
        if (doc) attached.push(await attach(doc))
      }
      toast(
        successMessage
          ? successMessage(attached.length)
          : `Attached ${attached.length} material${attached.length === 1 ? '' : 's'} to ${attachNoun}`
      )
      onAttached(attached)
      onClose()
    } catch (err) {
      // Partial success is possible; hand back what made it.
      if (attached.length > 0) onAttached(attached)
      toast(getErrorMessage(err, 'Could not attach documents'), 'danger')
    } finally {
      setAttaching(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title="Pull from Paperless"
      subtitle={
        subjectName && lessonId
          ? `Filtered to ${subjectName} and ranked by match to this lesson's objective.`
          : subjectName
            ? `Filtered to ${subjectName}.`
            : 'Pick documents from your Paperless library.'
      }
      footer={
        <>
          <span className="mr-auto text-[12.5px] text-muted">
            {pickerFooterLabel(effectiveSelected.length, total, subjectName)}
          </span>
          <Button variant="outline" size="sm" onClick={onClose} disabled={attaching}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleAttach}
            disabled={effectiveSelected.length === 0}
            loading={attaching}
          >
            {attachButtonLabel(effectiveSelected.length, attachNoun)}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="flex items-center justify-end">
          <SyncPill
            lastSyncAt={status?.last_sync_at}
            status={status?.last_sync_status}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              subjectName ? `Search within ${subjectName}…` : 'Search documents…'
            }
            className="w-full h-9 pl-9 pr-3 rounded-[9px] border border-field-border bg-panel text-[13px] text-ink placeholder:text-faint focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Type chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', ...MATERIAL_KIND_ORDER] as KindChip[]).map((value) => {
            const active = chip === value
            return (
              <button
                key={value}
                onClick={() => setChip(value)}
                className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${
                  active
                    ? 'bg-btn-primary-bg text-btn-primary-fg border-transparent'
                    : 'border-btn-border text-muted hover:text-ink'
                }`}
              >
                {value === 'all' ? 'All types' : MATERIAL_KIND_LABELS[value]}
              </button>
            )
          })}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted">
            <Spinner size="sm" />
            Loading documents…
          </div>
        ) : documents.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-faint">
            No documents match.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[46vh] overflow-y-auto pr-1">
            {documents.map((doc) => {
              const isAttached = doc.attached === true
              const isSelected = effectiveSelected.includes(doc.id)
              return (
                <button
                  key={doc.id}
                  disabled={isAttached}
                  onClick={() =>
                    setSelected((prev) => toggleSelection(prev, doc.id))
                  }
                  className={`relative flex items-start gap-3 p-3 rounded-[11px] border text-left transition-all ${
                    isAttached
                      ? 'bg-panel-2 border-line opacity-60 cursor-default'
                      : isSelected
                        ? 'border-[1.5px] border-accent bg-accent-soft'
                        : 'border-line bg-panel hover:border-check-border'
                  }`}
                >
                  <DocumentThumb
                    externalId={doc.external_id}
                    title={doc.title}
                    className="w-[44px] h-[58px] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-[12.5px] font-semibold text-ink leading-snug line-clamp-2">
                      {doc.title}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[9.5px] font-semibold tracking-wide text-muted px-1.5 py-0.5 rounded-[4px] bg-track">
                        {kindBadge(doc.material_kind)}
                      </span>
                      {isAttached ? (
                        <span className="font-mono text-[9.5px] font-bold tracking-wide text-pos-fg">
                          ATTACHED
                        </span>
                      ) : doc.match_pct != null ? (
                        <span className="font-mono text-[9.5px] font-bold tracking-wide text-accent px-1.5 py-0.5 rounded-[4px] bg-accent-soft">
                          {doc.match_pct}% MATCH
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 font-mono text-[9.5px] text-faint tracking-wide">
                      {doc.asn ? `ASN ${doc.asn}` : '—'}
                      {doc.page_count ? ` · ${doc.page_count} pp` : ''}
                    </p>
                  </div>
                  {!isAttached && (
                    <span
                      className={`absolute top-2.5 right-2.5 w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-accent border-accent text-white'
                          : 'border-check-border'
                      }`}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </span>
                  )}
                </button>
              )
            })}
            {hasMore && (
              <div className="sm:col-span-2 flex justify-center py-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  loading={loadingMore}
                >
                  Load more ({documents.length} of {total})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default PaperlessPickerModal
