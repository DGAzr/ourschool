import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import MyLessons from './MyLessons'
import { lessonsApi } from '../services/lessons'
import { addDays, todayISO } from '../utils/dates'

vi.mock('../contexts/AuthContext', () => ({useAuth: () => ({user: {id: 2, role: 'student'}})}))
vi.mock('../services/lessons', () => ({lessonsApi: {myLessons: vi.fn(), myLesson: vi.fn()}}))
beforeEach(() => { vi.mocked(lessonsApi.myLessons).mockResolvedValue([]) })
afterEach(() => { cleanup(); vi.useRealTimers() })
const mount = () => render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><MemoryRouter><MyLessons /></MemoryRouter></QueryClientProvider>)

it('requests a week starting on the learner local school date', async () => {
  vi.useFakeTimers({toFake:['Date']})
  vi.setSystemTime(new Date('2026-10-05T00:30:00Z'))
  mount()
  await screen.findByText(/No lessons on the schedule for these dates/)
  await waitFor(() => expect(lessonsApi.myLessons).toHaveBeenCalledWith({start_date:todayISO(),end_date:addDays(todayISO(),6)}, expect.any(AbortSignal)))
})
it('shows a recoverable error without claiming there is no work', async () => {
  vi.mocked(lessonsApi.myLessons).mockRejectedValue(new Error('Lesson service unavailable'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Lesson service unavailable')
  expect(screen.queryByText(/No lessons on the schedule/)).toBeNull()
  expect(screen.getByRole('button', {name: 'Try again'})).toBeVisible()
})
