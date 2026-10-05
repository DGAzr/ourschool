import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { shopApi } from '../../services/shop'
import { getErrorMessage } from '../../services/api'
import type { ShopItem } from '../../types/shop'
import type { StudentPoints } from '../../services/points'

export default function RewardChoices({points,onChanged}: {points:StudentPoints;onChanged:(points:StudentPoints)=>void}) {
  const [items,setItems]=useState<ShopItem[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(()=>{shopApi.getItems().then(items=>setItems(items.filter(i=>i.is_active&&(i.quantity_available===null||i.quantity_available>0)))).catch(err=>setError(getErrorMessage(err,'Could not load reward choices.')))},[])
  const choose=async(id:number|null)=>{
    setBusy(true);setError('')
    try{onChanged(await shopApi.setMyGoal(id))}catch(err){setError(getErrorMessage(err,'Could not save your goal.'))}finally{setBusy(false)}
  }
  return <div className="mt-3 space-y-2"><label className="block text-xs text-muted">My chosen reward<select className="block mt-1 w-full min-w-0 p-2 border border-line rounded-field bg-panel text-sm text-ink" disabled={busy} value={points.goal_item_id??''} onChange={e=>void choose(e.target.value?Number(e.target.value):null)}><option value="">Choose a goal</option>{items.map(item=><option key={item.id} value={item.id}>{item.name} · {item.cost_points} pts</option>)}</select></label><p className="text-xs text-muted">Affordable alternatives: {items.filter(i=>i.cost_points<=points.current_balance&&i.id!==points.goal_item_id).slice(0,3).map(item=><Link className="text-accent underline mr-2" to={`/shop?item=${item.id}`} key={item.id}>{item.name}</Link>)}</p>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}</div>
}
