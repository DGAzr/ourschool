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

/**
 * Full-screen gate shown when the server requires a password rotation
 * (seeded default credentials or an admin-issued temporary password).
 * The backend blocks every other endpoint until the password is changed.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'

const inputClasses =
  'w-full bg-field-bg border border-field-border text-ink text-[13.5px] rounded-field px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors placeholder:text-faintest'

const labelClasses =
  'block text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1.5'

const ChangePasswordRequired: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { updateUser, logout } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      await api.post('/users/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      const freshUser = await api.get('/users/me')
      updateUser(freshUser)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[360px]">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-btn-primary-fg text-lg font-bold mb-4"
            style={{ background: 'var(--btn-primary-bg)' }}
          >
            O
          </div>
          <h1 className="text-[22px] font-semibold text-ink tracking-[-0.02em]">
            Choose a new password
          </h1>
          <p className="mt-1 text-[13px] text-muted text-center">
            Your current password is temporary and must be changed before you
            can continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="current-password" className={labelClasses}>
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="new-password" className={labelClasses}>
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClasses}
            />
            <p className="mt-1 text-[12px] text-faint">
              At least 8 characters, with letters and numbers.
            </p>
          </div>

          <div>
            <label htmlFor="confirm-password" className={labelClasses}>
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClasses}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-field text-[13.5px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity mt-2"
          >
            {isLoading ? 'Saving…' : 'Set new password'}
          </button>

          <button
            type="button"
            onClick={() => logout('User chose to sign in as someone else')}
            className="w-full text-[13px] text-muted hover:text-ink transition-colors"
          >
            Sign in as a different user
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChangePasswordRequired
