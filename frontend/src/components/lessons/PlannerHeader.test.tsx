import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import PlannerHeader from './PlannerHeader'

describe('PlannerHeader', () => {
  it('selects an exact first date without changing the day count', () => {
    const onSelectDate = vi.fn()
    const { container } = render(
      <PlannerHeader
        rangeLabel="Aug 15–21"
        selectedDate="2026-08-15"
        daysShown={5}
        skipWeekends
        onStepRange={() => {}}
        onSelectDate={onSelectDate}
        onStepDays={() => {}}
        onPlanLesson={() => {}}
      />
    )
    fireEvent.change(screen.getByLabelText('Choose first planner date'), {
      target: { value: '2026-08-22' },
    })
    expect(onSelectDate).toHaveBeenCalledWith('2026-08-22')
    expect(container.querySelector('.lucide-calendar')).not.toBeNull()
  })
})
