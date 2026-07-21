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

import { SubjectDot } from '../ui'
import DocumentThumb from './DocumentThumb'
import { PaperlessDocument } from '../../types/paperless'
import { Subject } from '../../types/subject'
import { documentMeta, usageLabel } from './materialsLogic'

interface DocumentCardProps {
  doc: PaperlessDocument
  subject?: Subject
  onOpen: (doc: PaperlessDocument) => void
}

/** One card in the Materials grid: thumbnail, title, subject, meta, usage. */
const DocumentCard: React.FC<DocumentCardProps> = ({ doc, subject, onOpen }) => (
  <button
    onClick={() => onOpen(doc)}
    className="text-left bg-panel border border-line rounded-[12px] p-3 transition-all duration-150 hover:border-check-border hover:shadow-[0_3px_14px_var(--shadow-card-color,rgba(0,0,0,.08))] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
  >
    <DocumentThumb
      externalId={doc.external_id}
      title={doc.title}
      accentColor={subject?.color}
      className="h-[104px] w-full mb-2.5"
    />
    <p className="text-[12.5px] font-semibold text-ink leading-snug line-clamp-2">
      {doc.title}
    </p>
    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
      <SubjectDot color={subject?.color ?? undefined} size={7} />
      {subject?.name ?? 'Unmapped'}
    </p>
    <p className="mt-1 font-mono text-[10px] text-faint tracking-wide">
      {documentMeta(doc)}
    </p>
    <p
      className={`mt-2 pt-2 border-t border-line-2 text-[11px] ${
        doc.used_in_count > 0 ? 'text-muted' : 'text-faintest'
      }`}
    >
      {usageLabel(doc.used_in_count)}
    </p>
  </button>
)

export default DocumentCard
