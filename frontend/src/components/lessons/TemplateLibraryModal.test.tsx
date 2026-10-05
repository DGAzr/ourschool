import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import TemplateLibraryModal from './TemplateLibraryModal'
import { Subject } from '../../types'

const mocks = vi.hoisted(() => ({ page: vi.fn() }))
vi.mock('../../services/assignments', () => ({ templatePage: mocks.page }))
it('shows the inherited filter and lets the teacher reveal other subjects', async () => {
  const templates = [
    { id: 1, subject_id: 2, name: 'Fractions', assignment_type: 'homework', max_points: 20 },
    { id: 2, subject_id: 3, name: 'Plant journal', assignment_type: 'project', max_points: 10 },
    { id: 3, subject_id: 2, name: 'Already linked', assignment_type: 'homework', max_points: 20 },
  ]
  mocks.page.mockImplementation((params: { subject_id: number | null }) => {
    const items = templates.filter(t => !params.subject_id || t.subject_id === params.subject_id)
    return Promise.resolve({ items, total: items.length, next_cursor: null })
  })
  const subjects = [{ id: 2, name: 'Math' }, { id: 3, name: 'Science' }] as Subject[]
  render(<TemplateLibraryModal isOpen subjects={subjects} subjectId={2} excludeTemplateIds={[3]} onAttach={vi.fn()} onClose={vi.fn()} onCreateNew={vi.fn()} />)
  expect(screen.getByLabelText('Template library subject')).toHaveValue('2')
  expect(screen.getByText('Filtered to Math')).toBeVisible()
  expect(await screen.findByText('2 matching templates · 1 available on this page')).toBeVisible()
  expect(screen.queryByText('Plant journal')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Attach Plant journal' })).toBeVisible())
  expect(screen.getByLabelText('Template library subject')).toHaveValue('')
  expect(screen.queryByText('Already linked')).not.toBeInTheDocument()
})
