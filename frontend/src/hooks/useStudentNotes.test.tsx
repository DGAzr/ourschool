import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useStudentNotes } from './useStudentNotes'
import { assignmentsApi } from '../services/assignments'

vi.mock('../services/assignments', () => ({assignmentsApi: {updateStudentAssignment: vi.fn()}}))
beforeEach(() => { sessionStorage.clear(); vi.mocked(assignmentsApi.updateStudentAssignment).mockReset() })
afterEach(cleanup)
function Harness({ initial = '' }: {initial?: string}) {
  const notes = useStudentNotes(12, 2, initial, true)
  return <><textarea aria-label="Notes" value={notes.notes} onChange={e => notes.change(e.target.value)} />
    <button onClick={() => void notes.flush().catch(() => {})}>Save</button>
    {notes.error && <p role="alert">{notes.error}</p>}
    {notes.conflict && <><p>Earlier draft: {notes.conflict.text}</p><button onClick={notes.recover}>Recover draft</button></>}
    <Link to="/next">Leave</Link></>
}
function mount(initial = '') {
  const router = createMemoryRouter([{path:'/',element:<Harness initial={initial} />},{path:'/next',element:<p>Next page</p>}])
  render(<RouterProvider router={router} />)
  return router
}
it('serializes edits made during a save instead of losing the newer text', async () => {
  let first!: (value: never) => void
  vi.mocked(assignmentsApi.updateStudentAssignment).mockImplementationOnce(() => new Promise(resolve => { first = resolve })).mockResolvedValue({} as never)
  mount()
  fireEvent.change(screen.getByRole('textbox'), {target:{value:'First edit'}})
  fireEvent.click(screen.getByText('Save'))
  fireEvent.change(screen.getByRole('textbox'), {target:{value:'Second edit'}})
  await act(async () => { first({} as never) })
  await waitFor(() => expect(assignmentsApi.updateStudentAssignment).toHaveBeenCalledTimes(2))
  expect(vi.mocked(assignmentsApi.updateStudentAssignment).mock.calls.map(call => call[1].student_notes)).toEqual(['First edit','Second edit'])
  expect(sessionStorage.getItem('ourschool.work-draft.2.12')).toBeNull()
})
it('blocks leaving after a failed save and resumes navigation after retry', async () => {
  vi.mocked(assignmentsApi.updateStudentAssignment).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({} as never)
  const router = mount()
  fireEvent.change(screen.getByRole('textbox'), {target:{value:'Do not lose this'}})
  fireEvent.click(screen.getByText('Leave'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
  expect(router.state.location.pathname).toBe('/')
  expect(JSON.parse(sessionStorage.getItem('ourschool.work-draft.2.12')!).text).toBe('Do not lose this')
  fireEvent.click(screen.getByText('Save'))
  await waitFor(() => expect(router.state.location.pathname).toBe('/next'))
})
it('recovers a matching draft and preserves newer server notes until a conflicting draft is chosen', async () => {
  sessionStorage.setItem('ourschool.work-draft.2.12', JSON.stringify({text:'My unfinished text',base:'Old saved notes'}))
  mount('Newer saved notes')
  expect(screen.getByRole('textbox')).toHaveValue('Newer saved notes')
  expect(screen.getByText(/Earlier draft/)).toHaveTextContent('My unfinished text')
  fireEvent.click(screen.getByText('Recover draft'))
  expect(screen.getByRole('textbox')).toHaveValue('My unfinished text')
})
it('warns on closing a tab with unsaved notes and does not load another student draft', () => {
  sessionStorage.setItem('ourschool.work-draft.999.12', JSON.stringify({text:'Other student',base:''}))
  mount()
  expect(screen.getByRole('textbox')).toHaveValue('')
  fireEvent.change(screen.getByRole('textbox'), {target:{value:'Unfinished'}})
  const event = new Event('beforeunload', {cancelable:true})
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
})
