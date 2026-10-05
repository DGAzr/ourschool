import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { assignmentsApi, assignmentPage } from '../../services/assignments'
import { lessonsApi } from '../../services/lessons'
import { useAuth } from '../../contexts/AuthContext'
import { StudentAssignment } from '../../types/assignment'
import { StudentLesson } from '../../types/lesson'
import { addDays,todayISO } from '../../utils/dates'

export default function LearnerWins() {
  const {user}=useAuth()
  const [wins,setWins]=useState<StudentAssignment[]>([])
  const [next,setNext]=useState<StudentLesson[]>([])
  const [finished,setFinished]=useState(false)
  const key=`ourschool.highlight.${user?.id}`
  const [highlight,setHighlight]=useState<number|null>(()=>{try{return Number(localStorage.getItem(key))||null}catch{return null}})
  const [dismissed,setDismissed]=useState(false)
  const [error,setError]=useState(false)
  useEffect(()=>{
    if(!user)return
    let active=true
    Promise.all([
      assignmentPage({student_view:true,tab:'done',sort:'recent',limit:6}),
      assignmentPage({student_view:true,tab:'submitted',sort:'recent',limit:6}),
      assignmentPage({student_view:true,tab:'todo',due_from:todayISO(),due_to:todayISO(),limit:1}),
      lessonsApi.myLessons({start_date:todayISO(),end_date:addDays(todayISO(),7)}),
      assignmentPage({student_view:true,tab:'todo',sort:'recent',limit:6}),
    ]).then(async([done,submitted,today,nextLessons,inProgress])=>{
      const ids=[...done.items.filter(a=>a.status!=='excused'),...submitted.items,...inProgress.items.filter(a=>a.time_spent_minutes>0)].sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).slice(0,6)
      const details=await Promise.all(ids.map(row=>assignmentsApi.getStudentAssignment(row.id)))
      if(!active)return
      setWins(details);setNext(nextLessons.filter(l=>l.date>todayISO()).slice(0,3));setFinished(today.total===0 && nextLessons.filter(l=>l.date===todayISO()).every(l=>(l.assignments??[]).every(a=>['graded','submitted','excused'].includes(a.status))) && details.some(a=>a.submitted_date===todayISO()||a.completed_date===todayISO()))
    }).catch(()=>{if(active)setError(true)})
    return()=>{active=false}
  },[user])
  const choose=(id:number)=>{setHighlight(id);try{localStorage.setItem(key,String(id))}catch{/* The highlight still works for this visit. */}}
  if(error)return <p className="text-sm text-muted">Your recent wins could not be loaded.</p>
  if(!wins.length)return null
  return <section className="border border-line rounded-card bg-panel p-4 mb-4">
    {finished && user?.celebrate_completion!==false && !dismissed && <div className="rounded-lg bg-accent-soft p-3 mb-3"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">You finished today’s work!</h2><button className="text-sm text-muted" onClick={()=>setDismissed(true)}>Dismiss celebration</button></div><p className="text-sm">Choose one thing you’re proud of below.</p>{next.length>0&&<p className="text-sm mt-2">Next session: {next.map(l=>l.title).join(' · ')} <Link className="text-accent" to="/my-lessons">See upcoming lessons</Link></p>}</div>}
    <h2 className="font-bold mb-2">Your recent wins</h2><p className="text-xs text-muted mb-3">Your own finished work and teacher feedback. Highlight a favorite on this device.</p>
    <ul className="space-y-3">{wins.map(assignment=><li key={assignment.id} className="rounded-lg bg-panel-2 p-3"><Link className="font-semibold text-accent break-words" to={`/assignments/${assignment.id}`}>{assignment.template?.name}</Link><p className="text-sm">{assignment.teacher_feedback || (['graded','submitted'].includes(assignment.status)?'You finished this activity.':'You made time to work on this activity.')}</p>{user?.show_effort_signals!==false && assignment.time_spent_minutes>0&&<p className="text-xs text-muted">{assignment.time_spent_minutes} minutes you recorded working.</p>}<button type="button" className="text-xs text-accent mt-2" aria-pressed={highlight===assignment.id} onClick={()=>choose(assignment.id)}>{highlight===assignment.id ? 'My chosen highlight' : 'Make this my highlight'}</button></li>)}</ul>
  </section>
}
