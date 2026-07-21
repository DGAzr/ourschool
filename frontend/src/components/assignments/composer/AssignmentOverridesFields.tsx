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

import React from 'react'
import { Input, TextArea } from '../../ui'

interface AssignmentOverridesFieldsProps {
  dueDate: string
  onDueDate: (v: string) => void
  maxPoints?: number
  onMaxPoints: (v: number | undefined) => void
  instructions: string
  onInstructions: (v: string) => void
  defaultMaxPoints: number
}

/** Per-assignment overrides: due date, custom max points, custom instructions. */
const AssignmentOverridesFields: React.FC<AssignmentOverridesFieldsProps> = ({
  dueDate, onDueDate, maxPoints, onMaxPoints, instructions, onInstructions, defaultMaxPoints,
}) => (
  <div className="flex flex-col gap-3">
    <div className="grid grid-cols-2 gap-3">
      <Input
        label="Due date"
        type="date"
        value={dueDate}
        onChange={e => onDueDate(e.target.value)}
      />
      <Input
        label="Custom max points"
        type="number"
        min={1}
        max={1000}
        value={maxPoints ?? ''}
        onChange={e => onMaxPoints(e.target.value ? parseInt(e.target.value) : undefined)}
        placeholder={`Default: ${defaultMaxPoints}`}
      />
    </div>
    <TextArea
      label="Custom instructions"
      value={instructions}
      onChange={e => onInstructions(e.target.value)}
      rows={2}
      placeholder="Anything specific for this assignment…"
    />
  </div>
)

export default AssignmentOverridesFields
