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

import { Readiness } from '../../utils/lessonPlanning'

interface ReadinessStripProps {
  readiness: Readiness
}

const LEGEND = [
  { color: 'var(--pos)', label: 'Ready · materials gathered' },
  { color: 'var(--track)', label: 'Still planning' },
  { color: 'var(--faint)', label: 'Taught' },
]

/** The readiness summary card above the board. */
const ReadinessStrip: React.FC<ReadinessStripProps> = ({ readiness }) => {
  const { readyOrTaught, total, needMaterials } = readiness
  const pct = total > 0 ? Math.round((readyOrTaught / total) * 100) : 0

  return (
    <div className="bg-panel border border-line rounded-[13px] px-[18px] py-[14px] mb-[18px] flex flex-wrap items-center gap-[18px]">
      <div className="flex flex-col gap-1">
        <span className="text-[12px] text-muted">Ready to teach</span>
        <span className="font-mono text-[22px] font-semibold text-ink leading-none">
          {readyOrTaught}{' '}
          <span className="text-faint text-[15px]">/ {total} lessons</span>
        </span>
      </div>

      <div className="flex-1 min-w-[160px] flex flex-col gap-2">
        <div className="h-[9px] w-full bg-track rounded-full overflow-hidden">
          <div
            className="h-full bg-pos rounded-full transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {LEGEND.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 text-[11.5px] text-muted"
            >
              <span
                className="w-[7px] h-[7px] rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {needMaterials > 0 && (
        <p className="text-[12.5px] text-ink-2 max-w-[210px] text-right ml-auto">
          {needMaterials} lesson{needMaterials === 1 ? '' : 's'} still need materials
          before they're teach-ready.
        </p>
      )}
    </div>
  )
}

export default ReadinessStrip
