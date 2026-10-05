import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { lessonsApi } from '../../services/lessons'
import type { Lesson } from '../../types/lesson'
import LessonBoard from './LessonBoard'
import LessonEditor from './LessonEditor'

let dragEnd: ComponentProps<typeof DndContext>['onDragEnd']
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...original,
    DndContext: (props: ComponentProps<typeof DndContext>) => {
      dragEnd = props.onDragEnd
      return <original.DndContext {...props} />
    },
  }
})
vi.mock('../../hooks/usePaperlessStatus', () => ({
  usePaperlessStatus: () => ({ status: null, loading: false }),
}))
vi.mock('../../services/lessons', () => ({ lessonsApi: { update: vi.fn(), impact: vi.fn().mockResolvedValue([]) } }))
vi.mock('../ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ui')>()),
  useToast: () => ({ toast: vi.fn() }),
}))

const taught: Lesson = {
  id: 7,
  external_id: 'lesson-7',
  position: 0,
  title: 'Taught fractions',
  date: '2026-09-09',
  status: 'taught',
  templates: [],
  students: [],
  materials: [],
  resources: [],
  paperless_materials: [],
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}
const other: Lesson = {
  ...taught,
  id: 8,
  position: 1,
  title: 'Next lesson',
  status: 'ready',
}

const renderBoard = (lessons = [taught, other]) => {
  const onReorder = vi.fn().mockResolvedValue(true)
  render(
    <LessonBoard
      days={[
        {
          iso: '2026-09-09', weekdayLabel: 'Wed', dayNum: 9,
          isWeekend: false, isToday: true,
        },
        {
          iso: '2026-09-10', weekdayLabel: 'Thu', dayNum: 10,
          isWeekend: false, isToday: false,
        },
      ]}
      lessons={lessons}
      drawerLessons={[]}
      onAdd={vi.fn()}
      onLessonClick={vi.fn()}
      onReorder={onReorder}
      onSchedule={vi.fn()}
      onRestoreTaught={vi.fn()}
      onToggleMaterial={vi.fn()}
      onAddToDrawer={vi.fn()}
    />
  )
  return onReorder
}

beforeEach(() => vi.clearAllMocks())

describe('taught lesson movement', () => {
  it('enables dragging a taught card and its Stash action', async () => {
    const onReorder = renderBoard()
    const card = screen.getByRole('button', { name: /Taught fractions/ })
    expect(card).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(screen.getAllByRole('button', { name: 'Stash' })[0])
    await waitFor(() => expect(onReorder).toHaveBeenCalledWith(null, [7]))
  })

  it.each([
    [8, '2026-09-09', [7, 8]],
    ['col:2026-09-10', '2026-09-10', [7]],
    ['lesson-drawer', null, [7]],
  ])('accepts a taught lesson drop onto %s', async (overId, date, ids) => {
    const onReorder = renderBoard([
      { ...other, position: 0 },
      { ...taught, position: 1 },
    ])
    await act(async () => {
      dragEnd?.({
        active: { id: 7 },
        over: { id: overId },
      } as Parameters<NonNullable<typeof dragEnd>>[0])
    })
    expect(onReorder).toHaveBeenCalledWith(date, ids)
  })

  it.each(['2026-09-12', ''])(
    'preserves taught status when editing the date to %s',
    async (date) => {
      vi.mocked(lessonsApi.update).mockResolvedValue({ lesson: taught, warnings: [] })
      const onSaved = vi.fn()
      render(
        <LessonEditor
          initialDate={taught.date}
          lesson={taught}
          subjects={[]}
          students={[]}
          onClose={vi.fn()}
          onSaved={onSaved}
          onDeleted={vi.fn()}
        />
      )
      fireEvent.change(screen.getByLabelText('Date (optional)'), {
        target: { value: date },
      })
      expect(screen.getByRole('button', { name: 'Taught' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))
      expect(lessonsApi.update).not.toHaveBeenCalled()
      fireEvent.click(await screen.findByRole('button', { name: 'Save lesson' }))
      await waitFor(() => expect(onSaved).toHaveBeenCalled())
      expect(lessonsApi.update).toHaveBeenCalledWith(
        7, expect.objectContaining({ date: date || null, status: 'taught' })
      )
    }
  )
})
