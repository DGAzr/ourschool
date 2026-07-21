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

import React, { useEffect, useState } from 'react'
import { Diamond } from 'lucide-react'

import { Spinner, useToast } from '../ui'
import DocumentThumb from '../materials/DocumentThumb'
import PaperlessPickerModal from './PaperlessPickerModal'
import { paperlessApi } from '../../services/paperless'
import { getErrorMessage } from '../../services/api'
import { usePaperlessStatus } from '../../hooks/usePaperlessStatus'
import {
  PaperlessDocument,
  PaperlessMaterial,
} from '../../types/paperless'
import { Lesson } from '../../types/lesson'
import { kindBadge } from '../materials/materialsLogic'
import {
  docToPendingMaterial,
  topSuggestions,
  withAttachedFlags,
} from './paperlessPickerLogic'

interface PaperlessMaterialsSectionProps {
  /**
   * Write-through target: attach/detach hit the server immediately.
   * Omit for local mode.
   */
  lesson?: Lesson
  /**
   * Local mode (create flow, where the lesson doesn't exist yet): a
   * controlled pending list; the caller attaches after creating the lesson.
   * Required when `lesson` is omitted.
   */
  pendingMaterials?: PaperlessMaterial[]
  onPendingChange?: (materials: PaperlessMaterial[]) => void
  /** Live subject from the form (local mode; edit mode uses lesson.subject_id). */
  subjectId?: number | null
  subjectName?: string | null
}

/**
 * The lesson editor's "Materials from Paperless" block: attached-document
 * rows, a "Suggested from Paperless" card (top-3 objective-ranked), and the
 * "Pull from Paperless" picker. Two modes — write-through against a saved
 * lesson, or a locally accumulated pending list for the create flow (the
 * caller attaches on save). Renders nothing when the integration isn't
 * connected.
 */
