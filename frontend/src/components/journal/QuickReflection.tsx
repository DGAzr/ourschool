import { useState } from 'react'
import { journalApi } from '../../services/journal'
import { getErrorMessage } from '../../services/api'
import type { JournalEntryWithAuthor } from '../../types'
import { todayISO } from '../../utils/dates'

export default function QuickReflection({onSaved}: {onSaved:(entry:JournalEntryWithAuthor)=>void}) {
  const [mood,setMood]=useState('')
  const [sentence,setSentence]=useState('')
  const [learned,setLearned]=useState('')
  const [help,setHelp]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const finish=async()=>{
    if(busy)return
    setBusy(true);setError('')
    try {
      const paragraphs=[sentence.trim(),learned.trim()&&`What I learned: ${learned.trim()}`,help.trim()&&`Help I need: ${help.trim()}`].filter(Boolean)
      const entry=await journalApi.create({title:`My reflection · ${todayISO()}`,content:paragraphs.join('\n\n') || `Today I feel ${mood}.`,mood:mood||undefined})
      onSaved(entry);setMood('');setSentence('');setLearned('');setHelp('')
    } catch(err){setError(getErrorMessage(err, 'Could not save your reflection. Try again.'))}finally{setBusy(false)}
  }
  return <section className="space-y-4 p-5 mb-6 bg-panel border border-line rounded-card"><h2 className="font-semibold text-lg">A quick reflection</h2><p className="text-sm text-muted">Choose a mood or write one sentence. The other prompts are optional.</p>
    <label className="block text-sm">How do I feel?<select aria-label="How do I feel?" disabled={busy} className="block w-full rounded-field border border-line bg-panel p-2 mt-1" value={mood} onChange={e=>setMood(e.target.value)}><option value="">Choose a mood (optional)</option>{['happy','proud','calm','tired','frustrated','curious'].map(m=><option key={m} value={m}>{m}</option>)}</select></label>
    <label className="block text-sm">One thing about my day<textarea disabled={busy} className="block w-full border border-line rounded-field p-2 bg-panel mt-1" rows={2} value={sentence} onChange={e=>setSentence(e.target.value)} /></label>
    <details><summary className="text-sm text-accent cursor-pointer">What I learned / Help I need (optional)</summary><div className="space-y-3 mt-3"><label className="block text-sm">What I learned<input className="block w-full border border-line rounded-field p-2 bg-panel mt-1" disabled={busy} value={learned} onChange={e=>setLearned(e.target.value)}/></label><label className="block text-sm">Help I need<input className="block w-full border border-line rounded-field p-2 bg-panel mt-1" disabled={busy} value={help} onChange={e=>setHelp(e.target.value)}/></label></div></details>
    {error&&<p role="alert" className="text-danger text-sm">{error}</p>}<button type="button" className="bg-accent text-white rounded-field px-4 py-2 disabled:opacity-50" disabled={busy||(!mood&&!sentence.trim()&&!learned.trim()&&!help.trim())} onClick={()=>void finish()}>{busy?'Saving…':'Save reflection'}</button>
  </section>
}
