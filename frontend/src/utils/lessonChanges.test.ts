import { describe, it, expect } from 'vitest'
import { mergeLessonOrder, lessonDraft } from './lessonChanges'
import { Lesson } from '../types/lesson'
const row = (id:number,position:number,date:string|null='2026-10-05') => ({id,position,date, status:'taught', title:'Fractions',students:[],templates:[],materials:[{label:'Paper',is_gathered:true}],resources:[]} as unknown as Lesson)
describe('filtered lesson editing',()=>{
  it('leaves hidden cards in their slots and includes a moved card',()=>{
    expect(mergeLessonOrder([row(1,0),row(2,1),row(3,2),row(4,0,null)],'2026-10-05',[3,1,4])).toEqual([3,2,1,4])
  })
  it('copies planning data without taught/prepared state',()=>{
    const copy=lessonDraft(row(1,0),'2026-10-12',7)
    expect(copy.status).toBe('planned')
    expect(copy.materials?.[0].is_gathered).toBe(false)
    expect(copy).not.toHaveProperty('assignments')
  })
})
