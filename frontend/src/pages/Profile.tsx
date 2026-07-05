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

import React, { useState } from 'react'
import { Lock, Eye, EyeOff, Save } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usersApi } from '../services/users'
import { getErrorMessage } from '../services/api'

const FIELD = 'w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest'
const FIELD_DISABLED = 'w-full bg-panel-2 border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink cursor-not-allowed'
const LABEL = 'block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5'

const Profile: React.FC = () => {
  const { user, updateUser } = useAuth()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)

  // ProtectedRoute guarantees `user` is loaded before this page renders, so
  // the form can be seeded once via a lazy initializer (no sync-on-mount effect).
  const [profileData, setProfileData] = useState(() => ({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    email: user?.email ?? '',
  }))

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      setProfileLoading(true)
      const response = await usersApi.updateMe(profileData)
      updateUser(response.data)
      setSuccess('Profile updated successfully')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update profile'))
    } finally {
      setProfileLoading(false)
    }
  }

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match')
      return
    }

    if (passwordData.new_password.length < 6) {
      setError('New password must be at least 6 characters long')
      return
    }

    try {
      setPasswordLoading(true)
      await usersApi.changeMyPassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      })
      setSuccess('Password changed successfully')
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' })
      setShowPasswordForm(false)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to change password'))
    } finally {
      setPasswordLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-semibold text-ink tracking-[-0.01em]">My Profile</h1>
        <p className="mt-0.5 text-[13px] text-muted">Manage your account settings.</p>
      </div>

      {success && (
        <div className="bg-pos-bg text-pos-fg px-4 py-3 rounded-field text-[13px]">{success}</div>
      )}

      {/* Profile information */}
      <form onSubmit={handleProfileUpdate} className="bg-panel border border-line rounded-card p-6 space-y-5">
        <h2 className="text-[15px] font-semibold text-ink">Profile Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-first-name" className={LABEL}>First Name</label>
            <input
              id="profile-first-name"
              type="text"
              value={profileData.first_name}
              onChange={e => setProfileData({ ...profileData, first_name: e.target.value })}
              className={FIELD}
              required
            />
          </div>
          <div>
            <label htmlFor="profile-last-name" className={LABEL}>Last Name</label>
            <input
              id="profile-last-name"
              type="text"
              value={profileData.last_name}
              onChange={e => setProfileData({ ...profileData, last_name: e.target.value })}
              className={FIELD}
              required
            />
          </div>
          <div>
            <label htmlFor="profile-email" className={LABEL}>Email</label>
            <input
              id="profile-email"
              type="email"
              value={profileData.email}
              onChange={e => setProfileData({ ...profileData, email: e.target.value })}
              className={FIELD}
              required
            />
          </div>
          <div>
            <label className={LABEL}>Username</label>
            <div className={FIELD_DISABLED}>{user.username}</div>
            <p className="mt-1.5 text-[12px] text-faint">Username cannot be changed</p>
          </div>
          <div>
            <label className={LABEL}>Role</label>
            <div className={FIELD_DISABLED}>
              {user.role === 'admin' ? 'Administrator' : 'Student'}
            </div>
          </div>
          {user.role === 'student' && user.grade_level && (
            <div>
              <label className={LABEL}>Grade Level</label>
              <div className={FIELD_DISABLED}>{user.grade_level}</div>
            </div>
          )}
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={profileLoading}
            className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
          >
            {profileLoading
              ? <div className="w-4 h-4 border-2 border-btn-primary-fg border-t-transparent rounded-full animate-spin" />
              : <Save className="w-4 h-4" />
            }
            Update Profile
          </button>
        </div>
      </form>

      {/* Password */}
      <div className="bg-panel border border-line rounded-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2">
            <Lock className="w-4 h-4 text-faint" />
            Password
          </h2>
          {!showPasswordForm && (
            <button
              onClick={() => { setError(null); setSuccess(null); setShowPasswordForm(true) }}
              className="h-[32px] px-3 rounded-field text-[13px] font-semibold text-muted border border-line hover:text-ink hover:bg-track transition-colors"
            >
              Change Password
            </button>
          )}
        </div>

        {showPasswordForm ? (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {error && (
              <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px]">{error}</div>
            )}

            <div>
              <label htmlFor="profile-current-password" className={LABEL}>Current Password</label>
              <div className="relative">
                <input
                  id="profile-current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.current_password}
                  onChange={e => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  className={FIELD + ' pr-10'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-faint hover:text-muted"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="profile-new-password" className={LABEL}>New Password</label>
              <div className="relative">
                <input
                  id="profile-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.new_password}
                  onChange={e => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  className={FIELD + ' pr-10'}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-faint hover:text-muted"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[12px] text-faint">Must be at least 6 characters</p>
            </div>

            <div>
              <label htmlFor="profile-confirm-password" className={LABEL}>Confirm New Password</label>
              <div className="relative">
                <input
                  id="profile-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirm_password}
                  onChange={e => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  className={FIELD + ' pr-10'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-faint hover:text-muted"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false)
                  setPasswordData({ current_password: '', new_password: '', confirm_password: '' })
                  setError(null)
                }}
                className="h-[34px] px-4 text-[13px] font-semibold text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={passwordLoading}
                className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
              >
                {passwordLoading
                  ? <div className="w-4 h-4 border-2 border-btn-primary-fg border-t-transparent rounded-full animate-spin" />
                  : <Save className="w-4 h-4" />
                }
                Save Password
              </button>
            </div>
          </form>
        ) : (
          <p className="text-[13px] text-muted">Click "Change Password" to update your password.</p>
        )}
      </div>
    </div>
  )
}

export default Profile
