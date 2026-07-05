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

import React, { useState, useEffect, useRef, useCallback, useEffectEvent } from 'react'
import { journalApi } from '../services/journal'
import {
  JournalEntryWithAuthor,
  JournalStudent,
  JournalComposerData,
  JournalGoal,
} from '../types'
import { useAuth } from '../contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import MarkdownRenderer from '../components/common/MarkdownRenderer'
import { IconPickerButton, Icon } from '../components/ui'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { getErrorMessage } from '../services/api'

// ─── Constants ───────────────────────────────────────────────────────────────

const MOODS = [
  { key: 'great', label: 'Great', color: '#22c55e' },
  { key: 'good', label: 'Good', color: '#3b82f6' },
  { key: 'okay', label: 'Okay', color: '#f59e0b' },
  { key: 'low', label: 'Low', color: '#8b5cf6' },
  { key: 'hard', label: 'Hard', color: '#ef4444' },
]

const SPARKS = [
  'What was the most interesting thing you learned today?',
  'Describe a moment where something finally clicked for you.',
  'What are you looking forward to learning next?',
  'What challenged you today, and how did you handle it?',
  'Write about something you\'re proud of from this week.',
]

const REACTIONS = ['Proud of you', 'Love this', 'Great insight', 'Keep going']

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (dateString: string) => {
  try { return format(parseISO(dateString), 'MMM d, yyyy') } catch { return dateString }
}

const moodColor = (key?: string) => MOODS.find(m => m.key === key)?.color ?? 'var(--accent)'

// Returns ordered segments for the mood bar (one per distinct mood, in MOODS order)
const moodBreakdown = (entryList: { mood?: string }[]): { color: string; count: number; label: string }[] =>
  MOODS
    .map(m => ({ color: m.color, label: m.label, count: entryList.filter(e => e.mood === m.key).length }))
    .filter(seg => seg.count > 0)

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

// ─── Student Composer ────────────────────────────────────────────────────────

interface ComposerProps {
  composerData: JournalComposerData | null
  onSaved: (entry: JournalEntryWithAuthor) => void
}

