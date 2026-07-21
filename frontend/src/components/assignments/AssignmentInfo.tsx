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

import { useState } from 'react'
import MarkdownRenderer from '../common/MarkdownRenderer'

const Section: React.FC<{ label: string; text: string }> = ({ label, text }) => (
  <div>
    <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1">{label}</p>
    <MarkdownRenderer content={text} className="text-[13px] leading-relaxed" />
  </div>
)

interface AssignmentInfoProps {
  description?: string | null
  instructions?: string | null
  customInstructions?: string | null
  /** Wrap the sections in an "Assignment info" disclosure (Grading desk style). */
  collapsible?: boolean
}

/** The one renderer for an assignment's descriptive text. */
export const AssignmentInfo: React.FC<AssignmentInfoProps> = ({
  description,
  instructions,
  customInstructions,
  collapsible = false,
}) => {
  const [open, setOpen] = useState(false)
  if (!description && !instructions && !customInstructions) return null

  const sections = (
    <div className="space-y-3">
      {description && <Section label="Description" text={description} />}
      {instructions && <Section label="Instructions" text={instructions} />}
      {customInstructions && <Section label="Custom instructions" text={customInstructions} />}
    </div>
  )

  if (!collapsible) return sections

  return (
    <div className="bg-panel-2 border border-line rounded-[11px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-panel transition-colors"
      >
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">Assignment info</p>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 border-t border-line pt-3">{sections}</div>}
    </div>
  )
}

interface SubmissionCardProps {
  notes?: string | null
  artifacts?: string[] | null
}

/** The one renderer for a student's submission (notes + artifact links). */
export const SubmissionCard: React.FC<SubmissionCardProps> = ({ notes, artifacts }) => {
  if (!notes && !(artifacts && artifacts.length > 0)) return null
  return (
    <div className="bg-panel-2 border border-line-3 rounded-[11px] p-4">
      <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-2">Student submission</p>
      {notes && <p className="text-[13.5px] text-ink-2 leading-relaxed">{notes}</p>}
      {artifacts && artifacts.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {artifacts.map((af, i) => (
            <a
              key={i}
              href={af}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-panel border border-line rounded-[8px] text-[12.5px] text-accent hover:underline"
            >
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              {af}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
