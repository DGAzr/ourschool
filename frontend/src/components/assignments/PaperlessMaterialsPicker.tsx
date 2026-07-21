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

import { Spinner, useToast } from '../ui'
import DocumentThumb from '../materials/DocumentThumb'
import PaperlessPickerModal from '../lessons/PaperlessPickerModal'
import { paperlessApi } from '../../services/paperless'
import { getErrorMessage } from '../../services/api'
import { usePaperlessStatus } from '../../hooks/usePaperlessStatus'
import { PaperlessMaterial } from '../../types/paperless'
import { AssignmentTemplate } from '../../types'
import { kindBadge } from '../materials/materialsLogic'
import { docToPendingMaterial } from '../lessons/paperlessPickerLogic'
import { attachedIds } from './assignmentMaterialsLogic'

interface PaperlessMaterialsPickerProps {
  /**
   * Write-through target: attach/detach hit the server immediately
   * (independent of any surrounding form save). Omit for local mode.
   */
  template?: AssignmentTemplate
  /**
   * Local mode (create/assign flows, where the target doesn't exist yet):
   * a controlled pending list; the caller attaches after creating the
   * target. Required when `template` is omitted.
   */
  pendingMaterials?: PaperlessMaterial[]
  onPendingChange?: (materials: PaperlessMaterial[]) => void
  /** Toast for local-mode picks, e.g. "…they'll attach when you assign". */
  pendingSuccessMessage?: (count: number) => string
  /** Documents that are already provided elsewhere (greyed out in picker). */
  excludeDocumentIds?: number[]
  /** Parenthetical after the "Materials from Paperless" label. */
  hint?: string
  /** Live subject selection from the surrounding form (pre-filters picker). */
  subjectId?: number | null
  subjectName?: string | null
}

/**
 * "Materials from Paperless" block: attached-material rows + the pull-from-
 * Paperless picker. Two modes — write-through against an existing template,
 * or a locally accumulated pending list for flows where the target is only
 * created on submit (new template, assign batch). Renders nothing when
 * Paperless isn't connected.
 */
const PaperlessMaterialsPicker: React.FC<PaperlessMaterialsPickerProps> = ({
  template,
  pendingMaterials,
  onPendingChange,
  pendingSuccessMessage,
  excludeDocumentIds = [],
  hint = 'students can view and download these',
  subjectId,
  subjectName,
}) => {
  const { toast } = useToast()
  const { status } = usePaperlessStatus()
  const [ownMaterials, setOwnMaterials] = useState<PaperlessMaterial[]>(
    template?.paperless_materials ?? []
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busyDocId, setBusyDocId] = useState<number | null>(null)

  if (status?.connected !== true) return null

  const writeThrough = template !== undefined
  const materials = writeThrough ? ownMaterials : (pendingMaterials ?? [])

  const handleRemove = async (material: PaperlessMaterial) => {
    if (!writeThrough) {
      onPendingChange?.(
        materials.filter((m) => m.document_id !== material.document_id)
      )
      return
    }
    setBusyDocId(material.document_id)
    try {
      await paperlessApi.detachFromTemplate(template.id, material.document_id)
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
      <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
        Materials from Paperless{' '}
        <span className="font-normal normal-case text-faint">({hint})</span>
      </label>
      <div className="flex flex-col gap-1.5">
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
          ＋ Attach from Paperless
        </button>
      </div>

      <PaperlessPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        attachedDocumentIds={[
          ...new Set([...attachedIds(materials, []), ...excludeDocumentIds]),
        ]}
        subjectId={subjectId}
        subjectName={subjectName}
        attach={
          writeThrough
            ? (doc) => paperlessApi.attachToTemplate(template.id, doc.id)
            : async (doc) => docToPendingMaterial(doc)
        }
        attachNoun="assignment"
        successMessage={writeThrough ? undefined : pendingSuccessMessage}
        onAttached={(added) => {
          if (writeThrough) {
            setOwnMaterials((prev) => [...prev, ...added])
          } else {
            onPendingChange?.([...materials, ...added])
          }
        }}
      />
    </div>
  )
}

export default PaperlessMaterialsPicker
