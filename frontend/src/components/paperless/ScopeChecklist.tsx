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

import { PaperlessScopeOption } from '../../types/paperless'
import { scopeSummaryLabel, sortOptions } from './scopeLogic'

interface ScopeRowProps {
  option: PaperlessScopeOption
  checked: boolean
  disabled?: boolean
  onToggle: () => void
}

// Checkbox row in the FacetRail style (checkbox square + name + mono count).
const ScopeRow: React.FC<ScopeRowProps> = ({
  option,
  checked,
  disabled,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={disabled}
    className="w-full flex items-center gap-2 px-1.5 py-1 rounded-[7px] text-left hover:bg-track/60 transition-colors disabled:opacity-50 disabled:pointer-events-none"
  >
    <span
      className={`w-4 h-4 rounded-[5px] flex items-center justify-center flex-shrink-0 border-[1.5px] transition-colors ${
        checked ? 'bg-accent border-accent text-white' : 'border-check-border'
      }`}
    >
      {checked && <Check size={11} strokeWidth={3} />}
    </span>
    <span className="flex-1 text-[12.5px] text-ink-2 truncate">{option.name}</span>
    <span className="font-mono text-[10.5px] text-faint">
      {option.document_count}
    </span>
  </button>
)

interface ScopeGroupProps {
  title: string
  options: PaperlessScopeOption[]
  selected: number[]
  disabled?: boolean
  onToggle: (id: number) => void
}

const ScopeGroup: React.FC<ScopeGroupProps> = ({
  title,
  options,
  selected,
  disabled,
  onToggle,
}) => (
  <div className="flex-1 min-w-0">
    <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1.5">
      {title}
    </p>
    <div className="max-h-[220px] overflow-y-auto pr-1 space-y-0.5 border border-line rounded-card p-1.5">
      {options.map((option) => (
        <ScopeRow
          key={option.id}
          option={option}
          checked={selected.includes(option.id)}
          disabled={disabled}
          onToggle={() => onToggle(option.id)}
        />
      ))}
      {options.length === 0 && (
        <p className="px-1.5 py-2 text-[12px] text-faint">None on the server.</p>
      )}
    </div>
  </div>
)

interface ScopeChecklistProps {
  tags: PaperlessScopeOption[]
  documentTypes: PaperlessScopeOption[]
  selectedTagIds: number[]
  selectedDoctypeIds: number[]
  disabled?: boolean
  onToggleTag: (id: number) => void
  onToggleDoctype: (id: number) => void
}

/**
 * Side-by-side tag / document-type checklists (with per-item document
 * counts) shared by the connect card and the scope card. Union semantics
 * are explained in the footer hint.
 */
const ScopeChecklist: React.FC<ScopeChecklistProps> = ({
  tags,
  documentTypes,
  selectedTagIds,
  selectedDoctypeIds,
  disabled,
  onToggleTag,
  onToggleDoctype,
}) => (
  <div>
    <div className="flex flex-col sm:flex-row gap-4">
      <ScopeGroup
        title="Tags"
        options={sortOptions(tags)}
        selected={selectedTagIds}
        disabled={disabled}
        onToggle={onToggleTag}
      />
      <ScopeGroup
        title="Document types"
        options={sortOptions(documentTypes)}
        selected={selectedDoctypeIds}
        disabled={disabled}
        onToggle={onToggleDoctype}
      />
    </div>
    <p className="mt-2 text-[12px] text-muted">
      <span className="font-medium text-ink-2">
        {scopeSummaryLabel(selectedTagIds, selectedDoctypeIds)}
      </span>
      {' · '}
      Nothing selected = sync your whole library. A document syncs if it
      matches any selected tag or document type.
    </p>
  </div>
)

export default ScopeChecklist
