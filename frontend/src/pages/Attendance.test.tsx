import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Attendance from './Attendance'
import { AttendanceRecord } from '../types'

const mocks = vi.hoisted(() => ({ getAll: vi.fn(), create: vi.fn(), update: vi.fn(), toast: vi.fn() }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }))
vi.mock('../components/ui/useToast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('../services/attendance', () => ({ attendanceApi: {
  ...mocks, getStudents: () => Promise.resolve([
    { id: 2, first_name: 'Alex', last_name: 'Learner' },
    { id: 3, first_name: 'Sam', last_name: 'Learner' },
  ]),
} }))
vi.mock('../services/settings', () => ({ settingsApi: { getGroupedSettings: () => Promise.resolve({ attendance: { required_days_of_instruction: 180 } }) } }))
vi.mock('../services/reports', () => ({ reportsApi: { getAcademicYears: () => Promise.resolve([{ academic_year: '2026–27', start_date: '2026-08-01', end_date: '2027-06-01' }]) } }))
vi.mock('../services/terms', () => ({ termsApi: { getActive: () => Promise.resolve({ academic_year: '2026–27' }) } }))

const row = (id: number, student_id: number, date: string, status: AttendanceRecord['status']): AttendanceRecord => ({ id, student_id, date, status, created_at: '', updated_at: '' })
const rows = [row(10, 2, '2026-07-01', 'late'), row(11, 2, '2026-09-01', 'present'), row(12, 2, '2026-09-02', 'late'), row(13, 3, '2026-09-01', 'absent')]
function open(date = '2026-09-02') { return render(<MemoryRouter initialEntries={[`/attendance?date=${date}`]}><Attendance /></MemoryRouter>) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-04T12:00:00'))
  mocks.getAll.mockImplementation((scope: { start_date: string; end_date: string }) => Promise.resolve(rows.filter(r => r.date >= scope.start_date && r.date <= scope.end_date)))
  mocks.update.mockImplementation((id: number, data: Partial<AttendanceRecord>) => Promise.resolve({ ...rows.find(r => r.id === id), ...data }))
  mocks.create.mockImplementation((data: AttendanceRecord) => Promise.resolve({ ...data, id: 50 }))
})
afterEach(() => vi.useRealTimers())

describe('attendance date and status workflow', () => {
  it('keeps Late distinct and updates an existing outside-year record', async () => {
    open('2026-07-01')
    const late = await screen.findByRole('button', { name: 'Mark Alex Learner Late' })
    await waitFor(() => expect(late).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByLabelText('Choose attendance date')).toHaveValue('2026-07-01')
    await userEvent.click(screen.getByRole('button', { name: 'Mark Alex Learner Excused' }))
    expect(mocks.update).toHaveBeenCalledWith(10, { status: 'excused' })
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('filters history without shrinking annual instruction-day totals', async () => {
    open()
    await screen.findByRole('button', { name: 'Mark Alex Learner Late' })
    await userEvent.click(screen.getByRole('button', { name: 'History & compliance' }))
    await userEvent.selectOptions(screen.getByLabelText('Attendance history student'), '2')
    const from = screen.getByLabelText('Attendance history from')
    // Native date controls have no ordinary text-selection support.
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(from, { target: { value: '2026-09-02' } })
    fireEvent.change(screen.getByLabelText('Attendance history through'), { target: { value: '2026-09-02' } })
    const details = screen.getByText('1 attendance records in this history scope').closest('details')!
    await userEvent.click(within(details).getByText('1 attendance records in this history scope'))
    expect(within(details).getByText('Late')).toBeVisible()
    expect(within(details).queryByText(/Sam/)).not.toBeInTheDocument()
    expect(screen.getByText('2', { selector: 'span' })).toBeVisible() // Alex's full-year instruction days
    expect(screen.getByRole('button', { name: /Wednesday, September 2, 2026 — late/ })).toBeEnabled()
    fireEvent.change(from, { target: { value: '2026-09-03' } })
    expect(screen.getByRole('alert')).toHaveTextContent('start date on or before')
  })
  it('restores the recorded choice after a save fails', async () => {
    mocks.update.mockRejectedValueOnce(new Error('offline'))
    open()
    const late = await screen.findByRole('button', { name: 'Mark Alex Learner Late' })
    await waitFor(() => expect(late).toHaveAttribute('aria-pressed', 'true'))
    await userEvent.click(screen.getByRole('button', { name: 'Mark Alex Learner Absent' }))
    await waitFor(() => expect(late).toHaveAttribute('aria-pressed', 'true'))
    expect(mocks.toast).toHaveBeenCalledWith('Attendance was not saved. Please try again.', 'danger')
  })
  it('keeps Late optional for programs with a scheduled start', async () => {
    open('2026-09-01')
    await screen.findByRole('button', { name: 'Mark Alex Learner Present' })
    expect(screen.queryByRole('button', { name: 'Mark Alex Learner Late' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'More status options' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mark Alex Learner Late' }))
    expect(mocks.update).toHaveBeenCalledWith(11, { status: 'late' })
  })
  it('prevents writes on a future day', async () => {
    open('2026-10-05')
    expect(await screen.findByRole('button', { name: 'Mark Alex Learner Present' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mark all present' })).toBeDisabled()
  })
})
