import { useState } from 'react'
import { api, getErrorMessage } from '../../services/api'
import { HelpRequest } from '../../types/assignment'
import { Button, TextArea } from '../ui'

export default function TaskHelp({assignmentId,requests,onRequested}: {assignmentId:number;requests:HelpRequest[];onRequested:(request:HelpRequest)=>void}) {
  const [open,setOpen]=useState(false)
  const [note,setNote]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const pending=requests.find(r=>!r.resolved_at)
  const ask=async()=>{
    if(!note.trim()||busy)return
    setBusy(true);setError(null)
    try{const request=await api.post(`/assignments/student-assignments/${assignmentId}/help`,{note}) as HelpRequest;onRequested(request);setOpen(false);setNote('')}
    catch(err){setError(getErrorMessage(err,'Could not send your request. Try again.'))}finally{setBusy(false)}
  }
  return <section className="space-y-2 rounded-lg border border-line p-3">
    {pending ? <><p className="font-semibold text-sm">Your teacher has your help request</p><p className="text-sm">{pending.note}</p><p className="text-xs text-muted">You can keep working while you wait.</p></> : <Button variant="outline" onClick={()=>setOpen(!open)}>Ask my teacher for help</Button>}
    {open&&!pending&&<><TextArea label="What do you need help with?" value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} rows={2}/><Button onClick={()=>void ask()} loading={busy} disabled={!note.trim()}>Send help request</Button></>}
    {requests.filter(r=>r.resolved_at).slice(-1).map(r=><p key={r.id} className="text-sm">Teacher helped: {r.response || 'Discussed with you.'}</p>)}
    {error&&<p role="alert" className="text-danger text-sm">{error}</p>}
  </section>
}