const StudentComposer: React.FC<ComposerProps> = ({ composerData, onSaved }) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState('')
  const [mood, setMood] = useState<string | null>(null)
  const [icon, setIcon] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [win, setWin] = useState('')
  const [goals, setGoals] = useState<JournalGoal[]>([])
  const [goalDraft, setGoalDraft] = useState('')
  const [activePrompt, setActivePrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editorEmpty, setEditorEmpty] = useState(true)
  const goalId = useRef(1)

  const hasContent = title.trim().length > 0 || !editorEmpty

  const addGoal = () => {
    if (!goalDraft.trim()) return
    setGoals(prev => [...prev, { id: goalId.current++, text: goalDraft.trim(), done: false }])
    setGoalDraft('')
  }

  const toggleGoal = (id: number) =>
    setGoals(prev => prev.map(g => g.id === id ? { ...g, done: !g.done } : g))

  const removeGoal = (id: number) =>
    setGoals(prev => prev.filter(g => g.id !== id))

  const execCmd = (cmd: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  const [saveError, setSaveError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState(false)

  const handleSave = async () => {
    if (!hasContent || saving) return
    const content = editorRef.current?.innerHTML ?? ''
    const bodyText = editorRef.current?.innerText?.trim() ?? ''
    if (!title.trim()) { setTitleError(true); return }
    setSaving(true)
    setSaveError(null)
    try {
      const entry = await journalApi.create({
        title: title.trim(),
        content: bodyText ? content : title.trim(),
        mood: mood ?? undefined,
        icon: icon ?? undefined,
        tags,
        win: win.trim() || undefined,
        goals,
      })
      setTitle('')
      setMood(null)
      setIcon(null)
      setTags([])
      setWin('')
      setGoals([])
      setGoalDraft('')
      setActivePrompt('')
      setEditorEmpty(true)
      setTitleError(false)
      if (editorRef.current) editorRef.current.innerHTML = ''
      setOpen(false)
      onSaved(entry)
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to save entry. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const pickSpark = () => {
    const unused = SPARKS.filter(s => s !== activePrompt)
    setActivePrompt(unused[Math.floor(Math.random() * unused.length)])
  }

  const subjects = composerData?.subjects ?? []
  const pointsPerEntry = composerData?.points_per_entry
  const pointsEarnedToday = composerData?.points_today

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full mb-8 py-4 bg-panel border border-line rounded-card-lg text-left px-5 text-faint hover:text-muted hover:border-field-border transition-colors shadow-card"
      >
        <span className="font-serif text-[16px]">Start writing today's reflection…</span>
      </button>
    )
  }

  return (
    <div className="bg-panel border border-line rounded-card-lg shadow-card mb-8 overflow-hidden">
      {/* Title + icon picker */}
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2.5 mb-1">
          <IconPickerButton
            value={icon}
            color={moodColor(mood ?? undefined)}
            onSelect={name => setIcon(name)}
          />
          <input
            type="text"
            value={title}
            onChange={e => { setTitle(e.target.value); setTitleError(false) }}
            aria-label="Entry title"
            placeholder="Give this entry a title…"
            className={`flex-1 min-w-0 bg-transparent text-[17px] font-semibold placeholder:text-faintest focus:outline-none border-none ${titleError ? 'text-neg-fg placeholder:text-neg-fg/50' : 'text-ink'}`}
          />
        </div>
        {titleError && <p className="text-[12px] text-neg-fg mb-2">A title is required before saving.</p>}

        {/* Spark prompt */}
        {activePrompt && (
          <p className="text-[13.5px] italic text-muted mb-2 pl-1">"{activePrompt}"</p>
        )}

        {/* Formatting toolbar */}
        <div className="flex items-center gap-0.5 mb-2 -ml-1">
          {[
            { label: 'B', cmd: 'bold', style: 'font-bold', aria: 'Bold' },
            { label: 'I', cmd: 'italic', style: 'italic', aria: 'Italic' },
          ].map(b => (
            <button key={b.cmd} type="button" aria-label={b.aria} onMouseDown={e => { e.preventDefault(); execCmd(b.cmd) }}
              className={`w-7 h-7 rounded-[5px] text-[13px] text-faint hover:text-ink hover:bg-track transition-colors ${b.style}`}>
              {b.label}
            </button>
          ))}
          <button type="button" aria-label="Heading" onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'h3') }}
            className="w-7 h-7 rounded-[5px] text-[13px] font-bold text-faint hover:text-ink hover:bg-track transition-colors">
            H
          </button>
          <button type="button" aria-label="Bullet list" onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList') }}
            className="w-7 h-7 rounded-[5px] text-[13px] text-faint hover:text-ink hover:bg-track transition-colors">
            •
          </button>
          <div className="w-px h-4 bg-line mx-1" />
          <button type="button" onClick={pickSpark}
            className="h-7 px-2.5 rounded-[5px] text-[11.5px] font-semibold text-faint hover:text-ink hover:bg-track transition-colors">
            ✦ Need a spark?
          </button>
        </div>

        {/* Rich text editor */}
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Journal entry"
          suppressContentEditableWarning
          onInput={e => setEditorEmpty((e.currentTarget.innerText?.trim().length ?? 0) === 0)}
          className="min-h-[120px] font-serif text-[15.5px] leading-relaxed text-ink focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-faintest"
          data-placeholder="Start writing… there's no wrong way to do this."
        />
      </div>

      {/* Mood row */}
      <div className="px-5 pt-4">
        <p className="text-[10.5px] font-semibold text-faint uppercase tracking-[.06em] mb-2">How are you feeling?</p>
        <div className="flex gap-2 flex-wrap">
          {MOODS.map(m => (
            <button key={m.key} type="button"
              onClick={() => setMood(mood === m.key ? null : m.key)}
              className={`flex items-center gap-1.5 h-[28px] px-2.5 rounded-pill border text-[12.5px] font-medium transition-colors ${
                mood === m.key ? 'border-transparent text-white' : 'bg-panel border-line text-ink-2 hover:border-field-border'
              }`}
              style={mood === m.key ? { background: m.color, borderColor: m.color } : {}}
            >
              <span className="w-2 h-2 rounded-full flex-none" style={{ background: m.color }} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tags row */}
      {subjects.length > 0 && (
        <div className="px-5 pt-3">
          <p className="text-[10.5px] font-semibold text-faint uppercase tracking-[.06em] mb-2">Tag a subject</p>
          <div className="flex gap-2 flex-wrap">
            {subjects.map(s => {
              const active = tags.includes(s.name)
              return (
                <button key={s.id} type="button"
                  onClick={() => setTags(prev => active ? prev.filter(t => t !== s.name) : [...prev, s.name])}
                  className={`flex items-center gap-1.5 h-[26px] px-2 rounded-pill border text-[12px] transition-colors ${
                    active ? 'border-transparent text-white' : 'bg-panel border-line text-ink-2 hover:border-field-border'
                  }`}
                  style={active ? { background: s.color || 'var(--accent)', borderColor: s.color || 'var(--accent)' } : {}}
                >
                  {s.icon
                    ? <Icon name={s.icon} size={12} color={active ? 'white' : (s.color || 'var(--accent)')} />
                    : <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: s.color || 'var(--accent)' }} />
                  }
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Win of the day */}
      <div className="px-5 pt-3">
        <p className="text-[10.5px] font-semibold text-faint uppercase tracking-[.06em] mb-2">Win of the day</p>
        <input
          type="text"
          value={win}
          onChange={e => setWin(e.target.value)}
          aria-label="Win of the day"
          placeholder="Something you're proud of today…"
          className="w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest"
        />
      </div>

      {/* Goals */}
      <div className="px-5 pt-3">
        <p className="text-[10.5px] font-semibold text-faint uppercase tracking-[.06em] mb-2">Goals</p>
        {goals.map(g => (
          <div key={g.id} className="flex items-center gap-2 mb-1.5">
            <button type="button" onClick={() => toggleGoal(g.id)}
              aria-label={g.done ? `Mark goal "${g.text}" as not done` : `Mark goal "${g.text}" as done`}
              className={`w-4 h-4 rounded-[4px] border flex-none flex items-center justify-center transition-colors ${
                g.done ? 'bg-accent border-accent' : 'border-field-border'
              }`}>
              {g.done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            </button>
            <span className={`text-[13px] flex-1 ${g.done ? 'line-through text-faint' : 'text-ink'}`}>{g.text}</span>
            <button type="button" aria-label={`Remove goal "${g.text}"`} onClick={() => removeGoal(g.id)} className="text-faint hover:text-danger text-[14px] leading-none">×</button>
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={goalDraft}
            onChange={e => setGoalDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGoal() } }}
            aria-label="Add a goal"
            placeholder="Add a goal… (Enter to add)"
            className="flex-1 bg-field-bg border border-field-border rounded-field px-3 py-1.5 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest"
          />
          <button type="button" onClick={addGoal}
            className="h-[34px] px-3 border border-line rounded-field text-[13px] font-semibold text-muted hover:text-ink hover:bg-track transition-colors">
            Add
          </button>
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between px-5 py-3.5 mt-4 border-t border-line-2 bg-panel-2">
        <div className="text-[12.5px] text-faint">
          {saveError && <span className="text-neg-fg">{saveError}</span>}
          {pointsPerEntry && !pointsEarnedToday && (
            <span className="text-accent font-semibold">+{pointsPerEntry} pts</span>
          )}
          {pointsEarnedToday && (
            <span className="text-pos-fg font-semibold">+{pointsEarnedToday} pts earned today ✓</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-[34px] px-3 text-[13px] font-semibold text-muted hover:text-ink transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasContent || saving}
            className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
          >
            {saving && <Spinner />}
            Save entry
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Student Entry Card ───────────────────────────────────────────────────────

interface EntryCardProps {
  entry: JournalEntryWithAuthor
  index: number
  total: number
  onDelete: (id: number) => void
}

const StudentEntryCard: React.FC<EntryCardProps> = ({ entry, index, total, onDelete }) => {
  const mood = MOODS.find(m => m.key === entry.mood)

  return (
    <div className="relative pl-6">
      <span
        className="absolute left-[1px] top-[7px] w-[11px] h-[11px] rounded-full border-2 border-accent"
        style={{ background: entry.mood ? moodColor(entry.mood) : 'var(--accent-soft)' }}
      />
      {index < total - 1 && (
        <span className="absolute left-[5.5px] top-5 bottom-[-1.25rem] w-[1.5px] bg-line" />
      )}
      <div className="bg-panel border border-line rounded-card-lg overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {entry.icon && (
                <Icon
                  name={entry.icon}
                  size={18}
                  color={entry.mood ? moodColor(entry.mood) : 'var(--accent)'}
                  className="flex-shrink-0"
                />
              )}
              <h3 className="font-serif text-[18px] font-semibold text-ink">{entry.title}</h3>
            </div>
            <span className="font-mono text-[11.5px] text-faint flex-none">{formatDate(entry.entry_date)}</span>
          </div>

          {/* Mood + tags */}
          {(mood || (entry.tags && entry.tags.length > 0)) && (
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {mood && (
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: mood.color }} />
                  {mood.label}
                </span>
              )}
              {entry.tags?.map(t => (
                <span key={t} className="px-2 py-[2px] rounded-pill bg-track border border-line text-[11px] text-muted">{t}</span>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="prose prose-sm max-w-none text-ink-2 font-serif text-[14.5px] leading-relaxed">
            <MarkdownRenderer content={entry.content} />
          </div>
        </div>

        {/* Win */}
        {entry.win && (
          <div className="mx-4 mb-3 px-3 py-2.5 bg-[var(--accent-soft)] border border-[var(--accent-line)] rounded-[10px]">
            <p className="text-[10.5px] font-semibold text-accent uppercase tracking-[.06em] mb-0.5">Win of the day</p>
            <p className="text-[13.5px] text-ink font-medium">{entry.win}</p>
          </div>
        )}

        {/* Goals */}
        {entry.goals && entry.goals.length > 0 && (
          <div className="mx-4 mb-3">
            <p className="text-[10.5px] font-semibold text-faint uppercase tracking-[.06em] mb-1.5">Goals</p>
            {entry.goals.map((g, i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <span className={`w-3.5 h-3.5 rounded-[3px] border flex-none flex items-center justify-center ${g.done ? 'bg-accent border-accent' : 'border-field-border'}`}>
                  {g.done && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                </span>
                <span className={`text-[13px] ${g.done ? 'line-through text-faint' : 'text-ink'}`}>{g.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reactions + replies from admin */}
        {((entry.reactions && entry.reactions.length > 0) || (entry.replies && entry.replies.length > 0)) && (
          <div className="mx-4 mb-3 px-3 py-3 bg-panel-2 border border-line rounded-[10px]">
            {entry.reactions && entry.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {entry.reactions.map(r => (
                  <span key={r} className="px-2.5 py-[3px] rounded-pill bg-accent-soft text-accent text-[12px] font-medium">{r}</span>
                ))}
              </div>
            )}
            {entry.replies?.map(r => (
              <div key={r.id} className="flex gap-2.5 mt-2">
                <div className="w-6 h-6 rounded-full bg-accent-soft flex-none flex items-center justify-center">
                  <span className="text-[10px] font-bold text-accent">{r.author_name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                </div>
                <div className="flex-1">
                  <span className="text-[12px] font-semibold text-ink mr-2">{r.author_name}</span>
                  <span className="text-[12.5px] text-ink-2">{r.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {entry.is_own_entry && (
          <div className="flex justify-end gap-1.5 px-4 py-2.5 border-t border-line-2 bg-panel-2">
            <button onClick={() => onDelete(entry.id)} className="h-[28px] px-2.5 text-[12px] font-semibold text-danger border border-line bg-panel rounded-[7px] hover:bg-neg-bg transition-colors">Delete</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Admin Entry Panel ────────────────────────────────────────────────────────

interface AdminEntryPanelProps {
  entry: JournalEntryWithAuthor
  isAdmin: boolean
  onReacted: (updated: JournalEntryWithAuthor) => void
  onReplied: (updated: JournalEntryWithAuthor) => void
  onDelete: (id: number) => void
  onMarkReviewed: (id: number) => void
}

const AdminEntryPanel: React.FC<AdminEntryPanelProps> = ({ entry, onReacted, onReplied, onDelete, onMarkReviewed }) => {
  const [replyDraft, setReplyDraft] = useState('')
  const [sending, setSending] = useState(false)
  const mood = MOODS.find(m => m.key === entry.mood)

  const toggleReaction = async (reaction: string) => {
    const current = entry.reactions ?? []
    const updated = current.includes(reaction)
      ? current.filter(r => r !== reaction)
      : [...current, reaction]
    try {
      const result = await journalApi.setReactions(entry.id, updated)
      onReacted(result)
    } catch {}
  }

  const sendReply = async () => {
    if (!replyDraft.trim()) return
    setSending(true)
    try {
      await journalApi.addReply(entry.id, replyDraft.trim())
      setReplyDraft('')
      // Refresh entry
      const updated = await journalApi.getById(entry.id)
      onReplied(updated)
    } catch {} finally {
      setSending(false)
    }
  }

  const deleteReply = async (replyId: number) => {
    try {
      await journalApi.deleteReply(replyId)
      const updated = await journalApi.getById(entry.id)
      onReplied(updated)
    } catch {}
  }

  return (
    <div className="bg-panel border border-line rounded-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-line-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {entry.icon && (
                <Icon
                  name={entry.icon}
                  size={16}
                  color={entry.mood ? moodColor(entry.mood) : 'var(--accent)'}
                  className="flex-shrink-0"
                />
              )}
              <h3 className="font-serif text-[17px] font-semibold text-ink">{entry.title}</h3>
              {entry.needs_response && (
                <span className="px-2 py-[2px] rounded-pill bg-[#ff6b6b22] text-[#ff6b6b] text-[11px] font-semibold">Awaiting reply</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[12.5px] text-faint flex-wrap">
              {mood && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: mood.color }} />{mood.label}</span>}
              {entry.tags?.map(t => <span key={t} className="px-2 py-[1px] rounded-pill bg-track border border-line text-[11px]">{t}</span>)}
              <span>·</span>
              <span>{entry.student_name}</span>
              <span>·</span>
              <span className="font-mono">{formatDate(entry.entry_date)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-none">
            {entry.needs_response ? (
              <button
                onClick={() => onMarkReviewed(entry.id)}
                className="h-[28px] px-2.5 text-[12px] font-semibold text-accent border border-accent-line bg-accent-soft rounded-[7px] hover:bg-accent hover:text-white transition-colors"
              >
                Mark reviewed
              </button>
            ) : (
              <span className="h-[28px] px-2.5 text-[12px] font-semibold text-faint border border-line bg-panel rounded-[7px] flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-pos-fg"><path d="M20 6 9 17l-5-5"/></svg>
                Reviewed
              </span>
            )}
            <button onClick={() => onDelete(entry.id)} className="h-[28px] px-2.5 text-[12px] font-semibold text-danger border border-line bg-panel rounded-[7px] hover:bg-neg-bg transition-colors">Delete</button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 font-serif text-[14.5px] leading-relaxed text-ink-2 space-y-3">
        <MarkdownRenderer content={entry.content} />
        {entry.win && (
          <div className="px-3 py-2.5 bg-[var(--accent-soft)] border border-[var(--accent-line)] rounded-[10px]">
            <p className="text-[10.5px] font-semibold text-accent uppercase tracking-[.06em] mb-0.5">Win</p>
            <p className="text-[13.5px] text-ink font-medium">{entry.win}</p>
          </div>
        )}
        {entry.goals && entry.goals.length > 0 && (
          <div>
            <p className="text-[10.5px] font-semibold text-faint uppercase tracking-[.06em] mb-1.5">Goals</p>
            {entry.goals.map((g, i) => (
              <div key={i} className="flex items-center gap-2 mb-1 font-sans">
                <span className={`w-3.5 h-3.5 rounded-[3px] border flex-none ${g.done ? 'bg-accent border-accent' : 'border-field-border'}`} />
                <span className={`text-[13px] ${g.done ? 'line-through text-faint' : 'text-ink'}`}>{g.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reactions */}
      <div className="px-5 pb-3">
        <p className="text-[10.5px] font-semibold text-faint uppercase tracking-[.06em] mb-2">Reactions</p>
        <div className="flex gap-2 flex-wrap">
          {REACTIONS.map(r => {
            const active = (entry.reactions ?? []).includes(r)
            return (
              <button key={r} type="button" onClick={() => toggleReaction(r)}
                className={`h-[28px] px-2.5 rounded-pill border text-[12.5px] font-medium transition-colors ${
                  active ? 'bg-accent-soft border-accent-line text-accent' : 'bg-panel border-line text-ink-2 hover:border-field-border'
                }`}>
                {r}
              </button>
            )
          })}
        </div>
      </div>

      {/* Replies */}
      {entry.replies && entry.replies.length > 0 && (
        <div className="px-5 pb-3 space-y-2">
          {entry.replies.map(r => (
            <div key={r.id} className="flex items-start gap-2.5 bg-panel-2 rounded-[10px] p-3">
              <div className="w-6 h-6 rounded-full bg-accent-soft flex-none flex items-center justify-center">
                <span className="text-[10px] font-bold text-accent">{r.author_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-semibold text-ink mr-2">{r.author_name}</span>
                <span className="text-[12.5px] text-ink-2">{r.text}</span>
                <p className="text-[11px] text-faint mt-1 font-mono">{formatDate(r.created_at)}</p>
              </div>
              <button aria-label="Delete reply" onClick={() => deleteReply(r.id)} className="text-faint hover:text-danger text-[16px] leading-none flex-none">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Reply composer */}
      <div className="px-5 pb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={replyDraft}
            onChange={e => setReplyDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendReply() }}
            aria-label="Reply"
            placeholder="Leave a reply…"
            className="flex-1 bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest"
          />
          <button
            type="button"
            onClick={sendReply}
            disabled={!replyDraft.trim() || sending}
            className="h-[38px] px-3 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Reply
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Journal: React.FC = () => {
  const { user } = useAuth()
  const [entries, setEntries] = useState<JournalEntryWithAuthor[]>([])
  const [students, setStudents] = useState<JournalStudent[]>([])
  const [composerData, setComposerData] = useState<JournalComposerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const isAdmin = user?.role === 'admin'

  // No synchronous setState here: this runs from the mount effect, and the
  // set-state-in-effect lint rule requires state updates to happen inside the
  // promise callbacks. `loading` starts true.
  const fetchEntries = useCallback((studentId?: number | null) => {
    // Admin always fetches all entries so sidebar counts remain accurate
    journalApi.getAll(isAdmin ? undefined : (studentId ?? undefined))
      .then(raw => {
        const data: JournalEntryWithAuthor[] = Array.isArray(raw) ? raw : []
        setError(null)
        setEntries(data)
      })
      .catch(err => {
        setError(`Failed to load journal entries: ${getErrorMessage(err)}`)
        setEntries([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isAdmin])

  // Effect event: reads the latest selectedStudentId without making it a
  // refetch trigger (student switching is filtered client-side, not refetched).
  const fetchEntriesForSelectedStudent = useEffectEvent(() => {
    fetchEntries(selectedStudentId)
  })

  useEffect(() => {
    if (!user) return
    // Admin: only re-fetch from server on mount (selectedStudentId filter is client-side)
    if (isAdmin) {
      fetchEntries(null)
      journalApi.getStudents().then(s => setStudents(Array.isArray(s) ? s : [])).catch(() => {})
    } else {
      fetchEntriesForSelectedStudent()
      journalApi.getComposerData().then(setComposerData).catch(() => {})
    }
  }, [user, isAdmin, fetchEntries])

  const handleDelete = (id: number) => setDeletingEntryId(id)

  const confirmDelete = async () => {
    if (deletingEntryId === null) return
    setDeleteLoading(true)
    try {
      await journalApi.delete(deletingEntryId)
      setEntries(prev => prev.filter(e => e.id !== deletingEntryId))
    } catch (err) {
      setError(`Failed to delete entry: ${getErrorMessage(err)}`)
    } finally {
      setDeleteLoading(false)
      setDeletingEntryId(null)
    }
  }

  const updateEntry = (updated: JournalEntryWithAuthor) =>
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))

  const markReviewed = async (id: number) => {
    // Optimistic flip for instant badge decrement
    setEntries(prev => prev.map(e => e.id === id ? { ...e, needs_response: false } : e))
    try {
      const updated = await journalApi.markRead(id)
      updateEntry(updated)
    } catch {
      // Roll back on error
      setEntries(prev => prev.map(e => e.id === id ? { ...e, needs_response: true } : e))
    }
  }

  const filteredEntries = entries.filter(e => {
    if (isAdmin && selectedStudentId !== null && e.student_id !== selectedStudentId) return false
    return (
      e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.student_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayLabel = format(new Date(), 'EEEE, MMMM d')
  const streak = entries[0]?.streak ?? 0

  if (!user) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError(null)} className="ml-3 text-neg-fg/60 hover:text-neg-fg">✕</button>
        </div>
      )}

      {/* ═══════════════════════════
          STUDENT VIEW
      ═══════════════════════════ */}
      {!isAdmin && (
        <div className="max-w-[760px] mx-auto pb-24">
          {/* Greeting + stats */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <h1 className="font-serif text-[28px] sm:text-[32px] font-medium tracking-[-0.01em] text-ink leading-tight">
                {greeting}, {user.first_name || user.username}.
              </h1>
              <p className="mt-1.5 text-muted text-[14px]">{todayLabel} · What's on your mind today?</p>
            </div>
            <div className="flex gap-2.5 flex-none">
              {streak > 0 && (
                <div className="text-center bg-panel border border-line rounded-[11px] px-3.5 py-2.5">
                  <div className="font-mono text-[22px] font-semibold text-[#ff6b6b] leading-none">{streak}</div>
                  <div className="text-[10.5px] text-muted mt-1 uppercase tracking-[.05em]">day streak</div>
                </div>
              )}
              <div className="text-center bg-panel border border-line rounded-[11px] px-3.5 py-2.5">
                <div className="font-mono text-[22px] font-semibold text-accent leading-none">{entries.length}</div>
                <div className="text-[10.5px] text-muted mt-1 uppercase tracking-[.05em]">entries</div>
              </div>
            </div>
          </div>

          {/* Composer */}
          <StudentComposer
            composerData={composerData}
            onSaved={entry => {
              setEntries(prev => [entry, ...prev])
              if (composerData && entry.points_awarded) {
                setComposerData(prev => prev ? { ...prev, points_today: entry.points_awarded ?? null } : prev)
              }
            }}
          />

          {/* Timeline */}
          <div className="flex items-center gap-2.5 mb-4">
            <h2 className="font-serif text-[21px] font-medium text-ink">Your journey</h2>
            <span className="font-mono text-[12px] text-faint">{entries.length} entries</span>
          </div>

          {entries.length === 0 ? (
            <div className="py-14 text-center">
              <p className="font-serif text-[18px] text-ink-2 mb-2">No entries yet</p>
              <p className="text-[13px] text-faint">Your journal will appear here once you start writing.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {entries.map((entry, i) => (
                <StudentEntryCard
                  key={entry.id}
                  entry={entry}
                  index={i}
                  total={entries.length}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════
          ADMIN VIEW
      ═══════════════════════════ */}
      {isAdmin && (
        <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-10rem)] lg:min-h-[520px] gap-4">
          {/* Student roster — horizontal chips on mobile, side rail on desktop */}
          <div className="lg:flex-none lg:w-[250px] lg:bg-panel lg:border lg:border-line lg:rounded-card lg:flex lg:flex-col lg:min-h-0">
            {/* Desktop search */}
            <div className="hidden lg:block flex-none px-3 pt-3 pb-2 border-b border-line-3">
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

            {/* Desktop vertical list */}
            <div className="hidden lg:block flex-1 overflow-y-auto p-2 space-y-0.5">
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
                const studentEntries = entries.filter(e => e.student_id === s.id)
                const awaiting = studentEntries.filter(e => e.needs_response).length
                const initials = s.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudentId(s.id)}
                    className={`w-full text-left px-2 py-2 rounded-[8px] transition-colors flex items-center gap-2 ${
                      selectedStudentId === s.id ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-track'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-accent-soft flex-none flex items-center justify-center">
                      <span className="text-[10px] font-bold text-accent">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold truncate">{s.name}</span>
                        {awaiting > 0 && (
                          <span className="flex-none w-4 h-4 rounded-full bg-[#ff6b6b] text-white text-[9px] font-bold flex items-center justify-center">{awaiting}</span>
                        )}
                      </div>
                      {studentEntries.length > 0 && (() => {
                        const segs = moodBreakdown(studentEntries)
                        const moodCount = segs.reduce((acc, s) => acc + s.count, 0)
                        const noMoodCount = studentEntries.length - moodCount
                        const total = studentEntries.length
                        const title = [
                          ...segs.map(s => `${s.label} ×${s.count}`),
                          ...(noMoodCount > 0 ? [`no mood ×${noMoodCount}`] : []),
                        ].join(', ')
                        return (
                          <div className="flex rounded-full overflow-hidden mt-1.5 h-[5px] w-full bg-track" title={title} aria-label={`Mood breakdown: ${title}`}>
                            {segs.map(s => (
                              <span
                                key={s.label}
                                className="block h-full flex-none"
                                style={{ background: s.color, width: `${(s.count / total) * 100}%` }}
                              />
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Mobile horizontal chip bar */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                onClick={() => setSelectedStudentId(null)}
                className={`flex-none px-3 py-1.5 rounded-pill text-[13px] font-semibold transition-colors whitespace-nowrap ${
                  selectedStudentId === null ? 'bg-accent text-white' : 'bg-panel border border-line text-ink-2'
                }`}
              >
                All
                <span className="ml-1 font-mono text-[11px] opacity-60">{entries.length}</span>
              </button>
              {students.map(s => {
                const awaiting = entries.filter(e => e.student_id === s.id && e.needs_response).length
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudentId(s.id)}
                    className={`flex-none relative px-3 py-1.5 rounded-pill text-[13px] font-semibold transition-colors whitespace-nowrap ${
                      selectedStudentId === s.id ? 'bg-accent text-white' : 'bg-panel border border-line text-ink-2'
                    }`}
                  >
                    {s.name.split(' ')[0]}
                    {awaiting > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff6b6b] text-white text-[9px] font-bold flex items-center justify-center">{awaiting}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Mobile search */}
            <div className="lg:hidden mt-3 relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search entries…"
                className="w-full pl-7 pr-2 py-2 bg-field-bg border border-field-border rounded-field text-[13px] text-ink placeholder:text-faintest focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* Entry feed */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="hidden lg:flex items-center justify-between mb-3 flex-none">
              <div>
                <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-0.5">
                  {selectedStudentId ? students.find(s => s.id === selectedStudentId)?.name : 'All students'}
                </p>
                <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em] leading-none">Journal</h1>
              </div>
            </div>

            <div className="flex-1 lg:overflow-y-auto space-y-4 mt-4 lg:mt-0">
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
                <AdminEntryPanel
                  key={entry.id}
                  entry={entry}
                  isAdmin={isAdmin}
                  onReacted={updateEntry}
                  onReplied={updateEntry}
                  onDelete={handleDelete}
                  onMarkReviewed={markReviewed}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deletingEntryId !== null}
        onClose={() => setDeletingEntryId(null)}
        onConfirm={confirmDelete}
        tone="danger"
        title="Delete journal entry"
        message="Are you sure you want to delete this journal entry? This action cannot be undone."
        confirmLabel="Delete entry"
        loading={deleteLoading}
      />
    </div>
  )
}

export default Journal
