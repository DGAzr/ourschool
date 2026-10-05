import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import MyLessons from './MyLessons'
import { lessonsApi } from '../services/lessons'
import { todayISO } from '../utils/dates'

vi.mock('../services/lessons', () => ({lessonsApi: {myLessons: vi.fn().mockResolvedValue([])}}))
vi.mock('../services/terms', () => ({termsApi: {getActive: vi.fn().mockResolvedValue({start_date:'2026-09-01',end_date:'2026-12-18'})}}))
afterEach(() => vi.useRealTimers())

it('requests the learner local school date instead of relying on server midnight', async () => {
  vi.useFakeTimers({toFake:['Date']})
  vi.setSystemTime(new Date('2026-10-05T00:30:00Z'))
  render(<MemoryRouter><MyLessons /></MemoryRouter>)
  await screen.findByText('No lessons on the schedule')
  await waitFor(() => expect(lessonsApi.myLessons).toHaveBeenCalledWith({start_date:todayISO(),end_date:'2026-12-18'}))
})
