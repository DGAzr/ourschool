import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import LessonPlanning from './LessonPlanning'
import type { Lesson } from '../types/lesson'

const mocks = vi.hoisted(() => ({ list: vi.fn(), impact: vi.fn(), batch: vi.fn(), toast: vi.fn() }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({user:{id:1,role:'admin'}}) }))
vi.mock('../components/ui', async original => ({...await original<typeof import('../components/ui')>(), useToast:()=>({toast:mocks.toast})}))
vi.mock('../components/lessons/LessonBoard', () => ({ default:()=>null }))
vi.mock('../components/lessons/PlannerHeader', () => ({ default:()=>null }))
vi.mock('../services/lessons', () => ({lessonsApi:{list:mocks.list,impact:mocks.impact,batch:mocks.batch,drawer:vi.fn().mockResolvedValue([]),rollover:vi.fn().mockResolvedValue({lessons:[],warnings:[],moved_count:0})}}))
vi.mock('../services/subjects',()=>({subjectsApi:{getAll:vi.fn().mockResolvedValue([])}}))
vi.mock('../services/assignments',()=>({assignmentsApi:{getStudents:vi.fn().mockResolvedValue([])}}))
vi.mock('../services/settings',()=>({settingsApi:{getGroupedSettings:vi.fn().mockResolvedValue({attendance:{skip_weekends:false}})}}))
vi.mock('../services/api',()=>({api:{get:vi.fn().mockResolvedValue({name:'Family school'})},getErrorMessage:()=> 'Try again.'}))
vi.mock('../hooks/useLessons',()=>({useLessons:()=>({lessons:[],loading:false,error:null,refetch:vi.fn(),toggleMaterial:vi.fn()})}))
const makeLesson=(id:number,date:string,title:string):Lesson=>({id,date,title,position:0,status:'planned',students:[],templates:[],materials:[],resources:[],paperless_materials:[],external_id:`lesson-${id}`,created_at:'',updated_at:''})
const week=[makeLesson(1,'2026-10-05','Monday reading'),makeLesson(2,'2026-10-11','Sunday nature walk')]
beforeEach(()=>{
  vi.clearAllMocks()
  localStorage.setItem('lessonPlanning.daysShown','5')
  mocks.list.mockResolvedValue(week)
  mocks.impact.mockResolvedValue([])
  mocks.batch.mockResolvedValue(week.map(lesson=>({lesson,warnings:[]})))
})
const open=()=>render(<MemoryRouter initialEntries={['/lessons?date=2026-10-05']}><LessonPlanning/></MemoryRouter>)
it('prints the full selected week even when the five-day board has no loaded lessons',async()=>{
  open()
  await userEvent.click(screen.getByRole('button',{name:'Print week'}))
  expect(await screen.findByText('Sunday nature walk')).toBeInTheDocument()
  expect(mocks.list).toHaveBeenCalledWith({start_date:'2026-10-05',end_date:'2026-10-11'})
  expect(screen.getByText('Family school · Learning plan')).toBeInTheDocument()
})
it('copies the full week after reviewing its new work, independent of board width',async()=>{
  open()
  await userEvent.click(screen.getByRole('button',{name:'Copy week'}))
  await screen.findByText('No assignments affected.')
  await userEvent.click(screen.getByRole('button',{name:'Apply changes'}))
  await waitFor(()=>expect(mocks.batch).toHaveBeenCalledWith([1,2],'copy','2026-10-12',undefined))
})
