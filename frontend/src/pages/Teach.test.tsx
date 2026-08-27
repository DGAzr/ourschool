import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import Teach from './Teach'
import { AuthContext, AuthContextType } from '../contexts/AuthContext'
import { ToastContext } from '../components/ui/useToast'
import { useLessons } from '../hooks/useLessons'
import { lessonsApi } from '../services/lessons'
import { subjectsApi } from '../services/subjects'
import { assignmentsApi } from '../services/assignments'
import { Lesson } from '../types/lesson'
import { User } from '../types'

vi.mock('../hooks/useLessons', () => ({ useLessons: vi.fn() }))
vi.mock('../components/lessons/LessonEditor', () => ({
  default: ({ onSaved, onDeleted }: {
    onSaved: (warnings: string[]) => void
    onDeleted: (warnings: string[]) => void
  }) => (
    <div>
      <button onClick={() => onSaved(['Assignment updated.'])}>Finish save</button>
      <button onClick={() => onDeleted([])}>Finish delete</button>
    </div>
  ),
}))

const rollover = vi.spyOn(lessonsApi, 'rollover')
const getSubjects = vi.spyOn(subjectsApi, 'getAll')
const getStudents = vi.spyOn(assignmentsApi, 'getStudents')

const admin: User = {
  id: 1,
  email: 'teacher@example.com',
  username: 'teacher',
  first_name: 'Teacher',
  last_name: 'One',
  role: 'admin',
  is_active: true,
  created_at: '',
  updated_at: '',
}

const lesson: Lesson = {
  id: 7,
  external_id: 'teach-7',
  position: 0,
  title: 'Fractions',
  date: '2026-08-22',
  status: 'ready',
  templates: [],
  students: [],
  materials: [],
  resources: [],
  paperless_materials: [],
  created_at: '',
  updated_at: '',
}

const authValue = (user: User): AuthContextType => ({
  user,
  login: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
  isLoading: false,
  isTokenValid: true,
  timeRemaining: '',
  showExpiryWarning: false,
  refreshTokenCheck: vi.fn(),
  extendSession: vi.fn(),
  trackActivity: vi.fn(),
})

const Location = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

const renderTeach = (user: User, entry = '/teach', toast = vi.fn()) =>
  render(
    <AuthContext.Provider value={authValue(user)}>
      <ToastContext.Provider value={{ toast }}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/teach" element={<Teach />} />
            <Route path="/lessons" element={<Location />} />
          </Routes>
        </MemoryRouter>
      </ToastContext.Provider>
    </AuthContext.Provider>
  )

describe('Teach page', () => {
  const refetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    rollover.mockResolvedValue({
      moved_count: 0,
      lessons: [],
      warnings: [],
    })
    getSubjects.mockResolvedValue([])
    getStudents.mockResolvedValue([])
    vi.mocked(useLessons).mockReturnValue({
      lessons: [lesson],
      loading: false,
      error: null,
      refetch,
      markTaught: vi.fn().mockResolvedValue(true),
      toggleMaterial: vi.fn().mockResolvedValue(true),
      setStatus: vi.fn(),
      reorder: vi.fn(),
    })
  })

  it('denies student access without running lesson rollover', () => {
    renderTeach({ ...admin, id: 2, role: 'student' })
    expect(screen.getByText('Teaching tools are available to teachers only.')).toBeTruthy()
    expect(lessonsApi.rollover).not.toHaveBeenCalled()
  })

  it('loads the URL-selected day and runs overdue reconciliation', async () => {
    renderTeach(admin, '/teach?date=2026-08-22')
    await screen.findByText('Fractions')
    expect(lessonsApi.rollover).toHaveBeenCalledOnce()
    expect(useLessons).toHaveBeenLastCalledWith({
      startDate: '2026-08-22',
      endDate: '2026-08-22',
    })
  })

  it('refreshes after editing and surfaces rollover and save warnings', async () => {
    const toast = vi.fn()
    rollover.mockResolvedValue({
      moved_count: 1,
      lessons: [],
      warnings: ['Recovered overdue lesson.'],
    })
    renderTeach(admin, '/teach?date=2026-08-22', toast)

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finish save' }))

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(2))
    expect(toast).toHaveBeenCalledWith('Recovered overdue lesson.', 'danger')
    expect(toast).toHaveBeenCalledWith('Assignment updated.', 'danger')
  })

  it('preserves the selected date when opening Lesson Planning', async () => {
    renderTeach(admin, '/teach?date=2026-08-22')
    fireEvent.click(await screen.findByRole('button', { name: 'Plan lessons' }))
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/lessons?date=2026-08-22'
    )
  })
})
