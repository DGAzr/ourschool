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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

import LessonTemplateDetailModal from './LessonTemplateDetailModal'
import type {
  LessonStudentSummary,
  LessonTemplateLink,
} from '../../types/lesson'
import type {
  AssignmentTemplate,
  StudentAssignment,
} from '../../types/assignment'
import { assignmentsApi } from '../../services/assignments'

vi.mock('../../services/assignments', () => ({
  assignmentsApi: {
    getById: vi.fn(),
    getTemplateAssignments: vi.fn(),
  },
}))

const template: AssignmentTemplate = {
  id: 42,
  name: 'Fractions worksheet',
  description: 'Practice adding fractions.',
  instructions: 'Show your work for every problem.',
  assignment_type: 'worksheet',
  subject_id: 3,
  max_points: 20,
  estimated_duration_minutes: 30,
  is_exportable: false,
  is_library: false,
  is_archived: false,
  created_by: 1,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
}

const link: LessonTemplateLink = {
  id: 7,
  template_id: 42,
  template: {
    id: 42,
    name: 'Fractions worksheet',
    assignment_type: 'worksheet',
    max_points: 20,
    estimated_duration_minutes: 30,
    subject_id: 3,
  },
}

const students: LessonStudentSummary[] = [
  {
    id: 8,
    first_name: 'Maya',
    last_name: 'Rivera',
    username: 'maya.rivera',
  },
  {
    id: 9,
    first_name: 'Miles',
    last_name: 'Rivera',
    username: 'miles.rivera',
  },
]

const studentAssignment = (
  overrides: Partial<StudentAssignment>
): StudentAssignment => ({
  id: 91,
  template_id: 42,
  student_id: 8,
  lesson_id: 12,
  assigned_date: '2026-07-01',
  status: 'not_started',
  is_graded: false,
  time_spent_minutes: 0,
  assigned_by: 1,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  ...overrides,
})

const LocationProbe = () => {
  const location = useLocation()
  return (
    <output data-testid="location">
      {JSON.stringify({ pathname: location.pathname, state: location.state })}
    </output>
  )
}

const renderModal = (
  modalLink: LessonTemplateLink | null,
  onClose = () => {}
) =>
  render(
    <MemoryRouter initialEntries={['/lesson-planning']}>
      <LessonTemplateDetailModal
        link={modalLink}
        lessonId={12}
        students={students}
        onClose={onClose}
      />
      <LocationProbe />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.mocked(assignmentsApi.getTemplateAssignments).mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('LessonTemplateDetailModal', () => {
  it('renders nothing when link is null', () => {
    renderModal(null)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(assignmentsApi.getById).not.toHaveBeenCalled()
  })

  it('fetches the template and shows its details', async () => {
    vi.mocked(assignmentsApi.getById).mockResolvedValue(template)
    renderModal(link)

    expect(assignmentsApi.getById).toHaveBeenCalledWith(42)
    expect(screen.getByText('Fractions worksheet')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Practice adding fractions.')).toBeTruthy()
    })
    expect(screen.getByText('Show your work for every problem.')).toBeTruthy()
    expect(screen.getByText('20 pts')).toBeTruthy()
    expect(screen.getByText('30 min')).toBeTruthy()
  })

  it('labels per-lesson overrides', async () => {
    vi.mocked(assignmentsApi.getById).mockResolvedValue(template)
    renderModal(
      {
        ...link,
        custom_max_points: 10,
        custom_due_date: '2026-07-20',
        custom_instructions: 'Only the odd-numbered problems.',
      }
    )

    await waitFor(() => {
      expect(screen.getByText('10 pts (lesson override, normally 20)')).toBeTruthy()
    })
    expect(screen.getByText(/Jul 20, 2026/)).toBeTruthy()
    expect(screen.getByText('Only the odd-numbered problems.')).toBeTruthy()
  })

  it('shows an error state when the fetch fails', async () => {
    vi.mocked(assignmentsApi.getById).mockRejectedValue(new Error('boom'))
    renderModal(link)

    await waitFor(() => {
      expect(
        screen.getByText('Could not load assignment details. Close and try again.')
      ).toBeTruthy()
    })
  })

  it('links each lesson assignment to its grading record', async () => {
    vi.mocked(assignmentsApi.getById).mockResolvedValue(template)
    vi.mocked(assignmentsApi.getTemplateAssignments).mockResolvedValue([
      studentAssignment({}),
      studentAssignment({ id: 92, student_id: 9 }),
      studentAssignment({ id: 93, lesson_id: 99 }),
    ])
    const onClose = vi.fn()
    renderModal(link, onClose)

    const milesLink = await screen.findByRole('button', {
      name: 'Open Miles Rivera in grading',
    })
    expect(
      screen.getByRole('button', { name: 'Open Maya Rivera in grading' })
    ).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: /in grading$/ })
    ).toHaveLength(2)

    fireEvent.click(milesLink)

    expect(onClose).toHaveBeenCalledOnce()
    expect(JSON.parse(screen.getByTestId('location').textContent ?? '')).toEqual({
      pathname: '/grading',
      state: { assignmentId: 92 },
    })
  })
})
