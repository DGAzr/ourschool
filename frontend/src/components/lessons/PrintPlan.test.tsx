import {render,screen,cleanup} from '@testing-library/react'
import {afterEach,describe,it,expect} from 'vitest'
import PrintPlan from './PrintPlan'
import {Lesson} from '../../types/lesson'
const lesson={id:771,title:'Explore a creek',date:'2026-10-05',position:0,status:'planned',objective:'Notice living things',notes:'PRIVATE teacher reminder',students:[{id:22,first_name:'Sam'}],materials:[{label:'Notebook'}],resources:[],templates:[],paperless_materials:[]} as unknown as Lesson
afterEach(cleanup)
describe('family learning plan',()=>{
  it('prints named students and required materials without private notes or internal IDs',()=>{
    render(<PrintPlan lessons={[lesson]} teacherCopy={false} schoolName="River School" />)
    expect(screen.getByText('River School · Learning plan')).toBeInTheDocument()
    expect(screen.getByText('Students: Sam')).toBeInTheDocument()
    expect(screen.getByText('Materials: Notebook')).toBeInTheDocument()
    expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument()
    expect(document.querySelector('.school-plan-print')?.textContent).not.toContain('771')
  })
  it('only includes private teacher notes by explicit choice',()=>{
    render(<PrintPlan lessons={[lesson]} teacherCopy schoolName="River School" />)
    expect(screen.getByText('Teacher notes: PRIVATE teacher reminder')).toBeInTheDocument()
  })
})
