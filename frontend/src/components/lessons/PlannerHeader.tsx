/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Calendar, Lectern, Plus } from 'lucide-react'

import { Button } from '../ui'
import { MAX_DAYS, MIN_DAYS } from '../../utils/lessonPlanning'

interface PlannerHeaderProps {
  rangeLabel: string
  selectedDate: string
  daysShown: number
  skipWeekends: boolean
  onStepRange: (dir: 1 | -1) => void
  onSelectDate: (date: string) => void
  onStepDays: (delta: 1 | -1) => void
  onPlanLesson: () => void
  onOpenTeach: () => void
}

const stepperBtn =
  'w-7 h-7 flex items-center justify-center rounded-[7px] text-ink-2 hover:bg-track disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

/** The Week Planner header: title, range/day steppers, and the primary action. */
const PlannerHeader: React.FC<PlannerHeaderProps> = ({
  rangeLabel,
  selectedDate,
  daysShown,
  skipWeekends,
  onStepRange,
  onSelectDate,
  onStepDays,
  onPlanLesson,
  onOpenTeach,
}) => {
  const dayLabel = `${daysShown} ${skipWeekends ? 'school days' : 'days'}`

  return (
    <div className="flex flex-wrap justify-between items-end gap-x-5 gap-y-4 mb-[18px]">
      <div className="flex-1 min-w-[260px]">
        <h1 className="text-[27px] font-bold tracking-[-0.02em] text-ink">
          Plan the week ahead.
        </h1>
        <p className="text-[14px] text-muted max-w-[520px] mt-1">
          Line up lessons across your school days, gather materials early, and
          keep every student's plan ready to teach.
        </p>
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className="flex flex-wrap items-center justify-end gap-[9px]">
          {/* Date-range stepper */}
          <div className="flex items-center gap-1 bg-panel border border-btn-border rounded-[9px] p-[3px]">
            <button
              type="button"
              aria-label="Previous range"
              onClick={() => onStepRange(-1)}
              className={stepperBtn}
            >
              ‹
            </button>
            <label className="relative min-w-[140px] flex items-center justify-center gap-2 px-1 text-center">
              <span className="font-mono text-[12.5px] text-ink-2">
                {rangeLabel}
              </span>
              <Calendar
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-faint"
              />
              <input
                type="date"
                aria-label="Choose first planner date"
                value={selectedDate}
                onChange={(event) => event.target.value && onSelectDate(event.target.value)}
                onClick={(event) => event.currentTarget.showPicker?.()}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
            <button
              type="button"
              aria-label="Next range"
              onClick={() => onStepRange(1)}
              className={stepperBtn}
            >
              ›
            </button>
          </div>

          {/* Day-count stepper */}
          <div className="flex items-center gap-1 bg-panel border border-btn-border rounded-[9px] p-[3px]">
            <button
              type="button"
              aria-label="Fewer days"
              onClick={() => onStepDays(-1)}
              disabled={daysShown <= MIN_DAYS}
              className={`${stepperBtn} text-[16px]`}
            >
              −
            </button>
            <span className="font-mono text-[12px] text-ink-2 px-1 min-w-[96px] text-center">
              {dayLabel}
            </span>
            <button
              type="button"
              aria-label="More days"
              onClick={() => onStepDays(1)}
              disabled={daysShown >= MAX_DAYS}
              className={`${stepperBtn} text-[16px]`}
            >
              +
            </button>
          </div>

          <Button variant="outline" size="md" icon={<Lectern size={15} />} onClick={onOpenTeach}>
            Teach this day
          </Button>
          <Button variant="primary" size="md" icon={<Plus size={15} />} onClick={onPlanLesson}>
            Plan a lesson
          </Button>
        </div>
      </div>
    </div>
  )
}

export default PlannerHeader
