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

import { StrictMode } from 'react'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'
import OIDCCallback from './OIDCCallback'

const { login } = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ login }) }))
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  login.mockReset()
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const renderPage = (page: React.ReactNode) => render(
  <StrictMode><MemoryRouter>{page}</MemoryRouter></StrictMode>,
)
describe('OIDC login', () => {
  it('preserves password login when disabled', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({
      enabled: false, button_label: 'SSO', local_login_enabled: true,
    }) })
    renderPage(<Login />)
    expect(await screen.findByLabelText('Username')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'SSO' })).not.toBeInTheDocument()
  })
  it('shows the configured button and hides disabled password login', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({
      enabled: true, button_label: 'School SSO', local_login_enabled: false,
    }) })
    renderPage(<Login />)
    expect(await screen.findByRole('button', { name: 'School SSO' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
  })
  it('shows both login options and navigates to the provider', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () =>
      url.endsWith('/start') ? { authorization_url: 'https://id.example/authorize' } :
        { enabled: true, button_label: 'SSO', local_login_enabled: true } }))
    renderPage(<Login />)
    fireEvent.click(await screen.findByRole('button', { name: 'SSO' }))
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://id.example/authorize'))
  })
  it('shows start errors above both login options', async () => {
    fetchMock.mockImplementation(async (url: string) => ({ ok: !url.endsWith('/start'), json: async () =>
      ({ enabled: true, button_label: 'SSO', local_login_enabled: true }) }))
    renderPage(<Login />)
    fireEvent.click(await screen.findByRole('button', { name: 'SSO' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Single sign-on is currently unavailable')
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
  })
  it('waits for config and falls back to passwords on failure', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    renderPage(<Login />)
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
    expect(await screen.findByLabelText('Username')).toBeInTheDocument()
  })
  it('exchanges the code once under StrictMode and installs the existing session', async () => {
    window.history.replaceState(null, '', '/auth/oidc/callback?code=code&state=state')
    const session = { user: { id: 1 } }
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: 'token', session }) })
    renderPage(<OIDCCallback />)
    await waitFor(() => expect(login).toHaveBeenCalledWith('token', session.user, session))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ code: 'code', state: 'state' })
    expect(window.location.search).toBe('')
  })
  it('shows a friendly failure with a login link', async () => {
    window.history.replaceState(null, '', '/auth/oidc/callback?code=code&state=state')
    fetchMock.mockResolvedValue({ ok: false })
    renderPage(<OIDCCallback />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Single sign-on failed')
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login')
    expect(login).not.toHaveBeenCalled()
  })
  it('handles provider denial without exchanging a code', () => {
    window.history.replaceState(null, '', '/auth/oidc/callback?error=access_denied')
    renderPage(<OIDCCallback />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
