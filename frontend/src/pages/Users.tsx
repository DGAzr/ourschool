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

import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Key, Database } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usersApi } from '../services/users'
import { backupApi } from '../services/backup'
import { User } from '../types'
import { SystemBackupModal } from '../components/backup/SystemBackupModal'
import { Button, Input, Select, SegmentedControl, Pill, PageHeader } from '../components/ui'

type UserFilter = 'all' | 'students' | 'admins'

const EMPTY_NEW_USER = {
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  password: '',
  role: 'student' as 'admin' | 'student',
  date_of_birth: '',
  grade_level: 1,
}

const EMPTY_EDIT_USER = {
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  is_active: true,
  date_of_birth: '',
  grade_level: 1,
}

const Users: React.FC = () => {
  const { user } = useAuth()
  const [showAddUser, setShowAddUser] = useState(false)
  const [showEditUser, setShowEditUser] = useState(false)
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [userFilter, setUserFilter] = useState<UserFilter>('all')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER)
  const [newUserErrors, setNewUserErrors] = useState<Record<string, string>>({})
  const [editUser, setEditUser] = useState(EMPTY_EDIT_USER)
  const [editUserErrors, setEditUserErrors] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const data = await usersApi.getAll()
      setUsers(data)
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const validateNewUser = () => {
    const errors: Record<string, string> = {}
    if (!newUser.first_name.trim()) errors.first_name = 'Required'
    if (!newUser.last_name.trim()) errors.last_name = 'Required'
    if (!newUser.email.trim()) errors.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) errors.email = 'Invalid email'
    if (!newUser.username.trim()) errors.username = 'Required'
    if (!newUser.password) errors.password = 'Required'
    else if (newUser.password.length < 6) errors.password = 'At least 6 characters'
    return errors
  }

  const validateEditUser = () => {
    const errors: Record<string, string> = {}
    if (!editUser.first_name.trim()) errors.first_name = 'Required'
    if (!editUser.last_name.trim()) errors.last_name = 'Required'
    if (!editUser.email.trim()) errors.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editUser.email)) errors.email = 'Invalid email'
    if (!editUser.username.trim()) errors.username = 'Required'
    return errors
  }

  const handleAddUser = async () => {
    const errors = validateNewUser()
    if (Object.keys(errors).length > 0) { setNewUserErrors(errors); return }
    try {
      await usersApi.create({
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        email: newUser.email,
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
        ...(newUser.role === 'student' && {
          grade_level: newUser.grade_level,
          ...(newUser.date_of_birth ? { date_of_birth: newUser.date_of_birth } : {}),
        }),
      })
      setNewUser(EMPTY_NEW_USER)
      setNewUserErrors({})
      setShowAddUser(false)
      fetchUsers()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user')
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return
    try {
      await usersApi.delete(userId)
      fetchUsers()
    } catch {
      setError('Failed to delete user')
    }
  }

  const handleResetPassword = async (userId: number, username: string) => {
    if (!window.confirm(`Reset password for ${username}? This will generate a temporary password.`)) return
    try {
      const response = await usersApi.resetPassword(userId)
      alert(`Temporary password for ${username}: ${response.temporary_password}\n\nShare this securely and ask them to change it on next login.`)
    } catch (err: any) {
      setError(`Failed to reset password: ${err.response?.data?.detail || err.message}`)
    }
  }

  const handleEditUser = async () => {
    if (!editingUser) return
    const errors = validateEditUser()
    if (Object.keys(errors).length > 0) { setEditUserErrors(errors); return }
    try {
      await usersApi.update(editingUser.id, editUser)
      setShowEditUser(false)
      setEditingUser(null)
      setEditUserErrors({})
      fetchUsers()
    } catch {
      setError('Failed to update user')
    }
  }

  const openEditModal = (u: User) => {
    setEditingUser(u)
    setEditUserErrors({})
    setEditUser({
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      username: u.username,
      is_active: u.is_active,
      date_of_birth: u.date_of_birth || '',
      grade_level: u.grade_level || 1,
    })
    setShowEditUser(true)
  }

  const filteredUsers = users.filter(u => {
    if (userFilter === 'students') return u.role === 'student'
    if (userFilter === 'admins') return u.role === 'admin'
    return true
  })

  const filterOptions = [
    { label: `All (${users.length})`, value: 'all' },
    { label: `Students (${users.filter(u => u.role === 'student').length})`, value: 'students' },
    { label: `Admins (${users.filter(u => u.role === 'admin').length})`, value: 'admins' },
  ]

  if (user?.role !== 'admin') {
    return (
      <div className="px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
        Only administrators can manage users.
      </div>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin Center"
        title="User Management"
        subtitle="Manage administrators and students in your homeschool program"
        actions={
          <>
            <Button variant="secondary" icon={<Database size={14} />} onClick={() => setShowBackupModal(true)}>
              System Backup
            </Button>
            <Button icon={<Plus size={14} />} onClick={() => setShowAddUser(true)}>
              Add User
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
          {error}
        </div>
      )}

      <div className="mb-4">
        <SegmentedControl
          segments={filterOptions}
          value={userFilter}
          onChange={v => setUserFilter(v as UserFilter)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="h-6 w-6 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-panel-2">
              <tr>
                {['Name', 'Email', 'Username', 'Role', 'Grade', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.06em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-panel divide-y divide-line">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[13px] text-muted">No users found.</td>
                </tr>
              ) : filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-panel-2 transition-colors duration-100">
                  <td className="px-5 py-3.5 text-[13.5px] font-semibold text-ink whitespace-nowrap">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="px-5 py-3.5 text-[13.5px] text-ink-2 whitespace-nowrap">{u.email}</td>
                  <td className="px-5 py-3.5 text-[13.5px] text-ink-2 whitespace-nowrap font-mono">{u.username}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <Pill variant={u.role === 'admin' ? 'sub' : 'info'}>
                      {u.role === 'admin' ? 'Admin' : 'Student'}
                    </Pill>
                  </td>
                  <td className="px-5 py-3.5 text-[13.5px] text-ink-2 whitespace-nowrap">
                    {u.role === 'student' && u.grade_level ? `Grade ${u.grade_level}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <Pill variant={u.is_active ? 'pos' : 'neg'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Pill>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(u)}
                        className="text-muted hover:text-ink transition-colors"
                        title="Edit user"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleResetPassword(u.id, u.username)}
                        className="text-muted hover:text-sub-fg transition-colors"
                        title="Reset password"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-muted hover:text-danger transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-panel border border-line rounded-card shadow-float overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-ink">Add New User</h3>
              <button onClick={() => { setShowAddUser(false); setNewUserErrors({}) }} className="text-faint hover:text-ink-2 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="First Name" required value={newUser.first_name} error={newUserErrors.first_name}
                  onChange={e => { setNewUser(p => ({ ...p, first_name: e.target.value })); setNewUserErrors(p => ({ ...p, first_name: '' })) }} />
                <Input label="Last Name" required value={newUser.last_name} error={newUserErrors.last_name}
                  onChange={e => { setNewUser(p => ({ ...p, last_name: e.target.value })); setNewUserErrors(p => ({ ...p, last_name: '' })) }} />
              </div>
              <Input label="Email" type="email" required value={newUser.email} error={newUserErrors.email}
                onChange={e => { setNewUser(p => ({ ...p, email: e.target.value })); setNewUserErrors(p => ({ ...p, email: '' })) }} />
              <Input label="Username" required value={newUser.username} error={newUserErrors.username}
                onChange={e => { setNewUser(p => ({ ...p, username: e.target.value })); setNewUserErrors(p => ({ ...p, username: '' })) }} />
              <Input label="Password" type="password" required value={newUser.password} error={newUserErrors.password}
                onChange={e => { setNewUser(p => ({ ...p, password: e.target.value })); setNewUserErrors(p => ({ ...p, password: '' })) }} />
              <Select label="Role" value={newUser.role}
                onChange={e => setNewUser(p => ({ ...p, role: e.target.value as 'admin' | 'student' }))}
                options={[{ value: 'student', label: 'Student' }, { value: 'admin', label: 'Administrator' }]} />
              {newUser.role === 'student' && (
                <>
                  <Input label="Date of Birth" type="date" value={newUser.date_of_birth}
                    onChange={e => setNewUser(p => ({ ...p, date_of_birth: e.target.value }))} />
                  <Input label="Grade Level" type="number" value={String(newUser.grade_level)}
                    onChange={e => setNewUser(p => ({ ...p, grade_level: parseInt(e.target.value) || 1 }))} />
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setShowAddUser(false); setNewUserErrors({}) }}>Cancel</Button>
              <Button onClick={handleAddUser}>Add User</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUser && editingUser && (
        <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-panel border border-line rounded-card shadow-float overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-ink">Edit User</h3>
              <button onClick={() => { setShowEditUser(false); setEditingUser(null); setEditUserErrors({}) }} className="text-faint hover:text-ink-2 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="First Name" required value={editUser.first_name} error={editUserErrors.first_name}
                  onChange={e => { setEditUser(p => ({ ...p, first_name: e.target.value })); setEditUserErrors(p => ({ ...p, first_name: '' })) }} />
                <Input label="Last Name" required value={editUser.last_name} error={editUserErrors.last_name}
                  onChange={e => { setEditUser(p => ({ ...p, last_name: e.target.value })); setEditUserErrors(p => ({ ...p, last_name: '' })) }} />
              </div>
              <Input label="Email" type="email" required value={editUser.email} error={editUserErrors.email}
                onChange={e => { setEditUser(p => ({ ...p, email: e.target.value })); setEditUserErrors(p => ({ ...p, email: '' })) }} />
              <Input label="Username" required value={editUser.username} error={editUserErrors.username}
                onChange={e => { setEditUser(p => ({ ...p, username: e.target.value })); setEditUserErrors(p => ({ ...p, username: '' })) }} />
              <Select label="Status" value={editUser.is_active ? 'active' : 'inactive'}
                onChange={e => setEditUser(p => ({ ...p, is_active: e.target.value === 'active' }))}
                options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
              {editingUser.role === 'student' && (
                <>
                  <Input label="Date of Birth" type="date" value={editUser.date_of_birth}
                    onChange={e => setEditUser(p => ({ ...p, date_of_birth: e.target.value }))} />
                  <Input label="Grade Level" type="number" value={String(editUser.grade_level)}
                    onChange={e => setEditUser(p => ({ ...p, grade_level: parseInt(e.target.value) || 1 }))} />
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setShowEditUser(false); setEditingUser(null); setEditUserErrors({}) }}>Cancel</Button>
              <Button onClick={handleEditUser}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {showBackupModal && (
        <SystemBackupModal
          isOpen={showBackupModal}
          onClose={() => setShowBackupModal(false)}
          onExport={() => backupApi.exportSystemBackup()}
        />
      )}
    </>
  )
}

export default Users
