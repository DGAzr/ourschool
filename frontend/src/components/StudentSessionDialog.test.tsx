import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import StudentSessionDialog from './StudentSessionDialog'
import { ApiError } from '../services/api'

const { get, switchToStudent, returnToAdmin } = vi.hoisted(() => ({ get: vi.fn(), switchToStudent: vi.fn(), returnToAdmin: vi.fn() }))
vi.mock('../contexts/AuthContext', async original => ({ ...await original<typeof import('../contexts/AuthContext')>(), useAuth: () => ({ switchToStudent, returnToAdmin, session: { return_account_name: 'Parent Teacher' }, isTransitioning: false }) }))
vi.mock('../services/api', async original => ({ ...await original<typeof import('../services/api')>(), api: { get } }))

beforeEach(() => { get.mockReset(); switchToStudent.mockReset(); returnToAdmin.mockReset() })
const show = (returning = false) => {
  const onClose = vi.fn()
  render(<MemoryRouter><StudentSessionDialog returning={returning} onClose={onClose} /></MemoryRouter>)
  return onClose
}

it('selects an active student, confirms the PIN, and preserves leading zeroes', async () => {
  get.mockResolvedValue([
    { id: 2, first_name: 'Learner', last_name: 'One', username: 'one', is_active: true },
    { id: 3, first_name: 'Inactive', is_active: false },
  ])
  switchToStudent.mockResolvedValue(undefined)
  const onClose = show()
  const input = userEvent.setup()
  await input.selectOptions(await screen.findByLabelText('Student'), '2')
  expect(screen.queryByText('Inactive')).not.toBeInTheDocument()
  await input.click(screen.getByRole('button', { name: 'Continue' }))
  await input.type(screen.getByLabelText('Set a six-digit PIN'), '012345')
  await input.type(screen.getByLabelText('Confirm PIN'), '012344')
  await input.click(screen.getByRole('button', { name: 'Switch' }))
  expect(screen.getByRole('alert')).toHaveTextContent('do not match')
  expect(switchToStudent).not.toHaveBeenCalled()
  await input.clear(screen.getByLabelText('Confirm PIN'))
  await input.type(screen.getByLabelText('Confirm PIN'), '012345')
  await input.click(screen.getByRole('button', { name: 'Switch' }))
  expect(switchToStudent).toHaveBeenCalledWith(2, '012345')
  expect(onClose).toHaveBeenCalledOnce()
})

it('explains an empty student list', async () => {
  get.mockResolvedValue([])
  show()
  expect(await screen.findByText(/Add an active student account/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
})

it('keeps incorrect PIN errors inline and enforces the server cooldown', async () => {
  returnToAdmin.mockRejectedValueOnce(new ApiError('Incorrect PIN.', 403))
    .mockRejectedValueOnce(new ApiError('Too many incorrect PINs.', 429, 300))
  const onClose = show(true)
  const input = userEvent.setup()
  const pin = screen.getByLabelText('PIN')
  expect(pin).toHaveAttribute('type', 'password')
  await input.type(pin, '111111')
  await input.click(screen.getByRole('button', { name: 'Return to my account' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect PIN.')
  expect(pin).toHaveValue('')
  await input.type(pin, '111111')
  await input.click(screen.getByRole('button', { name: 'Return to my account' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Return to my account' })).toBeDisabled())
  expect(screen.getByText(/Forgot the PIN/)).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})
