import { DndContext } from '@dnd-kit/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Lesson } from '../../types/lesson'
import LessonDrawer from './LessonDrawer'

const lesson: Lesson = {
  id: 7,
  external_id: 'drawer-7',
  position: 0,
  title: 'Fractions later',
  date: null,
  last_scheduled_date: '2026-08-14',
  status: 'planned',
  templates: [],
  students: [],
  materials: [],
  resources: [],
  paperless_materials: [],
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

const renderDrawer = (onSchedule = vi.fn()) =>
  render(
    <DndContext>
      <LessonDrawer
        columnId="drawer"
        lessons={[lesson]}
        defaultDate="2026-08-15"
        onAdd={() => {}}
        onLessonClick={() => {}}
        onSchedule={onSchedule}
      />
    </DndContext>
  )

describe('LessonDrawer', () => {
  it('shows count, former date, and collapses without losing the count', () => {
    renderDrawer()
    expect(screen.getByText('Fractions later')).toBeTruthy()
    expect(screen.getByText(/Was scheduled/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Lesson Drawer/ }))
    expect(screen.queryByText('Fractions later')).toBeNull()
    expect(screen.getByLabelText('Lesson Drawer, 1 lessons')).toBeTruthy()
  })

  it('schedules a drawer lesson for the selected date', () => {
    const onSchedule = vi.fn()
    renderDrawer(onSchedule)
    fireEvent.change(screen.getByLabelText('Schedule Fractions later'), {
      target: { value: '2026-08-19' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(onSchedule).toHaveBeenCalledWith(lesson, '2026-08-19')
  })
})
