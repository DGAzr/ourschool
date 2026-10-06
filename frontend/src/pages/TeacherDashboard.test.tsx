import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeacherDashboard from './TeacherDashboard'
import { api } from '../services/api'
import { journalApi } from '../services/journal'
import { shopApi } from '../services/shop'
import { saveReviewFilter } from '../utils/dashboard'

const context = vi.hoisted(() => ({ points: true, toast: vi.fn() }))
vi.mock('../contexts/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../contexts/AuthContext')>()),
  useAuth: () => ({ user: { id: 99, role: 'admin', first_name: 'Teacher' } }),
}))
vi.mock('../contexts/PointsStatusContext', () => ({
  usePointsStatus: () => ({ enabled: context.points, ready: true }),
}))
vi.mock('../components/ui/useToast', () => ({
  useToast: () => ({ toast: context.toast }),
}))
vi.mock('../components/dashboard/SetupChecklist', () => ({
  default: () => null,
}))
vi.mock('../components/dashboard/QuickAwardModal', () => ({
  default: () => null,
}))
vi.mock('../components/assignments/composer/AssignmentComposer', () => ({
  default: () => null,
}))
const get = vi.spyOn(api, 'get')
const markRead = vi.spyOn(journalApi, 'markRead')
const approve = vi.spyOn(shopApi, 'approveRedemption')
const journal = {
  id: 10,
  student_id: 2,
  student_name: 'Sam Student',
  title: 'My reflection',
  preview: '**A good day**',
  created_at: '2026-10-01T12:00:00Z',
}
const approval = {
  id: 11,
  student_id: 2,
  student_name: 'Sam Student',
  title: 'Library trip',
  cost_points: 20,
  created_at: '2026-10-01T12:00:00Z',
}
const help = {
  id: 12,
  student_id: 2,
  student_name: 'Sam Student',
  title: 'Math help',
  assignment_id: 4,
  preview: 'Need a hint',
  created_at: '2026-10-01T12:00:00Z',
}
function response(url: string): unknown {
  if (url.includes('/schedule'))
    return {
      items: [
        {
          id: 7,
          title: 'Fractions today',
          date: '2026-10-06',
          status: 'ready',
          students: [{ id: 2, first_name: 'Sam' }],
          materials: [],
        },
      ],
      total: 1,
      taught: 0,
      materials_remaining: 0,
      today_planned: 1,
      attendance: {
        total: 2,
        recorded: 1,
        records: [{ student_id: 2, status: 'absent' }],
      },
    }
  if (url.includes('/preparation')) return { items: [], total: 0, date: null }
  if (url.includes('/inbox'))
    return {
      groups: {
        journals: { items: [journal], total: 1, has_more: false },
        approvals: { items: [approval], total: 1, has_more: false },
        pickups: { items: [], total: 0, has_more: false },
        help: { items: [help], total: 1, has_more: false },
      },
    }
  if (url.includes('/students') || url.includes('/roster'))
    return {
      items: [
        {
          id: 2,
          first_name: 'Sam',
          last_name: 'Student',
          attendance: 'absent',
          work: { review: 3, needs: 1, awaiting: 2, overdue: 1 },
          schedule: { lessons: 1, taught: 0 },
          inbox: { journals: 1, help: 1 },
        },
      ],
      total: 1,
      has_more: false,
    }
  if (url.includes('/assignments/page'))
    return {
      items: [],
      total: 3,
      counts: { review: 3, needs: 1, awaiting: 2, overdue: 1 },
    }
  if (url.includes('/journal/entries/10'))
    return {
      ...journal,
      content: '**Markdown reflection**',
      entry_date: '2026-10-01T12:00:00Z',
      replies: [],
      goals: [],
    }
  if (url.includes('/terms/')) return { name: 'Fall term' }
  return { activities: [] }
}
function mount(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TeacherDashboard />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  context.points = true
  get.mockImplementation(async (url: string) => response(url))
  markRead.mockRejectedValue(new Error('Review failed'))
})
describe('teacher dashboard', () => {
  it('loads bounded independent sections and highlights any recorded attendance', async () => {
    mount()
    await screen.findByText('Fractions today')
    expect(
      screen.getByText('1 of 2 students recorded today').closest('a'),
    ).toHaveClass('bg-pos-bg')
    expect(screen.getByRole('button', { name: 'Combined' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen
        .getAllByRole('link', { name: '1 submitted' })[0]
        .getAttribute('href'),
    ).toContain('queue=needs')
    expect(
      screen
        .getAllByRole('link', { name: '2 awaiting' })[0]
        .getAttribute('href'),
    ).toContain('include_undated=true')
    expect(
      get.mock.calls.every(
        ([url]) =>
          !url.includes('admin-report') && !url.includes('/journal/entries?'),
      ),
    ).toBe(true)
    expect(get.mock.calls.some(([url]) => url.includes('/activity'))).toBe(
      false,
    )
    fireEvent.click(screen.getByText('Recent activity'))
    await waitFor(() =>
      expect(
        get.mock.calls.some(([url]) =>
          url.includes('/dashboard/teacher/activity'),
        ),
      ).toBe(true),
    )
  })
  it('restores the teacher preference but gives an explicit queue priority', async () => {
    saveReviewFilter(99, 'awaiting')
    mount('/?queue=needs&student_id=2&scope=week')
    await screen.findByText('Fractions today')
    expect(screen.getByRole('button', { name: 'Submitted' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const queue =
      get.mock.calls.find(([url]) => url.includes('/assignments/page'))?.[0] ??
      ''
    expect(queue).toContain('student_id=2')
    expect(queue).toContain('tab=needs')
    expect(queue).toContain('due_to=')
    fireEvent.click(screen.getByRole('button', { name: 'Awaiting' }))
    expect(localStorage.getItem('ourschool.review-filter.99')).toBe('awaiting')
  })
  it('isolates section failures and retries without pretending the inbox is empty', async () => {
    let fail = true
    get.mockImplementation(async (url: string) => {
      if (url.includes('/inbox') && fail) throw new Error('Inbox unavailable')
      return response(url)
    })
    mount()
    await screen.findByText('Fractions today')
    await screen.findByText('Inbox unavailable')
    expect(screen.queryByText('Nothing waiting here.')).not.toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('My reflection')
  })
  it('keeps a help draft during focus refresh and preserves failed review requests', async () => {
    mount()
    await screen.findByText('My reflection')
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    fireEvent.change(screen.getByLabelText('Reply to Sam Student'), {
      target: { value: 'Try drawing halves' },
    })
    fireEvent.focus(window)
    await waitFor(() =>
      expect(
        get.mock.calls.filter(([url]) => url.includes('/inbox')).length,
      ).toBeGreaterThan(1),
    )
    expect(screen.getByLabelText('Reply to Sam Student')).toHaveValue(
      'Try drawing halves',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mark reviewed' }))
    await screen.findByText('Review failed')
    expect(screen.getByText('My reflection')).toBeInTheDocument()
  })
  it('reads the full journal with Markdown before replying', async () => {
    mount()
    await screen.findByText('My reflection')
    fireEvent.click(screen.getByRole('button', { name: 'Read & reply' }))
    const rendered = await screen.findByText('Markdown reflection')
    expect(rendered.tagName).toBe('STRONG')
    expect(screen.getByLabelText('Reply to journal entry')).toBeInTheDocument()
  })
  it('hides point actions when points are disabled', async () => {
    context.points = false
    mount()
    await screen.findByText('My reflection')
    expect(screen.queryByText('Shop approvals · 1')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Award points' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument()
    expect(approve).not.toHaveBeenCalled()
  })
})
