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

/** Readiness is based on gathered materials, independently of the taught marker. */
const ReadinessStrip: React.FC<ReadinessStripProps> = ({ readiness }) => {
  const { planned, prepReady, taught, gatheredMaterials, totalMaterials, needMaterials } = readiness
  return (
    <div className="bg-panel border border-line rounded-card px-5 py-4 mb-4 flex flex-wrap items-center gap-5">
      <div><p className="text-[12px] text-muted">Planned · still to teach</p><strong className="text-xl text-ink">{planned}</strong></div>
      <div><p className="text-[12px] text-muted">Prep ready · all materials gathered</p><strong className="text-xl text-ink">{prepReady} / {planned}</strong></div>
      <div><p className="text-[12px] text-muted">Taught</p><strong className="text-xl text-ink">{taught}</strong></div>
      <div className="text-[12px] text-muted">
        <p>{gatheredMaterials} / {totalMaterials} materials gathered for untaught lessons</p>
        <p>{needMaterials} lesson{needMaterials === 1 ? '' : 's'} need preparation · Visible plan</p>
      </div>
    </div>
  )
}

export default ReadinessStrip
