import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import SubmissionDialog from './SubmissionDialog'
import type { StudentAssignment } from '../../types'

it('marks paper work ready in one action without requesting files or a URL', async () => {
  const submit = vi.fn()
  const assignment = { id: 7, submission_method: 'online', template: { name: 'Nature notes', max_points: 10 } } as StudentAssignment
  const { container } = render(<SubmissionDialog assignment={assignment} isOpen onClose={vi.fn()} onSubmit={submit} />)
  expect(screen.getByLabelText('Finished on paper — I’ll show my teacher')).toBeChecked()
  expect(container.querySelector('input[type="file"]')).toBeNull()
  await userEvent.type(screen.getByLabelText('Notes to teacher'), 'My notebook is on the table.')
  await userEvent.click(screen.getByRole('button', { name: 'Ready for my teacher' }))
  expect(submit).toHaveBeenCalledExactlyOnceWith({ submission_method: 'paper', submission_notes: 'My notebook is on the table.' })
})

it('retains existing online links and validates them before completion', async () => {
  const submit = vi.fn()
  const assignment = { id: 7, template: { name: 'Nature notes', max_points: 10 } } as StudentAssignment
  render(<SubmissionDialog assignment={assignment} isOpen onClose={vi.fn()} onSubmit={submit} />)
  await userEvent.click(screen.getByLabelText('Finished online'))
  await userEvent.type(screen.getByLabelText('Work link'), 'not a link')
  await userEvent.click(screen.getByRole('button', { name: 'Ready for my teacher' }))
  expect(submit).not.toHaveBeenCalled()
  await userEvent.clear(screen.getByLabelText('Work link'))
  await userEvent.type(screen.getByLabelText('Work link'), 'https://example.com/work')
  await userEvent.click(screen.getByRole('button', { name: 'Ready for my teacher' }))
  expect(submit).toHaveBeenCalledExactlyOnceWith({ submission_method: 'online', submission_artifacts: ['https://example.com/work'] })
})
