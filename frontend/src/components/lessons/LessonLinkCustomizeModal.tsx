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

import { useState } from 'react'

import Modal from '../ui/Modal/Modal'
import { Button, Select, Input } from '../ui'
import AssignmentOverridesFields from '../assignments/composer/AssignmentOverridesFields'

export interface LinkDraft {
  template_id: number
  name: string
  assignment_type: string
  max_points: number
  assignment_timing?: 'draft' | 'on_schedule' | 'now'
  due_offset_days?: number
  custom_due_date?: string | null
  custom_max_points?: number | null
  custom_instructions?: string | null
}

interface LessonLinkCustomizeModalProps {
  link: LinkDraft
  /** The lesson's own date, shown as the default when no custom due date is set. */
  lessonDate: string
  onClose: () => void
  onSave: (patch: Partial<LinkDraft>) => void
}

/**
 * Per-link customization for one linked assignment template. Mirrors the assign
 * fields of the assignment composer (due date, custom max points, custom
 * instructions), scoped to a single lesson↔template link.
 */
const LessonLinkCustomizeModal: React.FC<LessonLinkCustomizeModalProps> = ({
  link,
  lessonDate,
  onClose,
  onSave,
}) => {
  const [timing, setTiming] = useState(link.assignment_timing ?? 'on_schedule')
  const [offset, setOffset] = useState(link.due_offset_days ?? 0)
  const [dueDate, setDueDate] = useState(link.custom_due_date ?? '')
  const [maxPoints, setMaxPoints] = useState<number | undefined>(
    link.custom_max_points ?? undefined
  )
  const [instructions, setInstructions] = useState(
    link.custom_instructions ?? ''
  )

  const handleSave = () => {
    onSave({
      assignment_timing: timing,
      due_offset_days: offset,
      custom_due_date: dueDate || null,
      custom_max_points: maxPoints ?? null,
      custom_instructions: instructions.trim() || null,
    })
    onClose()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Customize “${link.name}”`}
      subtitle="Overrides for the assignments this template creates on this lesson."
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            Apply
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select label="When students receive this activity" value={timing} onChange={e => setTiming(e.target.value as typeof timing)} options={[
          {value:'draft', label:'Keep as draft'},
          {value:'on_schedule', label:'Assign when lesson is scheduled'},
          {value:'now', label:'Assign now, including in the drawer'},
        ]} helperText="Changing to draft does not withdraw already published work." />
        <Input label="Days after the lesson to finish" type="number" min={0} max={365} value={offset} onChange={e => setOffset(Number(e.target.value))} helperText="0 means the lesson day. This follows rescheduling until work is submitted or graded." />
        <AssignmentOverridesFields
          dueDate={dueDate}
          onDueDate={setDueDate}
          maxPoints={maxPoints}
          onMaxPoints={setMaxPoints}
          instructions={instructions}
          onInstructions={setInstructions}
          defaultMaxPoints={link.max_points}
        />
        <p className="text-[11.5px] text-muted">
          With no fixed date, work is due {offset} days after the lesson ({lessonDate || 'unscheduled: no deadline'}). A custom date stays
          fixed if the lesson is rescheduled.
        </p>
      </div>
    </Modal>
  )
}

export default LessonLinkCustomizeModal
