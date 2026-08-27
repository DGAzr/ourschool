import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  MemoryRouter,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import {
  calendarDateHref,
  useCalendarDateParam,
} from './useCalendarDateParam'
import { todayISO } from '../utils/dates'

const Harness = () => {
  const [date, setDate] = useCalendarDateParam()
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <div>
      <span data-testid="date">{date}</span>
      <span data-testid="search">{location.search}</span>
      <button onClick={() => setDate('2099-08-29')}>Choose future</button>
      <button onClick={() => setDate(todayISO())}>Choose today</button>
      <button onClick={() => navigate(-1)}>Back</button>
    </div>
  )
}

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Harness />
    </MemoryRouter>
  )

describe('useCalendarDateParam', () => {
  it('defaults to today without adding a query parameter', () => {
    renderAt('/teach')
    expect(screen.getByTestId('date')).toHaveTextContent(todayISO())
    expect(screen.getByTestId('search')).toHaveTextContent('')
  })

  it('reads valid dates and replaces invalid dates with the clean today URL', async () => {
    const { unmount } = renderAt('/teach?date=2099-08-29')
    expect(screen.getByTestId('date')).toHaveTextContent('2099-08-29')
    expect(screen.getByTestId('search')).toHaveTextContent('?date=2099-08-29')
    unmount()

    renderAt('/teach?date=2026-02-29')
    expect(screen.getByTestId('date')).toHaveTextContent(todayISO())
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(''))
  })

  it('pushes non-today dates, restores them with back, and removes today', async () => {
    renderAt('/teach')
    fireEvent.click(screen.getByRole('button', { name: 'Choose future' }))
    expect(screen.getByTestId('search')).toHaveTextContent('?date=2099-08-29')

    fireEvent.click(screen.getByRole('button', { name: 'Choose today' }))
    expect(screen.getByTestId('search')).toHaveTextContent('')

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => {
      expect(screen.getByTestId('date')).toHaveTextContent('2099-08-29')
    })
  })

  it('builds clean today links and dated non-today links', () => {
    expect(calendarDateHref('/teach', todayISO())).toBe('/teach')
    expect(calendarDateHref('/lessons', '2099-08-29')).toBe(
      '/lessons?date=2099-08-29'
    )
  })
})
