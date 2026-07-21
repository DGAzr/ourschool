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
import { ArrowRight, Tag } from 'lucide-react'

import { Select } from '../ui'
import { PaperlessTagMap } from '../../types/paperless'
import { Subject } from '../../types/subject'

interface TagMapCardProps {
  tagMaps: PaperlessTagMap[]
  subjects: Subject[]
  onRemap: (paperlessTagId: number, subjectId: number | null) => void
}

/** Tag → Subject mapping card: a tinted tag pill → arrow → subject select. */
const TagMapCard: React.FC<TagMapCardProps> = ({ tagMaps, subjects, onRemap }) => {
  const subjectById = new Map(subjects.map((s) => [s.id, s]))

  return (
    <div className="bg-panel border border-line rounded-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <Tag className="h-4 w-4 text-faint" />
        <h2 className="text-[15px] font-semibold text-ink">Tag → Subject</h2>
      </div>
      <p className="text-[13px] text-muted mb-4">
        Auto-matched by name. Pick a subject to remap; manual choices survive
        re-syncs.
      </p>

      {tagMaps.length === 0 ? (
        <p className="text-[13px] text-faint">No tags found on the server yet.</p>
      ) : (
        <div className="space-y-2">
          {tagMaps.map((map) => {
            const subject = map.subject_id
              ? subjectById.get(map.subject_id)
              : undefined
            const color = subject?.color ?? 'var(--faint)'
            return (
              <div
                key={map.paperless_tag_id}
                className="flex items-center gap-3"
              >
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-pill text-[12px] font-semibold flex-shrink-0"
                  style={{
                    color,
                    background: 'color-mix(in srgb, ' + color + ' 12%, transparent)',
                  }}
                >
                  #{map.paperless_tag_name}
                </span>
                <ArrowRight size={13} className="text-faintest flex-shrink-0" />
                <Select
                  aria-label={`Subject for tag ${map.paperless_tag_name}`}
                  value={map.subject_id ?? ''}
                  onChange={(e) =>
                    onRemap(
                      map.paperless_tag_id,
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  fullWidth={false}
                  className="w-52"
                  options={[
                    { value: '', label: 'Unmapped' },
                    ...subjects.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TagMapCard
