import { useEffect, useState } from 'react'
import { api,getErrorMessage } from '../../services/api'
import { Button, Input } from '../ui'

export default function SchoolIdentityPanel(){
  const [name,setName]=useState('OurSchool')
  const [logo,setLogo]=useState<string|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  useEffect(()=>{api.get('/settings/school/identity').then((value:{name:string;logo:string|null})=>{setName(value.name);setLogo(value.logo)}).catch(err=>setMessage(getErrorMessage(err,'Could not load your school identity.')))},[])
  const save=async(file?:File,remove=false)=>{
    setBusy(true);setMessage('')
    try{
      let result:{name:string;logo:string|null}
      if(remove)result=await api.delete('/settings/school/logo')
      else if(file){const form=new FormData();form.append('file',file);result=await api.postForm('/settings/school/logo',form) as {name:string;logo:string|null}}
      else result=await api.put('/settings/school/identity',{name:name.trim()})
      setName(result.name);setLogo(result.logo);setMessage('Saved. Plans and report cards use this identity.')
    }catch(err){setMessage(getErrorMessage(err,'Could not save your school identity.'))}finally{setBusy(false)}
  }
  return <section className="space-y-4 max-w-xl"><h2 className="text-xl font-bold">Your school or program</h2><p className="text-sm text-muted">This name and optional logo appear on printed plans and report cards.</p><Input label="School or program name" value={name} maxLength={160} onChange={e=>setName(e.target.value)} disabled={busy}/><Button loading={busy} disabled={!name.trim()} onClick={()=>void save()}>Save name</Button>{logo&&<div><img src={logo} alt="School logo" className="max-h-24 max-w-full"/><Button variant="secondary" disabled={busy} onClick={()=>void save(undefined,true)}>Remove logo</Button></div>}<label className="block text-sm">Optional logo · PNG, JPEG or WebP, under 2 MB<input className="block w-full mt-2" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void save(file);e.target.value=''}}/></label>{message&&<p role="status" className="text-sm">{message}</p>}</section>
}
