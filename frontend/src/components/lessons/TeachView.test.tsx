import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TeachView from './TeachView'
import { useLessons } from '../../hooks/useLessons'

vi.mock('../../hooks/useLessons', () => ({
  useLessons: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useLessons).mockReturnValue({
    lessons: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
    markTaught: vi.fn(),
    toggleMaterial: vi.fn(),
    setStatus: vi.fn(),
    reorder: vi.fn(),
  })
})

describe('TeachView', () => {
  it('loads and labels the exact selected teaching date', async () => {
    render(<TeachView subjects={[]} onLessonClick={() => {}} />)
    fireEvent.change(screen.getByLabelText('Choose teaching date'), {
      target: { value: '2026-08-22' },
    })

    await waitFor(() => {
      expect(useLessons).toHaveBeenLastCalledWith({
        startDate: '2026-08-22',
        endDate: '2026-08-22',
      })
    })
    expect(screen.getByText(/No lessons scheduled for/).textContent).toContain('August 22')
  })
})
