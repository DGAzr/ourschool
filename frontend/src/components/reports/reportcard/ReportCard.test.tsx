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

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import ReportCard from './ReportCard'
import type { ReportCard as ReportCardType } from '../../../types/reports'

const rc: ReportCardType = {
  student_id: 1,
  student_name: 'Ada Ashley',
  term_id: 2,
  term_name: 'Spring',
  academic_year: '2025-2026',
  term_start_date: '2026-01-05',
  term_end_date: '2026-05-29',
  generated_date: '2026-07-15',
  summary: {
    overall_percentage: 91,
    overall_letter_grade: 'A',
    total_assignments: 40,
    completed_assignments: 38,
    subjects_count: 6,
    attendance_rate: 97,
    days_present: 88,
  },
  subject_grades: [],
  parent_signature_line: true,
}

function renderCard(overrides: { isAdmin: boolean }) {
  return render(
    <ReportCard
      reportCard={rc}
      reportCardStudentId="1"
      setReportCardStudentId={() => {}}
      reportCardTermId="2"
      setReportCardTermId={() => {}}
      reportCardLoading={false}
      availableStudentsForReportCard={[{ id: 1, name: 'Ada Ashley' }]}
      availableTermsForReportCard={[{ id: 2, name: 'Spring', academic_year: '2025-2026' }]}
      generateReportCard={async () => {}}
      isAdmin={overrides.isAdmin}
    />
  )
}

describe('ReportCard comments', () => {
  it('never shows fabricated auto-comments', () => {
    renderCard({ isAdmin: true })
    expect(screen.queryByText(/outstanding term/)).toBeNull()
    expect(screen.queryByText(/steady progress/)).toBeNull()
    expect(screen.queryByText(/challenging term/)).toBeNull()
  })

  it('admin: typed comments appear on the card', () => {
    renderCard({ isAdmin: true })
    const box = screen.getByLabelText('Teacher comments')
    fireEvent.change(box, { target: { value: 'Great effort in math this term.' } })
    // The text appears both in the textarea and on the rendered card; assert the
    // rendered card paragraph (a <p>, not the <textarea>) shows it.
    const rendered = screen
      .getAllByText('Great effort in math this term.')
      .filter((el) => el.tagName === 'P')
    expect(rendered).toHaveLength(1)
  })

  it('student: no comments input, fixed snapshot notice instead', () => {
    renderCard({ isAdmin: false })
    expect(screen.queryByLabelText('Teacher comments')).toBeNull()
    expect(
      screen.getByText('Snapshot only — not an official report card.')
    ).toBeTruthy()
  })
})
