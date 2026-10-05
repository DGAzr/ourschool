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

import { FileType } from 'lucide-react'
import { MaterialKind, PaperlessDoctypeMap } from '../../types/paperless'
import { MATERIAL_KIND_LABELS, MATERIAL_KIND_ORDER } from '../materials/materialsLogic'
import MappingEditor from './MappingEditor'

interface DoctypeMapCardProps {
  doctypeMaps: PaperlessDoctypeMap[]
  optionsReady: boolean
  disabled: boolean
  scopeError?: string | null
  onRemap: (paperlessDoctypeId: number, kind: MaterialKind) => Promise<void>
  onRemove: (id: number) => Promise<void>
}

export default function DoctypeMapCard({
  doctypeMaps, optionsReady, disabled, scopeError, onRemap, onRemove,
}: DoctypeMapCardProps) {
  return <div className="bg-panel border border-line rounded-card p-6">
    <div className="flex items-center gap-2 mb-1">
      <FileType className="h-4 w-4 text-faint" aria-hidden="true" />
      <h2 className="text-[15px] font-semibold text-ink">Document type → Material kind</h2>
    </div>
    <p className="text-[13px] text-muted mb-4">Add document types from Sync Scope to choose their material kinds. Removing a mapping restores the automatic kind.</p>
    <MappingEditor
      rows={doctypeMaps.map(map => ({
        id: map.paperless_doctype_id,
        name: map.paperless_doctype_name,
        target: map.material_kind,
        configured: map.configured,
        inScope: map.in_scope,
      }))}
      sourceLabel="Document type"
      targetLabel="Material kind"
      targets={MATERIAL_KIND_ORDER.map(kind => ({ value: kind, label: MATERIAL_KIND_LABELS[kind] }))}
      optionsReady={optionsReady}
      disabled={disabled}
      scopeError={scopeError}
      onSave={(id, target) => onRemap(id, target as MaterialKind)}
      onRemove={onRemove}
    />
  </div>
}
