import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import StudentAssignmentCard from './StudentAssignmentCard'
import { StudentAssignment } from '../../types'

const work: StudentAssignment = {
  id: 12, template_id: 3, student_id: 5, assigned_date: '2026-01-01',
  due_date: '2026-01-02', status: 'overdue', is_graded: false,
  time_spent_minutes: 0, assigned_by: 1, created_at: '', updated_at: '',
}

describe('student task actions', () => {
  it('offers overdue work a start and an accessible exact-task link', async () => {
    const start = vi.fn()
    render(<MemoryRouter><StudentAssignmentCard assignment={work} viewHref="/assignments/12" onStart={start} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Open assignment' })).toHaveAttribute('href', '/assignments/12')
    expect(screen.getByText('not started')).toBeVisible()
    expect(screen.getByText(/Overdue · You can still finish/)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Start Assignment' }))
    expect(start).toHaveBeenCalledWith(12)
  })
  it('allows started overdue work to be submitted', async () => {
    const complete = vi.fn()
    const started = { ...work, started_date: '2026-01-03' }
    render(<StudentAssignmentCard assignment={started} onComplete={complete} />)
    await userEvent.click(screen.getByRole('button', { name: 'I’m finished' }))
    expect(complete).toHaveBeenCalledWith(started)
  })
  it('opens details by keyboard when a callback is used', async () => {
    const view = vi.fn()
    render(<StudentAssignmentCard assignment={work} onView={view} />)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Open assignment' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(view).toHaveBeenCalledWith(work)
  })
})
