import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import PlannerHeader from './PlannerHeader'

describe('PlannerHeader', () => {
  const renderHeader = (onSelectDate = vi.fn()) =>
    render(
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

  it('selects an exact first date without changing the day count', () => {
    const onSelectDate = vi.fn()
    const { container } = renderHeader(onSelectDate)
    fireEvent.change(screen.getByLabelText('Choose first planner date'), {
      target: { value: '2026-08-22' },
    })
    expect(onSelectDate).toHaveBeenCalledWith('2026-08-22')
    expect(container.querySelector('.lucide-calendar')).not.toBeNull()
  })

  it('opens the native picker when the visible date control is clicked', () => {
    renderHeader()
    const dateInput = screen.getByLabelText(
      'Choose first planner date'
    ) as HTMLInputElement
    const showPicker = vi.fn()
    dateInput.showPicker = showPicker

    fireEvent.click(dateInput)

    expect(showPicker).toHaveBeenCalledOnce()
  })
})
