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

import React from 'react'
import { ArrowRight, FileType } from 'lucide-react'

import { Select } from '../ui'
import { MaterialKind, PaperlessDoctypeMap } from '../../types/paperless'
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_KIND_ORDER,
} from '../materials/materialsLogic'

interface DoctypeMapCardProps {
  doctypeMaps: PaperlessDoctypeMap[]
  onRemap: (paperlessDoctypeId: number, kind: MaterialKind) => void
}

/** Document type → material kind mapping card. */
const DoctypeMapCard: React.FC<DoctypeMapCardProps> = ({
  doctypeMaps,
  onRemap,
}) => (
  <div className="bg-panel border border-line rounded-card p-6">
    <div className="flex items-center gap-2 mb-1">
      <FileType className="h-4 w-4 text-faint" />
      <h2 className="text-[15px] font-semibold text-ink">
        Document type → Material kind
      </h2>
    </div>
    <p className="text-[13px] text-muted mb-4">
      Controls the type badge and picker filters for each Paperless document
      type.
    </p>

    {doctypeMaps.length === 0 ? (
      <p className="text-[13px] text-faint">
        No document types found on the server yet.
      </p>
    ) : (
      <div className="space-y-2">
        {doctypeMaps.map((map) => (
          <div key={map.paperless_doctype_id} className="flex items-center gap-3">
            <span className="font-mono text-[12px] font-semibold text-ink-2 flex-shrink-0 w-44 truncate">
              {map.paperless_doctype_name}
            </span>
            <ArrowRight size={13} className="text-faintest flex-shrink-0" />
            <Select
              aria-label={`Material kind for ${map.paperless_doctype_name}`}
              value={map.material_kind}
              onChange={(e) =>
                onRemap(map.paperless_doctype_id, e.target.value as MaterialKind)
              }
              fullWidth={false}
              className="w-44"
              options={MATERIAL_KIND_ORDER.map((kind) => ({
                value: kind,
                label: MATERIAL_KIND_LABELS[kind],
              }))}
            />
          </div>
        ))}
      </div>
    )}
  </div>
)

export default DoctypeMapCard
