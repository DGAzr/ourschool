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

import { Button } from '../../ui'
import { ButtonVariant } from '../../ui/Button/Button.types'

interface AssignmentModalFooterProps {
  onCancel: () => void
  onSubmit?: () => void
  submitText?: string
  cancelText?: string
  loading?: boolean
  disabled?: boolean
  submitVariant?: ButtonVariant
}

const AssignmentModalFooter: React.FC<AssignmentModalFooterProps> = ({
  onCancel,
  onSubmit,
  submitText = 'Save',
  cancelText = 'Cancel',
  loading = false,
  disabled = false,
  submitVariant = 'primary'
}) => {
  return (
    <>
      <Button
        variant="secondary"
        onClick={onCancel}
        disabled={loading}
      >
        {cancelText}
      </Button>
      {onSubmit && (
        <Button
          variant={submitVariant}
          onClick={onSubmit}
          loading={loading}
          disabled={disabled}
          type="submit"
        >
          {submitText}
        </Button>
      )}
    </>
  )
}

export default AssignmentModalFooter