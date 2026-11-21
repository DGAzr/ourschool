import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import StudentActivityWorkspace from './StudentActivityWorkspace'
import { assignmentsApi } from '../services/assignments'
import { lessonsApi } from '../services/lessons'
import { StudentAssignment } from '../types'
import { todayISO } from '../utils/dates'

vi.mock('../contexts/AuthContext', async importOriginal => ({...await importOriginal<typeof import('../contexts/AuthContext')>(),useAuth: () => ({user:{id:2,role:'student',student_ui_mode:'simple'}})}))
vi.mock('../services/assignments', () => ({assignmentsApi:{getStudentAssignment:vi.fn(),updateStudentAssignment:vi.fn(),startAssignment:vi.fn(),getTimeEntries:vi.fn()}}))
vi.mock('../services/lessons', () => ({lessonsApi:{myLesson:vi.fn(),myDay:vi.fn()}}))
vi.mock('../components/student/StudentResources', () => ({default: ({resources=[]}: {resources?: {label:string}[]}) => <div>{resources.map(r=><p key={r.label}>{r.label}</p>)}</div>}))
let work: StudentAssignment
beforeEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
  work = {id:12,template_id:1,lesson_id:1,student_id:2,assigned_by:1,assigned_date:todayISO(),status:'in_progress',started_date:todayISO(),is_graded:false,time_spent_minutes:0,created_at:'',updated_at:'',template:{id:1,name:'Mixed numbers',instructions:'Solve the five problems and show your thinking.',assignment_type:'practice',subject_id:1,max_points:20,is_exportable:false,is_library:false,is_archived:false,created_by:1,created_at:'',updated_at:''}}
  vi.mocked(assignmentsApi.getStudentAssignment).mockImplementation(async () => work)
  vi.mocked(assignmentsApi.updateStudentAssignment).mockImplementation(async (_, values) => {work={...work,...values} as StudentAssignment;return work})
  vi.mocked(assignmentsApi.getTimeEntries).mockResolvedValue([])
  vi.mocked(lessonsApi.myLesson).mockResolvedValue({id:1,title:'Fractions lesson',date:todayISO(),position:0,status:'taught',templates:[],resources:[{id:1,label:'Your fraction sheet is in the drawer.',position:0}],paperless_materials:[],assignments:[]})
  vi.mocked(lessonsApi.myDay).mockImplementation(async () => ({date:todayISO(),lessons:[],standalone:[{...work,name:'Mixed numbers',help_requested:false},{id:13,template_id:2,student_id:2,name:'Read three facts',status:'not_started',is_graded:false,time_spent_minutes:0,help_requested:false}],earlier:{items:[],total:0},other:{items:[],total:0}}))
})
afterEach(cleanup)
function mount() {
  const router = createMemoryRouter([{path:'/assignments/:assignmentId',element:<StudentActivityWorkspace id={12} />},{path:'/my-lessons/1',element:<p>Lesson destination</p>}],{initialEntries:[`/assignments/12?from=%2Fmy-lessons%2F1&day=${todayISO()}`]})
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RouterProvider router={router} /></QueryClientProvider>)
  return router
}
it('puts directions before working notes, includes lesson resources, and returns to the lesson', async () => {
  const router = mount()
  const directions = await screen.findByRole('heading',{name:'What to do'})
  expect(directions.compareDocumentPosition(screen.getByText('My working notes · Optional')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(await screen.findByText('Your fraction sheet is in the drawer.')).toBeVisible()
  fireEvent.click(screen.getByRole('link',{name:'← Back to your lesson'}))
  await waitFor(() => expect(router.state.location.pathname).toBe('/my-lessons/1'))
})
it('flushes notes before paper submission and offers the next named activity', async () => {
  mount()
  await screen.findByRole('heading',{name:'Mixed numbers'})
  fireEvent.click(screen.getByText('My working notes · Optional'))
  fireEvent.change(screen.getByRole('textbox',{name:'Your notes'}),{target:{value:'I checked each answer.'}})
  fireEvent.click(screen.getByRole('button',{name:'I’m finished'}))
  const dialog = await screen.findByRole('dialog')
  expect(assignmentsApi.updateStudentAssignment).toHaveBeenCalledWith(12,{student_notes:'I checked each answer.'})
  fireEvent.click(within(dialog).getByRole('button',{name:'Ready for my teacher'}))
  expect(await screen.findByText('Saved — ready for your teacher.')).toBeVisible()
  await waitFor(() => expect(assignmentsApi.updateStudentAssignment).toHaveBeenCalledWith(12,{status:'submitted',submission_method:'paper',student_notes:'I checked each answer.'}))
  expect(await screen.findByText('Read three facts')).toBeVisible()
})
it('keeps completion closed and exposes notes when saving fails', async () => {
  vi.mocked(assignmentsApi.updateStudentAssignment).mockRejectedValue(new Error('Could not save while offline'))
  mount()
  await screen.findByRole('heading',{name:'Mixed numbers'})
  fireEvent.click(screen.getByText('My working notes · Optional'))
  fireEvent.change(screen.getByRole('textbox',{name:'Your notes'}),{target:{value:'Keep this draft'}})
  fireEvent.click(screen.getByRole('button',{name:'I’m finished'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save while offline')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('textbox',{name:'Your notes'})).toBeVisible()
})

it('reloads saved notes when returning to an activity with an older cached detail', async () => {
  const router = mount()
  await screen.findByRole('heading', {name:'Mixed numbers'})
  fireEvent.click(screen.getByText('My working notes · Optional'))
  fireEvent.change(screen.getByRole('textbox', {name:'Your notes'}), {target:{value:'Resume at question six'}})
  fireEvent.click(screen.getByRole('link', {name:'← Back to your lesson'}))
  await screen.findByText('Lesson destination')
  await act(async () => { await router.navigate(-1) })
  await screen.findByRole('heading', {name:'Mixed numbers'})
  fireEvent.click(screen.getByText('My working notes · Optional'))
  expect(screen.getByRole('textbox', {name:'Your notes'})).toHaveValue('Resume at question six')
  expect(assignmentsApi.getStudentAssignment).toHaveBeenCalledTimes(2)
})

it('offers a different activity while a missing-material request is pending', async () => {
  work.help_requests = [{ id: 1, assignment_id: 12, note: 'I need a material.', created_at: '2026-11-20' }]
  mount()
  const alternative = await screen.findByRole('region', { name: 'Work on something else' })
  expect(within(alternative).getByRole('link', { name: 'Read three facts' })).toBeVisible()
  expect(screen.getByText('Your teacher has your help request')).toBeVisible()
  expect(screen.getByRole('button', { name: 'I’m finished' })).toBeEnabled()
})
