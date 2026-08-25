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

const visibleLesson: Lesson = {
  ...lesson,
  id: 8,
  external_id: 'visible-8',
  title: 'Fractions today',
  date: '2026-08-15',
  materials: [
    { id: 1, label: 'Fraction tiles', is_gathered: true, position: 0 },
    { id: 2, label: 'Dry erase board', is_gathered: false, position: 1 },
  ],
}

const renderDrawer = (onSchedule = vi.fn(), onCollapsedChange = vi.fn()) =>
  render(
    <DndContext>
      <LessonDrawer
        columnId="drawer"
        lessons={[lesson]}
        visibleLessons={[visibleLesson]}
        defaultDate="2026-08-15"
        collapsed={false}
        onCollapsedChange={onCollapsedChange}
        onAdd={() => {}}
        onLessonClick={() => {}}
        onSchedule={onSchedule}
      />
    </DndContext>
  )

describe('LessonDrawer', () => {
  it('shows count and former date, then requests a responsive collapse', () => {
    const onCollapsedChange = vi.fn()
    renderDrawer(vi.fn(), onCollapsedChange)
    expect(screen.getByText('Fractions later')).toBeTruthy()
    expect(screen.getByText(/Was scheduled/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Lesson Drawer' }))
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
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

  it('summarizes material state for only the lessons in view', () => {
    renderDrawer()
    fireEvent.click(screen.getByRole('tab', { name: /Materials/ }))

    expect(screen.getByText('Fractions today')).toBeTruthy()
    expect(screen.getByText('Fraction tiles')).toBeTruthy()
    expect(screen.getByText('Dry erase board')).toBeTruthy()
    expect(screen.getByText('1 / 2 ready')).toBeTruthy()
    expect(screen.queryByText('Fractions later')).toBeNull()
  })
})
