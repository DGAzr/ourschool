import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import Modal from './Modal'

const Harness = () => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open family form</button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Family details"
        footer={<button onClick={() => setOpen(false)}>Save details</button>}
      >
        <label>
          Family name
          <input />
        </label>
      </Modal>
    </>
  )
}

describe('Modal keyboard behavior', () => {
  it('isolates the background, contains focus, and restores focus on close', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open family form' })

    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Family details' })
    const field = screen.getByRole('textbox', { name: 'Family name' })
    await waitFor(() => expect(field).toHaveFocus())
    expect(container).toHaveAttribute('inert')
    expect(container).toHaveAttribute('aria-hidden', 'true')

    screen.getByRole('button', { name: 'Save details' }).focus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
    expect(container).not.toHaveAttribute('inert')
    expect(container).not.toHaveAttribute('aria-hidden')
  })
})
