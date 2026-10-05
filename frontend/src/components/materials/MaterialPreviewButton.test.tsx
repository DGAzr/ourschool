import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import MaterialPreviewButton from './MaterialPreviewButton'

const mocks = vi.hoisted(() => ({ availability: vi.fn(), user: { id: 2, role: 'student' } }))
vi.mock('../../services/paperless', () => ({ paperlessApi: { documentAvailability: mocks.availability } }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('../../contexts/PaperlessStatusContext', () => ({ usePaperlessStatusContext: () => ({ status: null }) }))
const material = { id: 3, document_id: 42, title: 'Fractions worksheet', material_kind: 'worksheet' as const }
const open = () => {
  const onOpen = vi.fn()
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><MaterialPreviewButton material={material} onOpen={onOpen} /></MemoryRouter></QueryClientProvider>)
  return onOpen
}
beforeEach(() => { vi.clearAllMocks(); mocks.user.role = 'student' })
it('explains disconnection before students can open content', async () => {
  mocks.availability.mockResolvedValue({ available: false, reason: 'Library disconnected.' })
  const onOpen = open()
  expect(await screen.findByText(/Ask your teacher for this material/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'View Fractions worksheet' })).toBeDisabled()
  expect(onOpen).not.toHaveBeenCalled()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})
it('gives teachers a reconnect link while preserving the attachment', async () => {
  mocks.user.role = 'admin'
  mocks.availability.mockResolvedValue({ available: false, reason: 'Library disconnected.' })
  open()
  expect(await screen.findByRole('link', { name: 'Reconnect library' })).toHaveAttribute('href', '/admin/settings/paperless')
})
it('opens available materials and allows availability failures to be retried', async () => {
  mocks.availability.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ available: true, reason: null })
  const onOpen = open()
  await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  const view = screen.getByRole('button', { name: 'View Fractions worksheet' })
  const { waitFor } = await import('@testing-library/react')
  await waitFor(() => expect(view).toBeEnabled())
  await userEvent.click(view)
  expect(onOpen).toHaveBeenCalledOnce()
})
