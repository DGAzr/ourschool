import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../services/api'
import { lessonsApi } from '../../services/lessons'
import type { DashboardSchedule } from '../../types/dashboard'
import { TeacherSchedule } from './TeacherSchedule'
import TodayCompletion from './TodayCompletion'

const context = vi.hoisted(() => ({ animate: true }))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 99, celebrate_completion: context.animate } }),
}))
vi.mock('../ui', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const get = vi.spyOn(api, 'get')
const setStatus = vi.spyOn(lessonsApi, 'setStatus')
let schedule: DashboardSchedule

function Schedule({ scope = 'today' }: { scope?: string }) {
  const [version, setVersion] = useState(0)
  return (
    <MemoryRouter>
      <TeacherSchedule
        today="2026-10-06"
        scope={scope}
        studentId={null}
        version={version}
        refresh={() => setVersion((value) => value + 1)}
      />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  context.animate = true
  const seen = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => seen.get(key) ?? null,
    setItem: (key: string, value: string) => seen.set(key, value),
  })
  schedule = {
    items: [{
      id: 7,
      title: 'Fractions today',
      date: '2026-10-06',
      status: 'taught',
      students: [],
      materials: [],
    }],
    total: 12,
    taught: 12,
    has_more: true,
    offset: 0,
    start_date: '2026-10-06',
    end_date: '2026-10-06',
    today_planned: 0,
    materials_remaining: 0,
    attendance: { total: 2, recorded: 2, records: [] },
  }
  get.mockImplementation(async () => structuredClone(schedule))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('teacher schedule completion', () => {
  it('highlights the entire lessons panel and celebrates a completed day', async () => {
    render(<Schedule />)
    const heading = await screen.findByRole('heading', { name: 'Lessons complete' })
    expect(heading.parentElement).toHaveClass('bg-pos-bg')
    expect(screen.getByText('Fractions today').closest('ul')?.parentElement).toBe(heading.parentElement)
    expect(screen.getByRole('status')).toHaveTextContent('All done for today!')
    expect(screen.queryByText('Before finishing today')).not.toBeInTheDocument()
    expect(document.querySelector('.today-confetti')).toBeInTheDocument()
  })

  it('uses full schedule totals even when every visible lesson is taught', async () => {
    schedule.taught = 11
    schedule.today_planned = 1
    render(<Schedule />)
    const heading = await screen.findByRole('heading', { name: 'Lessons' })
    expect(heading.parentElement).not.toHaveClass('bg-pos-bg')
    expect(screen.queryByText('All done for today!')).not.toBeInTheDocument()
  })

  it('waits for every attendance record before celebrating', async () => {
    schedule.attendance.recorded = 1
    render(<Schedule />)
    await screen.findByText('Lessons complete')
    expect(screen.getByText('Before finishing today')).toBeInTheDocument()
    expect(screen.queryByText('All done for today!')).not.toBeInTheDocument()
  })

  it('celebrates after marking the last lesson taught and refreshing', async () => {
    schedule.total = 1
    schedule.taught = 0
    schedule.today_planned = 1
    schedule.items[0].status = 'ready'
    setStatus.mockImplementation(async () => {
      schedule.items[0].status = 'taught'
      schedule.taught = 1
      schedule.today_planned = 0
      return { ...schedule.items[0] } as Awaited<ReturnType<typeof lessonsApi.setStatus>>
    })
    render(<Schedule />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mark taught' }))
    await screen.findByText('All done for today!')
    expect(setStatus).toHaveBeenCalledWith(7, 'taught')
    expect(screen.getByText('Lessons complete').parentElement).toHaveClass('bg-pos-bg')
  })

  it('does not celebrate an empty day or the week view', async () => {
    const first = render(<Schedule scope="week" />)
    await screen.findByText('Lessons complete')
    expect(screen.queryByText('All done for today!')).not.toBeInTheDocument()
    first.unmount()
    schedule.items = []
    schedule.total = 0
    schedule.taught = 0
    render(<Schedule />)
    await screen.findByText('No lessons scheduled in this view.')
    expect(screen.queryByText('Lessons complete')).not.toBeInTheDocument()
    expect(screen.queryByText('All done for today!')).not.toBeInTheDocument()
  })

  it('keeps completion feedback when the celebration preference is off', async () => {
    context.animate = false
    render(<Schedule />)
    await screen.findByText('All done for today!')
    expect(document.querySelector('.today-confetti')).not.toBeInTheDocument()
  })
})

describe('completion animation', () => {
  it('ends after a brief burst and does not replay on remount for the same day', () => {
    vi.useFakeTimers()
    const first = render(<TodayCompletion celebrationKey="day-one" animate />)
    expect(document.querySelector('.today-confetti')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2400))
    expect(document.querySelector('.today-confetti')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('All done for today!')
    first.unmount()
    const second = render(<TodayCompletion celebrationKey="day-one" animate />)
    expect(document.querySelector('.today-confetti')).not.toBeInTheDocument()
    second.unmount()
    render(<TodayCompletion celebrationKey="day-two" animate />)
    expect(document.querySelector('.today-confetti')).toBeInTheDocument()
  })
})
