import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import GradeForm, { GradeDraft } from './GradeForm'

const ResponsiveGrade = ({ layout, save }: { layout: string; save: (points: number, feedback: string, advance: boolean) => void }) => {
  const [draft, setDraft] = useState<GradeDraft>({ points: '', feedback: '' })
  return <GradeForm key={layout} draft={draft} onDraftChange={setDraft} maxPoints={20} hasNext onSave={save} work={<p>Finished on paper. Review question 4.</p>} />
}

describe('grading work and feedback', () => {
  it('keeps a score and feedback when the responsive layout remounts the form', async () => {
    const save = vi.fn()
    const { rerender } = render(<ResponsiveGrade layout="wide" save={save} />)
    await userEvent.clear(screen.getByLabelText('Points earned'))
    await userEvent.type(screen.getByLabelText('Points earned'), '18')
    await userEvent.type(screen.getByLabelText('Feedback to student'), 'Explain question 4.')
    rerender(<ResponsiveGrade layout="narrow" save={save} />)
    expect(screen.getByLabelText('Points earned')).toHaveValue(18)
    expect(screen.getByLabelText('Feedback to student')).toHaveValue('Explain question 4.')
    expect(screen.getByText('Finished on paper. Review question 4.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Save & next' }))
    expect(save).toHaveBeenCalledWith(18, 'Explain question 4.', true)
  })
  it('accepts a genuine zero grade and prevents saving while busy', async () => {
    const save = vi.fn()
    const { rerender } = render(<GradeForm maxPoints={20} initialPoints={0} hasNext={false} onSave={save} />)
    expect(screen.getByRole('button', { name: 'Save & finish' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Save & finish' }))
    expect(save).toHaveBeenCalledWith(0, '', true)
    rerender(<GradeForm maxPoints={20} initialPoints={0} hasNext={false} onSave={save} saving />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
