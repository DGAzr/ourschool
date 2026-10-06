import { render, screen, within } from '@testing-library/react'
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

describe('instructor feedback', () => {
  it('shows the full Markdown feedback alongside the grade', () => {
    render(<StudentAssignmentCard assignment={{
      ...work, status: 'graded', is_graded: true, points_earned: 92,
      teacher_feedback: '**Great work!** Keep practicing *fractions*.\n\n- Show each step\n- Check your answer\n\n[Review examples](https://example.com/fractions)\n\nOne more thing: explain how you checked your work.',
    }} />)

    expect(screen.getByText('92 / 100')).toBeVisible()
    const feedback = within(screen.getByRole('region', { name: 'Instructor feedback' }))
    expect(feedback.getByText('Great work!').tagName).toBe('STRONG')
    expect(feedback.getByText('fractions').tagName).toBe('EM')
    expect(feedback.getAllByRole('listitem')).toHaveLength(2)
    expect(feedback.getByRole('link', { name: 'Review examples' })).toHaveAttribute('href', 'https://example.com/fractions')
    expect(feedback.getByText('One more thing: explain how you checked your work.')).toBeVisible()
  })

  it('shows feedback even without a numeric grade', () => {
    render(<StudentAssignmentCard assignment={{ ...work, status: 'excused', teacher_feedback: 'Thanks for showing me your work.' }} simple />)
    expect(screen.getByRole('region', { name: 'Instructor feedback' })).toBeVisible()
    expect(screen.getByText('Thanks for showing me your work.')).toBeVisible()
  })

  it.each([undefined, '', ' \n\t '])('omits the panel for empty feedback (%j)', teacher_feedback => {
    render(<StudentAssignmentCard assignment={{ ...work, teacher_feedback }} />)
    expect(screen.queryByRole('region', { name: 'Instructor feedback' })).not.toBeInTheDocument()
  })

  it('uses sanitized Markdown for instructor content', () => {
    render(<StudentAssignmentCard assignment={{
      ...work, teacher_feedback: '[Unsafe link](javascript:alert(1))\n\n<script>alert(1)</script>',
    }} />)
    const panel = screen.getByRole('region', { name: 'Instructor feedback' })
    expect(within(panel).getByText('Unsafe link')).not.toHaveAttribute('href', 'javascript:alert(1)')
    expect(panel.querySelector('script')).toBeNull()
  })
})
