import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import StudentToday from './StudentToday'
import { lessonsApi } from '../services/lessons'
import { StudentDay } from '../types/lesson'
import { todayISO } from '../utils/dates'

vi.mock('../contexts/AuthContext', () => ({useAuth: () => ({user:{id:2,role:'student',first_name:'Alex'}})}))
vi.mock('../contexts/PointsStatusContext', () => ({usePointsStatus: () => ({enabled:false,ready:true})}))
vi.mock('../services/lessons', () => ({lessonsApi:{myDay:vi.fn()}}))
vi.mock('../components/dashboard/LearnerWins', () => ({default: () => null}))
const empty: StudentDay = {date:todayISO(),lessons:[],standalone:[],earlier:{items:[],total:0},other:{items:[],total:0}}
afterEach(cleanup)
beforeEach(() => { vi.mocked(lessonsApi.myDay).mockReset() })
const mount = () => render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><StudentToday /></MemoryRouter></QueryClientProvider>)
it('uses scheduled work beyond this week and keeps taught work actionable', async () => {
  vi.mocked(lessonsApi.myDay).mockResolvedValue({...empty,lessons:[{id:1,title:'Fractions',date:todayISO(),position:0,status:'taught',templates:[],resources:[],paperless_materials:[],assignments:[{id:12,template_id:1,student_id:2,lesson_id:1,name:'Long practice',due_date:'2099-01-01',status:'not_started',is_graded:false,time_spent_minutes:0,help_requested:true}]}]})
  mount()
  expect(await screen.findByText('0 of 1 activities finished today')).toBeVisible()
  expect(screen.getAllByText('Long practice').length).toBeGreaterThan(0)
  expect(screen.queryByText(/You finished today's plan/)).toBeNull()
  expect(screen.getAllByText(/Help requested/).length).toBeGreaterThan(0)
})
it('shows a truthful completion with older work outside the daily count', async () => {
  vi.mocked(lessonsApi.myDay).mockResolvedValue({...empty,earlier:{items:[],total:3},standalone:[{id:12,template_id:1,student_id:2,name:'Submitted practice',status:'submitted',is_graded:false,time_spent_minutes:0,help_requested:false}]})
  mount()
  expect(await screen.findByText("You finished today's plan!")).toBeVisible()
  expect(screen.getByText(/3 older unfinished activities/)).toBeVisible()
})
it('never claims no work or completion after a request failure', async () => {
  vi.mocked(lessonsApi.myDay).mockRejectedValue(new Error('Network unavailable'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
  expect(screen.queryByText(/No activities scheduled/)).toBeNull()
  expect(screen.queryByText(/You finished/)).toBeNull()
})
