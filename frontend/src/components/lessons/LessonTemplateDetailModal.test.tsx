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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import LessonTemplateDetailModal from './LessonTemplateDetailModal'
import type { LessonTemplateLink } from '../../types/lesson'
import type { AssignmentTemplate } from '../../types/assignment'
import { assignmentsApi } from '../../services/assignments'

vi.mock('../../services/assignments', () => ({
  assignmentsApi: {
    getById: vi.fn(),
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

afterEach(() => {
  vi.clearAllMocks()
})

describe('LessonTemplateDetailModal', () => {
  it('renders nothing when link is null', () => {
    const { container } = render(
      <LessonTemplateDetailModal link={null} onClose={() => {}} />
    )
    expect(container.firstChild).toBeNull()
    expect(assignmentsApi.getById).not.toHaveBeenCalled()
  })

  it('fetches the template and shows its details', async () => {
    vi.mocked(assignmentsApi.getById).mockResolvedValue(template)
    render(<LessonTemplateDetailModal link={link} onClose={() => {}} />)

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
    render(
      <LessonTemplateDetailModal
        link={{
          ...link,
          custom_max_points: 10,
          custom_due_date: '2026-07-20',
          custom_instructions: 'Only the odd-numbered problems.',
        }}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('10 pts (lesson override, normally 20)')).toBeTruthy()
    })
    expect(screen.getByText(/Jul 20, 2026/)).toBeTruthy()
    expect(screen.getByText('Only the odd-numbered problems.')).toBeTruthy()
  })

  it('shows an error state when the fetch fails', async () => {
    vi.mocked(assignmentsApi.getById).mockRejectedValue(new Error('boom'))
    render(<LessonTemplateDetailModal link={link} onClose={() => {}} />)

    await waitFor(() => {
      expect(
        screen.getByText('Could not load assignment details. Close and try again.')
      ).toBeTruthy()
    })
  })
})
