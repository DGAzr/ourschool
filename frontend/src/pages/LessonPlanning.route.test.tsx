import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import LessonPlanning from './LessonPlanning'

const Location = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

describe('Lesson Planning legacy Teach route', () => {
  it('redirects a valid dated Teach deep link without loading the planner', () => {
    render(
      <MemoryRouter initialEntries={['/lessons?view=teach&date=2026-08-22']}>
        <Routes>
          <Route path="/lessons" element={<LessonPlanning />} />
          <Route path="/teach" element={<Location />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/teach?date=2026-08-22'
    )
  })
})
