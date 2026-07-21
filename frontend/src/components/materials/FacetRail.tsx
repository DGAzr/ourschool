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
import { Check } from 'lucide-react'

import { SubjectDot } from '../ui'
import { Subject } from '../../types/subject'
import {
  MaterialKind,
  PaperlessDocumentFacets,
} from '../../types/paperless'
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_KIND_ORDER,
} from './materialsLogic'

interface FacetRailProps {
  facets: PaperlessDocumentFacets
  subjects: Subject[]
  selectedKinds: MaterialKind[]
  selectedSubjects: number[]
  onToggleKind: (kind: MaterialKind) => void
  onToggleSubject: (subjectId: number) => void
}

interface FacetRowProps {
  label: string
  count: number
  checked: boolean
  dotColor?: string | null
  onToggle: () => void
}

const FacetRow: React.FC<FacetRowProps> = ({
  label,
  count,
  checked,
  dotColor,
  onToggle,
}) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center gap-2 px-1.5 py-1 rounded-[7px] text-left hover:bg-track/60 transition-colors"
  >
    <span
      className={`w-4 h-4 rounded-[5px] flex items-center justify-center flex-shrink-0 border-[1.5px] transition-colors ${
        checked ? 'bg-accent border-accent text-white' : 'border-check-border'
      }`}
    >
      {checked && <Check size={11} strokeWidth={3} />}
    </span>
    {dotColor !== undefined && <SubjectDot color={dotColor ?? undefined} size={7} />}
    <span className="flex-1 text-[12.5px] text-ink-2 truncate">{label}</span>
    <span className="font-mono text-[10.5px] text-faint">{count}</span>
  </button>
)

/**
 * Left facet rail of the Materials library: DOCUMENT TYPE + SUBJECT checkbox
 * groups. Multi-select; empty selection = all.
 */
const FacetRail: React.FC<FacetRailProps> = ({
  facets,
  subjects,
  selectedKinds,
  selectedSubjects,
  onToggleKind,
  onToggleSubject,
}) => {
  const subjectRows = subjects.filter(
    (s) => (facets.subjects[String(s.id)] ?? 0) > 0
  )

  return (
    <aside className="w-[190px] flex-shrink-0 bg-panel-2 border-r border-line px-3 py-5 space-y-6 overflow-y-auto">
      <div>
        <p className="px-1.5 mb-1.5 text-[10.5px] font-bold uppercase tracking-[.08em] text-faint">
          Document type
        </p>
        <div className="space-y-0.5">
          {MATERIAL_KIND_ORDER.filter((kind) => (facets.kinds[kind] ?? 0) > 0).map(
            (kind) => (
              <FacetRow
                key={kind}
                label={MATERIAL_KIND_LABELS[kind]}
                count={facets.kinds[kind] ?? 0}
                checked={selectedKinds.includes(kind)}
                onToggle={() => onToggleKind(kind)}
              />
            )
          )}
        </div>
      </div>

      <div>
        <p className="px-1.5 mb-1.5 text-[10.5px] font-bold uppercase tracking-[.08em] text-faint">
          Subject
        </p>
        <div className="space-y-0.5">
          {subjectRows.map((subject) => (
            <FacetRow
              key={subject.id}
              label={subject.name}
              count={facets.subjects[String(subject.id)] ?? 0}
              checked={selectedSubjects.includes(subject.id)}
              dotColor={subject.color}
              onToggle={() => onToggleSubject(subject.id)}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

export default FacetRail
