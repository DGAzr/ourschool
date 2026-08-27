import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import TeachView from './TeachView'
import { Lesson } from '../../types/lesson'

const lesson: Lesson = {
  id: 7,
  external_id: 'teach-7',
  position: 0,
  title: 'Fractions',
  date: '2026-08-22',
  subject_id: 3,
  subject: { id: 3, name: 'Math', color: '#3D6098' },
  status: 'ready',
  templates: [],
  students: [
    { id: 2, first_name: 'Ada', last_name: 'Rivera', username: 'ada' },
  ],
  materials: [
    { id: 11, label: 'Fraction tiles', is_gathered: false, position: 0 },
  ],
  resources: [],
  paperless_materials: [],
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

const defaultProps = {
  subjects: [
    { id: 3, name: 'Math', color: '#3D6098', created_at: '2026-01-01T00:00:00Z' },
  ],
  selectedDate: '2026-08-22',
  lessons: [] as Lesson[],
  loading: false,
  error: null as string | null,
  onSelectDate: vi.fn(),
  onEditLesson: vi.fn(),
  onMarkTaught: vi.fn(),
  onToggleMaterial: vi.fn(),
  onOpenPlanner: vi.fn(),
}

describe('TeachView', () => {
  it('labels the selected teaching date and requests exact-date changes', () => {
    const onSelectDate = vi.fn()
    render(<TeachView {...defaultProps} onSelectDate={onSelectDate} />)

    expect(screen.getByText(/Teach · Saturday, August 22/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Choose teaching date'), {
      target: { value: '2026-08-24' },
    })

    expect(onSelectDate).toHaveBeenCalledWith('2026-08-24')
  })

  it('separates loading and failures from the empty run-sheet', () => {
    const { rerender } = render(<TeachView {...defaultProps} loading />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy()

    rerender(<TeachView {...defaultProps} error="Failed to load lessons." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load lessons.')
    expect(screen.queryByText(/No lessons scheduled/)).toBeNull()
  })

  it('links both the header and empty state back to planning', () => {
    const onOpenPlanner = vi.fn()
    render(<TeachView {...defaultProps} onOpenPlanner={onOpenPlanner} />)

    const actions = screen.getAllByRole('button', { name: 'Plan lessons' })
    expect(actions).toHaveLength(2)
    fireEvent.click(actions[0])
    fireEvent.click(actions[1])
    expect(onOpenPlanner).toHaveBeenCalledTimes(2)
  })

  it('exposes editing, taught status, and material gathering as distinct actions', () => {
    const onEditLesson = vi.fn()
    const onMarkTaught = vi.fn()
    const onToggleMaterial = vi.fn()
    render(
      <TeachView
        {...defaultProps}
        lessons={[lesson]}
        onEditLesson={onEditLesson}
        onMarkTaught={onMarkTaught}
        onToggleMaterial={onToggleMaterial}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark taught' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fraction tiles' }))

    expect(onEditLesson).toHaveBeenCalledWith(lesson)
    expect(onMarkTaught).toHaveBeenCalledWith(lesson)
    expect(onToggleMaterial).toHaveBeenCalledWith(7, 11, true)
  })

  it('clears active filters when the selected date changes', () => {
    const { rerender } = render(<TeachView {...defaultProps} lessons={[lesson]} />)
    fireEvent.click(screen.getByRole('button', { name: /Ada/ }))
    expect(screen.getByRole('button', { name: /Clear · 1 of 1/ })).toBeTruthy()

    rerender(
      <TeachView
        {...defaultProps}
        selectedDate="2026-08-24"
        lessons={[{ ...lesson, date: '2026-08-24' }]}
      />
    )
    expect(screen.queryByRole('button', { name: /Clear ·/ })).toBeNull()
  })
})
