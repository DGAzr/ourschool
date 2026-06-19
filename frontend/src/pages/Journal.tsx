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
import { journalApi } from '../services/journal'
import { JournalEntryWithAuthor, JournalEntryCreate, JournalEntryUpdate, JournalStudent } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import MarkdownRenderer from '../components/common/MarkdownRenderer'

const Journal: React.FC = () => {
  const { user } = useAuth()
  const [entries, setEntries] = useState<JournalEntryWithAuthor[]>([])
  const [students, setStudents] = useState<JournalStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<JournalEntryWithAuthor | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Helper function to get local date in YYYY-MM-DD format
  const getLocalDateString = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [formData, setFormData] = useState<JournalEntryCreate>({
    title: '',
    content: '',
    entry_date: getLocalDateString(),
    student_id: undefined
  })

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (user) {
      fetchEntries()
      if (isAdmin) {
        fetchStudents()
      }
    }
  }, [selectedStudentId, user])

  const fetchEntries = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await journalApi.getAll(selectedStudentId || undefined)
      setEntries(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(`Failed to fetch journal entries: ${err.response?.data?.detail || err.message}`)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    try {
      const data = await journalApi.getStudents()
      setStudents(Array.isArray(data) ? data : [])
    } catch (err: any) {
      // Only show error to user if it's not a permission issue
      if (err.response?.status !== 403) {
        setError(`Failed to fetch students: ${err.response?.data?.detail || err.message}`)
      }
      setStudents([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingEntry) {
        const updateData: JournalEntryUpdate = {
          title: formData.title,
          content: formData.content,
          entry_date: formData.entry_date ? new Date(formData.entry_date).toISOString() : undefined
        }
        await journalApi.update(editingEntry.id, updateData)
      } else {
        const createData: JournalEntryCreate = {
          ...formData,
          entry_date: formData.entry_date ? new Date(formData.entry_date).toISOString() : undefined
        }
        await journalApi.create(createData)
      }
      resetForm()
      fetchEntries()
    } catch (err: any) {
      setError(`Failed to save journal entry: ${err.response?.data?.detail || err.message}`)
    }
  }

  const handleEdit = (entry: JournalEntryWithAuthor) => {
    setEditingEntry(entry)
    setFormData({
      title: entry.title,
      content: entry.content,
      entry_date: entry.entry_date.split('T')[0],
      student_id: entry.student_id
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this journal entry?')) return

    try {
      await journalApi.delete(id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch (err: any) {
      setError(`Failed to delete journal entry: ${err.response?.data?.detail || err.message}`)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      entry_date: getLocalDateString(),
      student_id: isAdmin ? selectedStudentId || undefined : undefined
    })
    setEditingEntry(null)
    setShowForm(false)
    setError(null)
  }

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy')
    } catch {
      return dateString
    }
  }

  // Helper function to determine if an entry is written by a student or admin
  const isStudentEntry = (entry: JournalEntryWithAuthor) => {
    // If student_id equals author_id, it's a student writing about themselves
    // If they're different, it's an admin writing about a student
    return entry.student_id === entry.author_id
  }

const filteredEntries = (entries || []).filter(entry =>
    entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.author_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayLabel = format(new Date(), 'EEEE, MMMM d')

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="h-6 w-6 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
          {error}
        </div>
      )}

      {/* ═══════════════════════════════════
          STUDENT — Reflection space
      ═══════════════════════════════════ */}
      {!isAdmin && (
        <div className="max-w-[760px] mx-auto pb-24">
          {/* Greeting + streak */}
          <div className="flex items-start justify-between gap-5 mb-6">
            <div>
              <h1 className="font-serif text-[32px] font-medium tracking-[-0.01em] text-ink leading-tight">
                {greeting}, {user.first_name || user.username}.
              </h1>
              <p className="mt-1.5 text-muted text-[14px]">{todayLabel} · What's on your mind today?</p>
            </div>
            <div className="flex gap-2.5 flex-none">
              <div className="text-center bg-panel border border-line rounded-[11px] px-3.5 py-2.5">
                <div className="font-mono text-[22px] font-semibold text-accent leading-none">{entries.length}</div>
                <div className="text-[10.5px] text-muted mt-1 uppercase tracking-[.05em]">entries</div>
              </div>
            </div>
          </div>

          {/* Composer */}
          {showForm && (
            <div className="bg-panel border border-line rounded-card-lg shadow-card mb-8 overflow-hidden">
              <form onSubmit={handleSubmit}>
                <div className="p-5 pb-0 space-y-3">
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                    placeholder="Give this entry a title…"
                    className="w-full bg-transparent text-[17px] font-semibold text-ink placeholder:text-faintest focus:outline-none border-none"
                  />
                  <textarea
                    required
                    rows={6}
                    value={formData.content}
                    onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
                    placeholder="Start writing… there's no wrong way to do this."
                    className="w-full font-serif text-[16px] leading-relaxed text-ink bg-transparent placeholder:text-faintest resize-none focus:outline-none border-none"
                  />
                </div>
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-line-2 bg-panel-2">
                  <div className="flex items-center gap-3">
                    <label className="text-[11px] font-semibold text-faint uppercase tracking-[.05em]">Date</label>
                    <input
                      type="date"
                      value={formData.entry_date}
                      onChange={e => setFormData(p => ({ ...p, entry_date: e.target.value }))}
                      className="h-[30px] px-2 bg-field-bg border border-field-border rounded-field text-[12.5px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={resetForm} className="h-[34px] px-3 text-[13px] font-semibold text-muted hover:text-ink transition-colors">Cancel</button>
                    <button type="submit" className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity">
                      {editingEntry ? 'Update entry' : 'Save entry'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full mb-8 py-3.5 bg-panel border border-line rounded-card-lg text-left px-5 text-faint hover:text-muted hover:border-field-border transition-colors shadow-card"
            >
              <span className="font-serif text-[16px]">Start writing…</span>
            </button>
          )}

          {/* Timeline */}
          <div className="flex items-center gap-2.5 mb-4">
            <h2 className="font-serif text-[21px] font-medium text-ink">Your journey</h2>
            <span className="font-mono text-[12px] text-faint">{filteredEntries.length} entries</span>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="py-14 text-center">
              <p className="font-serif text-[18px] text-ink-2 mb-2">No entries yet</p>
              <p className="text-[13px] text-faint">Your journal will appear here once you start writing.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredEntries.map((entry, i) => (
                <div key={entry.id} className="relative pl-6">
                  <span className="absolute left-1 top-[7px] w-[11px] h-[11px] rounded-full bg-accent-soft border-2 border-accent" />
                  {i < filteredEntries.length - 1 && (
                    <span className="absolute left-[5.5px] top-5 bottom-[-1.25rem] w-[1.5px] bg-line" />
                  )}
                  <div className="bg-panel border border-line rounded-card-lg overflow-hidden">
                    <div className="p-4 pb-3">
                      <div className="flex items-baseline justify-between gap-3 mb-2">
                        <h3 className="font-serif text-[18px] font-semibold text-ink">{entry.title}</h3>
                        <span className="font-mono text-[11.5px] text-faint flex-none">{formatDate(entry.entry_date)}</span>
                      </div>
                      <div className="prose prose-sm max-w-none text-ink-2 font-serif text-[14.5px] leading-relaxed">
                        <MarkdownRenderer content={entry.content} />
                      </div>
                    </div>
                    {(entry.is_own_entry) && (
                      <div className="flex justify-end gap-1.5 px-4 py-2.5 border-t border-line-2 bg-panel-2">
                        <button onClick={() => handleEdit(entry)} className="h-[28px] px-2.5 text-[12px] font-semibold text-muted border border-line bg-panel rounded-[7px] hover:bg-track transition-colors">Edit</button>
                        <button onClick={() => handleDelete(entry.id)} className="h-[28px] px-2.5 text-[12px] font-semibold text-danger border border-line bg-panel rounded-[7px] hover:bg-neg-bg transition-colors">Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════
          ADMIN — Deep-dive view
      ═══════════════════════════════════ */}
      {isAdmin && (
        <div style={{ display: 'flex', height: 'calc(100vh - 10rem)', minHeight: 520, gap: 16 }}>
          {/* Left rail: student list */}
          <div className="flex-none w-[230px] bg-panel border border-line rounded-card flex flex-col min-h-0">
            <div className="flex-none px-3 pt-3 pb-2 border-b border-line-3">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search entries…"
                  className="w-full pl-7 pr-2 py-1.5 bg-field-bg border border-field-border rounded-field text-[12.5px] text-ink placeholder:text-faintest focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              <button
                onClick={() => setSelectedStudentId(null)}
                className={`w-full text-left px-2.5 py-2 rounded-[8px] text-[13px] font-semibold transition-colors ${
                  selectedStudentId === null ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-track'
                }`}
              >
                All students
                <span className="ml-1.5 font-mono text-[11px] text-faint">{entries.length}</span>
              </button>
              {students.map(s => {
                const count = entries.filter(e => e.student_id === s.id).length
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudentId(s.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-[8px] text-[13px] transition-colors ${
                      selectedStudentId === s.id ? 'bg-accent-soft text-accent font-semibold' : 'text-ink-2 hover:bg-track'
                    }`}
                  >
                    {s.name}
                    {count > 0 && <span className="ml-1.5 font-mono text-[11px] text-faint">{count}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Entry feed */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 flex-none">
              <div>
                <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-0.5">
                  {selectedStudentId ? students.find(s => s.id === selectedStudentId)?.name : 'All students'}
                </p>
                <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em] leading-none">Journal</h1>
              </div>
              <button
                onClick={() => { setShowForm(true); if (students.length === 0) fetchStudents() }}
                className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity"
              >
                + New entry
              </button>
            </div>

            {/* Entry modal (admin new/edit) */}
            {showForm && (
              <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-xl bg-panel border border-line rounded-card-lg shadow-float overflow-hidden">
                  <div className="px-6 py-4 border-b border-line-2 flex items-center justify-between">
                    <h3 className="font-semibold text-[16px] text-ink">{editingEntry ? 'Edit entry' : 'New journal entry'}</h3>
                    <button onClick={resetForm} className="text-faint hover:text-ink text-[18px] leading-none">✕</button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-5 space-y-3">
                    {!editingEntry && (
                      <div>
                        <label className="block text-[11px] font-semibold text-faint uppercase tracking-[.05em] mb-1">Student</label>
                        <select
                          required
                          value={formData.student_id ?? ''}
                          onChange={e => setFormData(p => ({ ...p, student_id: e.target.value ? parseInt(e.target.value) : undefined }))}
                          className="w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                        >
                          <option value="">Select a student</option>
                          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-[11px] font-semibold text-faint uppercase tracking-[.05em] mb-1">Title</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                        className="w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                        placeholder="Entry title"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-faint uppercase tracking-[.05em] mb-1">Date</label>
                      <input
                        type="date"
                        required
                        value={formData.entry_date}
                        onChange={e => setFormData(p => ({ ...p, entry_date: e.target.value }))}
                        className="w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-faint uppercase tracking-[.05em] mb-1">Content</label>
                      <textarea
                        required
                        rows={7}
                        value={formData.content}
                        onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
                        className="w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink font-serif leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest"
                        placeholder="Write about this student's learning experience…"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={resetForm} className="h-[34px] px-3 text-[13px] font-semibold text-muted border border-line bg-panel rounded-field hover:bg-track transition-colors">Cancel</button>
                      <button type="submit" className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity">
                        {editingEntry ? 'Update' : 'Save entry'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Scrollable entries */}
            <div className="flex-1 overflow-y-auto space-y-4">
              {filteredEntries.length === 0 ? (
                <div className="py-14 text-center bg-panel border border-line rounded-card">
                  <p className="text-[15px] font-semibold text-ink-2 mb-1">
                    {searchTerm ? 'No entries match your search' : 'No journal entries yet'}
                  </p>
                  <p className="text-[13px] text-faint">
                    {searchTerm ? 'Try clearing the search.' : 'Entries will appear here once students start writing.'}
                  </p>
                </div>
              ) : filteredEntries.map(entry => (
                <div key={entry.id} className="bg-panel border border-line rounded-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-line-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-serif text-[17px] font-semibold text-ink">{entry.title}</h3>
                          {isStudentEntry(entry) ? (
                            <span className="px-2 py-[2px] rounded-pill bg-info-bg text-info-fg text-[11px] font-semibold">Student</span>
                          ) : (
                            <span className="px-2 py-[2px] rounded-pill bg-pos-bg text-pos-fg text-[11px] font-semibold">Admin</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[12.5px] text-faint">
                          <span>{entry.student_name}</span>
                          <span>·</span>
                          <span>by {entry.author_name}</span>
                          <span>·</span>
                          <span className="font-mono">{formatDate(entry.entry_date)}</span>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1.5 flex-none">
                          <button onClick={() => handleEdit(entry)} className="h-[28px] px-2.5 text-[12px] font-semibold text-muted border border-line bg-panel rounded-[7px] hover:bg-track transition-colors">Edit</button>
                          <button onClick={() => handleDelete(entry.id)} className="h-[28px] px-2.5 text-[12px] font-semibold text-danger border border-line bg-panel rounded-[7px] hover:bg-neg-bg transition-colors">Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-5 py-4 font-serif text-[14.5px] leading-relaxed text-ink-2">
                    <MarkdownRenderer content={entry.content} />
                    {entry.updated_at !== entry.created_at && (
                      <p className="mt-3 text-[11.5px] text-faintest font-sans">
                        Updated {format(parseISO(entry.updated_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Journal