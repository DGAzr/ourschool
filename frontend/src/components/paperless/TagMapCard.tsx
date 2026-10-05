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

import { Tag } from 'lucide-react'
import { PaperlessTagMap } from '../../types/paperless'
import { Subject } from '../../types/subject'
import MappingEditor from './MappingEditor'

interface TagMapCardProps {
  tagMaps: PaperlessTagMap[]
  subjects: Subject[]
  optionsReady: boolean
  disabled: boolean
  scopeError?: string | null
  onRemap: (paperlessTagId: number, subjectId: number | null) => Promise<void>
  onRemove: (id: number) => Promise<void>
}

export default function TagMapCard({
  tagMaps, subjects, optionsReady, disabled, scopeError, onRemap, onRemove,
}: TagMapCardProps) {
  const subjectById = new Map(subjects.map(subject => [subject.id, subject]))
  return <div className="bg-panel border border-line rounded-card p-6">
    <div className="flex items-center gap-2 mb-1">
      <Tag className="h-4 w-4 text-faint" aria-hidden="true" />
      <h2 className="text-[15px] font-semibold text-ink">Tag → Subject</h2>
    </div>
    <p className="text-[13px] text-muted mb-4">Add tags from Sync Scope to choose their subjects. Removing a mapping restores automatic name matching.</p>
    <MappingEditor
      rows={tagMaps.map(map => ({
        id: map.paperless_tag_id,
        name: map.paperless_tag_name,
        target: String(map.subject_id ?? ''),
        configured: map.configured,
        inScope: map.in_scope,
        color: subjectById.get(map.subject_id ?? 0)?.color,
      }))}
      sourceLabel="Tag"
      targetLabel="Subject"
      targets={[
        { value: '', label: 'Unmapped' },
        ...subjects.map(subject => ({ value: String(subject.id), label: subject.name })),
      ]}
      optionsReady={optionsReady}
      disabled={disabled}
      scopeError={scopeError}
      onSave={(id, target) => onRemap(id, target ? Number(target) : null)}
      onRemove={onRemove}
    />
  </div>
}
