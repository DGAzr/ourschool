import {render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach,it,expect,vi} from 'vitest'
import QuickReflection from './QuickReflection'
import {journalApi} from '../../services/journal'
vi.mock('../../services/journal',()=>({journalApi:{create:vi.fn()}}))
vi.mock('../../services/api',()=>({getErrorMessage:()=> 'Please try again.'}))
beforeEach(()=>vi.resetAllMocks())
it('saves a one-sentence reflection without requesting a title, tags or goals',async()=>{
  const entry={id:5,title:'My reflection'}
  vi.mocked(journalApi.create).mockResolvedValue(entry as never)
  const saved=vi.fn()
  const {container}=render(<QuickReflection onSaved={saved}/>)
  expect(screen.queryByLabelText('Entry title')).not.toBeInTheDocument()
  expect(container.querySelector('input[type="file"]')).toBeNull()
  await userEvent.type(screen.getByLabelText('One thing about my day'),'I found a frog.')
  await userEvent.click(screen.getByRole('button',{name:'Save reflection'}))
  await waitFor(()=>expect(saved).toHaveBeenCalledWith(entry))
  expect(journalApi.create).toHaveBeenCalledWith(expect.objectContaining({content:'I found a frog.',title:expect.stringMatching(/^My reflection/)}))
})
it('lets a learner save only a mood',async()=>{
  const entry={id:6,title:'My reflection'}
  vi.mocked(journalApi.create).mockResolvedValue(entry as never)
  const saved=vi.fn()
  render(<QuickReflection onSaved={saved}/>)
  expect(screen.getByRole('button',{name:'Save reflection'})).toBeDisabled()
  await userEvent.selectOptions(screen.getByLabelText('How do I feel?'),'proud')
  await userEvent.click(screen.getByRole('button',{name:'Save reflection'}))
  await waitFor(()=>expect(saved).toHaveBeenCalledWith(entry))
  expect(journalApi.create).toHaveBeenCalledWith(expect.objectContaining({mood:'proud',content:'Today I feel proud.'}))
})
it('keeps the learner’s words and mood when saving fails and allows a retry',async()=>{
  const entry={id:7,title:'My reflection'}
  vi.mocked(journalApi.create).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(entry as never)
  const saved=vi.fn()
  render(<QuickReflection onSaved={saved}/>)
  await userEvent.selectOptions(screen.getByLabelText('How do I feel?'),'curious')
  await userEvent.type(screen.getByLabelText('One thing about my day'),'I found a frog.')
  await userEvent.click(screen.getByRole('button',{name:'Save reflection'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again.')
  expect(screen.getByLabelText('One thing about my day')).toHaveValue('I found a frog.')
  expect(screen.getByLabelText('How do I feel?')).toHaveValue('curious')
  expect(saved).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button',{name:'Save reflection'}))
  await waitFor(()=>expect(saved).toHaveBeenCalledWith(entry))
  expect(journalApi.create).toHaveBeenCalledTimes(2)
  expect(screen.getByLabelText('One thing about my day')).toHaveValue('')
})
