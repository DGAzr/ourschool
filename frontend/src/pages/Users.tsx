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
import { Users as UsersIcon, Plus, Edit, Trash2, Key, Database } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usersApi } from '../services/users'
import { backupApi } from '../services/backup'
import { User } from '../types'
import { SystemBackupModal } from '../components/backup/SystemBackupModal'
import { TablePageLayout, usePageLayout } from '../components/layouts'

type UserFilter = 'all' | 'students' | 'admins'

const Users: React.FC = () => {
  const { user } = useAuth()
  const [showAddUser, setShowAddUser] = useState(false)
  const [showEditUser, setShowEditUser] = useState(false)
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [userFilter, setUserFilter] = useState<UserFilter>('all')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    password: '',
    role: 'student' as 'admin' | 'student',
    date_of_birth: '',
    grade_level: 1
  })
  const [editUser, setEditUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    is_active: true,
    date_of_birth: '',
    grade_level: 1
  })
  const [users, setUsers] = useState<User[]>([])
  const { loading, error, setLoading, setError, handleAsyncAction } = usePageLayout({ initialLoading: true })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    await handleAsyncAction(async () => {
      const data = await usersApi.getAll()
      setUsers(data)
      return data
    })
    setLoading(false)
  }


  const handleAddUser = async () => {
    try {
      // Only include student-specific fields if creating a student user
      const userData = {
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        email: newUser.email,
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
        ...(newUser.role === 'student' && {
          date_of_birth: newUser.date_of_birth,
          grade_level: newUser.grade_level
        })
      }
      
      await usersApi.create(userData)
      setNewUser({
        first_name: '',
        last_name: '',
        email: '',
        username: '',
        password: '',
        role: 'student',
        date_of_birth: '',
        grade_level: 1
      })
      setShowAddUser(false)
      fetchUsers() // Refresh the list
    } catch (error) {
      setError('Failed to create user')
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await usersApi.delete(userId)
        fetchUsers() // Refresh the list
      } catch (error) {
        setError('Failed to delete user')
      }
    }
  }

  const handleResetPassword = async (userId: number, username: string) => {
    if (window.confirm(`Are you sure you want to reset the password for ${username}? This will generate a new temporary password.`)) {
      try {
        const response = await usersApi.resetPassword(userId)
        // Show the temporary password to the admin
        alert(`Password reset successful!\n\nTemporary password for ${username}: ${response.temporary_password}\n\nPlease share this password securely with the user and ask them to change it upon next login.`)
      } catch (error: any) {
        setError(`Failed to reset password: ${error.response?.data?.detail || error.message}`)
      }
    }
  }

  const handleEditUser = async () => {
    if (!editingUser) return

    try {
      await usersApi.update(editingUser.id, editUser)
      setShowEditUser(false)
      setEditingUser(null)
      fetchUsers() // Refresh the list
      setError(null)
    } catch (error) {
      setError('Failed to update user')
    }
  }

  const openEditModal = (userToEdit: User) => {
    setEditingUser(userToEdit)
    setEditUser({
      first_name: userToEdit.first_name,
      last_name: userToEdit.last_name,
      email: userToEdit.email,
      username: userToEdit.username,
      is_active: userToEdit.is_active,
      date_of_birth: userToEdit.date_of_birth || '',
      grade_level: userToEdit.grade_level || 1
    })
    setShowEditUser(true)
  }

  const handleBackupExport = async () => {
    return await backupApi.exportSystemBackup()
  }

  const handleBackupImport = async (data: any) => {
    const result = await backupApi.importSystemBackup(data)
    // Refresh users list after import in case new users were added
    await fetchUsers()
    return result
  }

  // Filter users based on selected filter
  const filteredUsers = users.filter(u => {
    switch (userFilter) {
      case 'students':
        return u.role === 'student'
      case 'admins':
        return u.role === 'admin'
      default:
        return true
    }
  })

  // Table configuration
  const tableHeaders = ['Name', 'Email', 'Username', 'Role', 'Grade Level', 'Status']
  
  const tableData = filteredUsers.map(userItem => [
    `${userItem.first_name} ${userItem.last_name}`,
    userItem.email,
    userItem.username,
    <span key={`role-${userItem.id}`} className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
      userItem.role === 'admin' 
        ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' 
        : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
    }`}>
      {userItem.role === 'admin' ? 'Administrator' : 'Student'}
    </span>,
    userItem.role === 'student' && userItem.grade_level ? `Grade ${userItem.grade_level}` : '—',
    <span key={`status-${userItem.id}`} className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
      userItem.is_active 
        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
    }`}>
      {userItem.is_active ? 'Active' : 'Inactive'}
    </span>
  ])

  const renderTableActions = (rowIndex: number, _rowData: any) => {
    const userItem = filteredUsers[rowIndex]
    return (
      <div className="flex items-center space-x-2">
        <button
          onClick={() => openEditModal(userItem)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
          title="Edit user"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleResetPassword(userItem.id, userItem.username)}
          className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300"
          title="Reset password"
        >
          <Key className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleDeleteUser(userItem.id)}
          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
          title="Delete user"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )
  }

  const headerActions = (
    <div className="flex space-x-3">
      <button 
        onClick={() => setShowBackupModal(true)}
        className="inline-flex items-center px-4 py-3 border border-white border-opacity-30 text-sm font-semibold rounded-lg text-white bg-white bg-opacity-10 hover:bg-opacity-20 transition-all duration-200 shadow-sm hover:shadow-md"
      >
        <Database className="h-4 w-4 mr-2" />
        System Backup
      </button>
      <button 
        onClick={() => setShowAddUser(true)}
        className="inline-flex items-center px-6 py-3 border border-white border-opacity-30 text-sm font-semibold rounded-lg text-white bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200 shadow-sm hover:shadow-md"
      >
        <Plus className="h-5 w-5 mr-2" />
        Add User
      </button>
    </div>
  )

  // Filter tabs component
  const FilterTabs = () => (
    <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
      {([
        { key: 'all', label: 'All Users', count: users.length },
        { key: 'students', label: 'Students', count: users.filter(u => u.role === 'student').length },
        { key: 'admins', label: 'Administrators', count: users.filter(u => u.role === 'admin').length }
      ] as const).map(tab => (
        <button
          key={tab.key}
          onClick={() => setUserFilter(tab.key)}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            userFilter === tab.key
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  )

  return (
    <>
      <TablePageLayout
        title="User Management"
        subtitle="Manage administrators and students in your homeschool program"
        icon={UsersIcon}
        headerColor="indigo"
        loading={loading}
        error={error}
        accessDenied={user?.role !== 'admin'}
        accessDeniedMessage="Only administrators can manage users."
        actions={headerActions}
        tableHeaders={tableHeaders}
        tableData={tableData}
        tableActions={renderTableActions}
        emptyMessage="No users found"
        emptyDescription="Add your first user to get started."
        customContent={<FilterTabs />}
      />

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Add New User</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                  <input
                    type="text"
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                  <input
                    type="text"
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'student' })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="student">Student</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              {newUser.role === 'student' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth</label>
                    <input
                      type="date"
                      value={newUser.date_of_birth}
                      onChange={(e) => setNewUser({ ...newUser, date_of_birth: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Grade Level</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={newUser.grade_level}
                      onChange={(e) => setNewUser({ ...newUser, grade_level: parseInt(e.target.value) || 1 })}
                      placeholder="e.g., 3, 9"
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddUser(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Add User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUser && editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Edit User</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                  <input
                    type="text"
                    value={editUser.first_name}
                    onChange={(e) => setEditUser({ ...editUser, first_name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                  <input
                    type="text"
                    value={editUser.last_name}
                    onChange={(e) => setEditUser({ ...editUser, last_name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                <input
                  type="text"
                  value={editUser.username}
                  onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select
                  value={editUser.is_active ? 'active' : 'inactive'}
                  onChange={(e) => setEditUser({ ...editUser, is_active: e.target.value === 'active' })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {editingUser?.role === 'student' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth</label>
                    <input
                      type="date"
                      value={editUser.date_of_birth}
                      onChange={(e) => setEditUser({ ...editUser, date_of_birth: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Grade Level</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={editUser.grade_level}
                      onChange={(e) => setEditUser({ ...editUser, grade_level: parseInt(e.target.value) || 1 })}
                      placeholder="e.g., 3, 9"
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditUser(false)
                  setEditingUser(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleEditUser}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}


      {/* System Backup Modal */}
      {showBackupModal && (
        <SystemBackupModal
          isOpen={showBackupModal}
          onClose={() => setShowBackupModal(false)}
          onExport={handleBackupExport}
          onImport={handleBackupImport}
        />
      )}
    </>
  )
}

export default Users