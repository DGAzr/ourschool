import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getErrorMessage } from '../../services/api'
import { HelpRequest } from '../../types/assignment'
import { Lesson } from '../../types/lesson'
import { Button, TextArea } from '../ui'

function HelpItem({request,onResolved}: {request:HelpRequest;onResolved:()=>void}) {
  const [response,setResponse]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const resolve=async()=>{
    setBusy(true);setError(null)
    try{await api.post(`/assignments/help-requests/${request.id}/resolve`,{response});onResolved()}catch(err){setError(getErrorMessage(err,'Could not resolve this request.'))}finally{setBusy(false)}
  }
  return <li className="border border-line rounded-lg p-3 space-y-2"><Link className="font-semibold text-accent" to={`/assignments/${request.assignment_id}`}>{request.student_name} · {request.assignment_name}</Link><p className="text-sm">{request.note}</p><TextArea label={`Reply to ${request.student_name}`} rows={2} maxLength={2000} value={response} onChange={e=>setResponse(e.target.value)} /><Button size="sm" loading={busy} onClick={()=>void resolve()}>Resolved / helped in person</Button>{error&&<p role="alert" className="text-danger text-sm">{error}</p>}</li>
}
export default function TeacherTodayPanel({lessons,pendingGrades}: {lessons:Lesson[];pendingGrades:number}) {
  const [requests,setRequests]=useState<HelpRequest[]>([])
  const [total,setTotal]=useState(0)
  const [error,setError]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)
  const load=useCallback((offset=0)=>api.get(`/assignments/help-requests?offset=${offset}`).then((page:{items:HelpRequest[];total:number})=>{setRequests(previous=>offset===0?page.items:[...previous,...page.items]);setTotal(page.total);setError(null)}).catch(err=>setError(getErrorMessage(err,'Could not load help requests.'))).finally(()=>setLoading(false)),[])
  useEffect(()=>{void load()},[load])
  const prep=lessons.filter(l=>l.status!=='taught' && l.materials.some(m=>!m.is_gathered)).length
  return <section className="bg-panel rounded-card border border-line p-4 mb-5"><h2 className="font-bold text-lg mb-3">Today</h2><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Link className="rounded-lg bg-panel-2 p-3 font-semibold" to="/attendance">Take attendance</Link><Link className="rounded-lg bg-panel-2 p-3 font-semibold" to="/teach">Teach & prepare · {prep} need materials</Link><Link className="rounded-lg bg-panel-2 p-3 font-semibold" to="/grading">Grade submitted work · {pendingGrades}</Link></div><h3 className="font-semibold mt-4 mb-2">Student help requests · {total} open</h3>{error&&<p role="alert">{error} <button onClick={()=>void load()} className="text-accent">Try again</button></p>}<ul className="space-y-2">{requests.map(request=><HelpItem key={request.id} request={request} onResolved={()=>void load()} />)}</ul>{!total&&!loading&&!error&&<p className="text-sm text-muted">No students waiting for task help.</p>}{requests.length<total&&<Button loading={loading} onClick={()=>void load(requests.length)}>Load more help requests</Button>}</section>
}