const PaperlessMaterialsSection: React.FC<PaperlessMaterialsSectionProps> = ({
  lesson,
  pendingMaterials,
  onPendingChange,
  subjectId,
  subjectName,
}) => {
  const { toast } = useToast()
  const { status } = usePaperlessStatus()
  const [ownMaterials, setOwnMaterials] = useState<PaperlessMaterial[]>(
    lesson?.paperless_materials ?? []
  )
  const [suggestionPool, setSuggestionPool] = useState<PaperlessDocument[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busyDocId, setBusyDocId] = useState<number | null>(null)

  const connected = status?.connected === true
  const writeThrough = lesson !== undefined
  const materials = writeThrough ? ownMaterials : (pendingMaterials ?? [])
  const effectiveSubjectId = writeThrough ? lesson.subject_id : (subjectId ?? null)
  const lessonId = lesson?.id

  // Refresh ranked suggestions whenever the attachment set changes. All
  // setStates happen inside promise callbacks (set-state-in-effect rule);
  // stale values are handled by the render guard below, not by clearing.
  useEffect(() => {
    if (!connected || !effectiveSubjectId) return
    let cancelled = false
    paperlessApi
      .listDocuments({
        subject_ids: [effectiveSubjectId],
        lesson_id: lessonId,
        limit: 10,
      })
      .then((data) => {
        if (cancelled) return
        setSuggestionPool(data.items)
      })
      .catch(() => {
        if (!cancelled) setSuggestionPool([])
      })
    return () => {
      cancelled = true
    }
  }, [connected, lessonId, effectiveSubjectId, materials.length])

  if (!connected) return null

  // The server only computes `attached` for saved lessons; in local mode
  // (and for just-picked docs awaiting a refetch) merge the flags here.
  const flaggedPool = withAttachedFlags(
    suggestionPool,
    materials.map((m) => m.document_id)
  )
  const suggestions = topSuggestions(flaggedPool)
  const suggestionTotal = flaggedPool.filter((d) => !d.attached).length
  const showSuggestions = Boolean(effectiveSubjectId) && suggestions.length > 0

  const handleAdd = async (doc: PaperlessDocument) => {
    if (!writeThrough) {
      onPendingChange?.([...materials, docToPendingMaterial(doc)])
      toast(`"${doc.title}" will attach when you save the lesson`)
      return
    }
    setBusyDocId(doc.id)
    try {
      const material = await paperlessApi.attachToLesson(lesson.id, doc.id)
      setOwnMaterials((prev) => [...prev, material])
      toast(`Attached "${doc.title}"`)
    } catch (err) {
      toast(getErrorMessage(err, 'Could not attach document'), 'danger')
    } finally {
      setBusyDocId(null)
    }
  }

  const handleRemove = async (material: PaperlessMaterial) => {
    if (!writeThrough) {
      onPendingChange?.(
        materials.filter((m) => m.document_id !== material.document_id)
      )
      return
    }
    setBusyDocId(material.document_id)
    try {
      await paperlessApi.detachFromLesson(lesson.id, material.document_id)
      setOwnMaterials((prev) => prev.filter((m) => m.id !== material.id))
      toast('Material removed')
    } catch (err) {
      toast(getErrorMessage(err, 'Could not remove document'), 'danger')
    } finally {
      setBusyDocId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] font-semibold text-faint uppercase tracking-wide">
          Materials from Paperless
        </label>
        {materials.length > 0 && (
          <span className="text-[11.5px] text-muted">{materials.length}</span>
        )}
      </div>

      {/* Attached rows */}
      <div className="flex flex-col gap-1.5">
        {materials.length === 0 && (
          <p className="text-[12.5px] text-faint">Nothing attached yet.</p>
        )}
        {materials.map((material) => (
          <div
            key={material.document_id}
            className="flex items-center gap-2.5 border border-line rounded-[10px] px-2.5 py-2"
          >
            <DocumentThumb
              externalId={material.external_id}
              title={material.title}
              className="w-[28px] h-[36px] flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-ink truncate">
                {material.title}
              </p>
              <p className="font-mono text-[9.5px] text-faint tracking-wide">
                {kindBadge(material.material_kind)}
                {material.asn ? ` · ASN ${material.asn}` : ''}
              </p>
            </div>
            {busyDocId === material.document_id ? (
              <Spinner size="sm" />
            ) : (
              <button
                type="button"
                onClick={() => handleRemove(material)}
                className="text-[12px] font-medium text-muted hover:text-danger transition-colors flex-shrink-0"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full py-2.5 rounded-[10px] border border-dashed border-btn-border text-[12.5px] font-semibold text-faint hover:text-ink hover:border-faint transition-colors"
        >
          ＋ Pull from Paperless
        </button>
      </div>

      {/* Suggested from Paperless */}
      {showSuggestions && (
        <div className="mt-3 rounded-[11px] border border-accent-line bg-accent-soft p-3.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Diamond size={11} className="text-accent" fill="currentColor" />
            <span className="text-[12px] font-semibold text-ink">
              Suggested from Paperless
            </span>
            <span className="ml-auto text-[11px] text-muted">
              {suggestionTotal} match{suggestionTotal === 1 ? '' : 'es'}
            </span>
          </div>
          <p className="text-[11.5px] text-muted mb-2.5">
            {writeThrough
              ? `Ranked on the ${subjectName ?? 'subject'} tag and the words in this objective.`
              : `Matched on the ${subjectName ?? 'subject'} tag.`}
          </p>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2.5 bg-panel rounded-[9px] border border-line-2 px-2.5 py-2"
              >
                <DocumentThumb
                  externalId={doc.external_id}
                  title={doc.title}
                  className="w-[28px] h-[36px] flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-ink truncate">
                    {doc.title}
                  </p>
                  <p className="font-mono text-[9.5px] text-faint tracking-wide">
                    {kindBadge(doc.material_kind)}
                    {doc.page_count ? ` · ${doc.page_count} pp` : ''}
                    {doc.match_pct != null ? ` · ${doc.match_pct}% MATCH` : ''}
                  </p>
                </div>
                {busyDocId === doc.id ? (
                  <Spinner size="sm" />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAdd(doc)}
                    className="text-[12px] font-semibold text-accent hover:opacity-75 transition-opacity flex-shrink-0"
                  >
                    Add
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <PaperlessPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        lessonId={lessonId}
        attachedDocumentIds={
          writeThrough ? [] : materials.map((m) => m.document_id)
        }
        subjectId={effectiveSubjectId}
        subjectName={subjectName}
        attach={
          lesson
            ? (doc) => paperlessApi.attachToLesson(lesson.id, doc.id)
            : async (doc) => docToPendingMaterial(doc)
        }
        successMessage={
          writeThrough
            ? undefined
            : (count) =>
                `${count} material${count === 1 ? '' : 's'} will attach when you save the lesson`
        }
        onAttached={(attached) => {
          if (writeThrough) {
            setOwnMaterials((prev) => [...prev, ...attached])
          } else {
            onPendingChange?.([...materials, ...attached])
          }
        }}
      />
    </div>
  )
}

export default PaperlessMaterialsSection
