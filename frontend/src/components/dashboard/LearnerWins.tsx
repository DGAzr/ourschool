import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { assignmentPage } from '../../services/assignments'
import { useAuth } from '../../contexts/AuthContext'
import MarkdownRenderer from '../common/MarkdownRenderer'

/** Recent work is supplementary; daily completion belongs to the shared plan. */
export default function LearnerWins() {
  const { user } = useAuth()
  const key = `ourschool.highlight.${user?.id}`
  const [highlight, setHighlight] = useState<number | null>(() => { try { return Number(localStorage.getItem(key)) || null } catch { return null } })
  const wins = useQuery({
    queryKey: ['student-wins', user?.id],
    queryFn: async ({ signal }) => {
      const [done, submitted] = await Promise.all([
        assignmentPage({ student_view: true, tab: 'done', sort: 'recent', limit: 6 }, signal),
        assignmentPage({ student_view: true, tab: 'submitted', sort: 'recent', limit: 6 }, signal),
      ])
      return [...done.items.filter(a => a.status !== 'excused'), ...submitted.items].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6)
    },
  })
  if (wins.isPending) return <p role="status">Loading your recent work…</p>
  if (wins.isError) return <p role="alert">Your recent work could not be loaded. <button onClick={() => void wins.refetch()} className="text-accent underline">Try again</button></p>
  if (!wins.data.length) return <p>No finished work yet. It will appear here when you hand in an activity.</p>
  return <section className="space-y-3"><h2 className="text-lg font-semibold">Your recent work</h2><p className="text-sm text-muted">Highlight a favorite on this device.</p><ul className="space-y-3">{wins.data.map(assignment => <li key={assignment.id} className="rounded-field bg-panel-2 p-3"><Link to={`/assignments/${assignment.id}?from=%2F`} className="font-semibold text-accent break-words">{assignment.template?.name}</Link>{assignment.teacher_feedback ? <MarkdownRenderer content={assignment.teacher_feedback} /> : <p>You finished this activity.</p>}{user?.show_effort_signals !== false && assignment.time_spent_minutes > 0 && <p className="text-sm text-muted">{assignment.time_spent_minutes} minutes you recorded working.</p>}<button type="button" className="min-h-11 text-sm text-accent" aria-pressed={highlight === assignment.id} onClick={() => { setHighlight(assignment.id); try { localStorage.setItem(key, String(assignment.id)) } catch { /* Visit-only preference. */ } }}>{highlight === assignment.id ? 'My chosen highlight' : 'Make this my highlight'}</button></li>)}</ul></section>
}
