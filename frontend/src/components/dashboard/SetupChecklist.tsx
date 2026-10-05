import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {useAuth} from '../../contexts/AuthContext'
import {api,getErrorMessage} from '../../services/api'

type Step='students'|'subjects'|'term'|'attendance'|'lesson'
const steps:{key:Step;label:string;href:string}[]=[{key:'students',label:'Add students',href:'/admin?section=users'},{key:'subjects',label:'Add subjects',href:'/admin?section=subjects'},{key:'term',label:'Choose an active term',href:'/admin?section=terms'},{key:'attendance',label:'Review attendance rules',href:'/admin?section=attendance'},{key:'lesson',label:'Plan your first lesson',href:'/lessons'}]
export default function SetupChecklist({alwaysVisible=false}: {alwaysVisible?:boolean}){
  const {user}=useAuth()
  const key=`ourschool.setup.dismissed.${user?.id}`
  const [dismissed,setDismissed]=useState(()=>{try{return localStorage.getItem(key)==='true'}catch{return false}})
  const [state,setState]=useState<Record<Step,boolean>|null>(null)
  const [error,setError]=useState('')
  useEffect(()=>{api.get('/settings/setup/checklist').then(setState).catch(err=>setError(getErrorMessage(err,'Could not load setup progress.')))},[])
  if(dismissed&&!alwaysVisible)return null
  if(!state&&!error)return null
  const complete=state&&steps.every(step=>state[step.key])
  if(complete&&!alwaysVisible)return null
  return <section className="bg-panel border border-line rounded-card p-4 mb-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold text-lg">{complete?'Your school is ready':'Set up your school'}</h2>{!alwaysVisible&&<button className="text-sm text-muted" onClick={()=>{setDismissed(true);try{localStorage.setItem(key,'true')}catch{/* Visit settings to reopen. */}}}>Dismiss checklist</button>}</div><p className="text-sm text-muted mt-1">Complete the essentials for a usable school day. Reopen this checklist in Settings → Overview.</p>{error&&<p role="alert">{error}</p>}<ul className="mt-3 space-y-2">{steps.map(step=><li key={step.key} className="flex flex-wrap justify-between gap-2 text-sm"><Link className="text-accent" to={step.href}>{state?.[step.key]?'✓ ':''}{step.label}</Link>{step.key==='attendance'&&!state?.attendance&&<button className="text-accent" onClick={()=>{api.post('/settings/setup/attendance-reviewed',{}).then(setState).catch(err=>setError(getErrorMessage(err,'Could not save your review.')))}}>I reviewed the rules</button>}</li>)}</ul></section>
}
