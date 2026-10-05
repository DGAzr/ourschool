import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AccountMenu from './AccountMenu'
import { User } from '../types'

const teacher = { id: 1, first_name: 'Parent', last_name: 'Teacher', role: 'admin' } as User
const setup = (user = teacher, isGuided = false) => {
  const onProfile = vi.fn(), onSwitch = vi.fn(), onReturn = vi.fn()
  render(<AccountMenu user={user} initials="PT" isGuided={isGuided} onProfile={onProfile} onSwitch={onSwitch} onReturn={onReturn} />)
  return { onProfile, onSwitch, onReturn }
}

describe('account menu', () => {
  it('opens above the account name with Profile and Switch to Student', async () => {
    const actions = setup()
    const input = userEvent.setup()
    await input.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('menu')).toHaveClass('bottom-full')
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus()
    await input.keyboard('{ArrowDown}{Enter}')
    expect(actions.onSwitch).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
  it('shows Return only for a parent-started student session', async () => {
    const actions = setup({ ...teacher, role: 'student' }, true)
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Return to Parent/Teacher' }))
    expect(actions.onReturn).toHaveBeenCalledOnce()
    expect(screen.queryByText('Switch to Student')).not.toBeInTheDocument()
  })
  it('normal students only have Profile and Escape restores trigger focus', async () => {
    setup({ ...teacher, role: 'student' })
    const input = userEvent.setup()
    await input.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getAllByRole('menuitem')).toHaveLength(1)
    await input.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Account menu' })).toHaveFocus()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
