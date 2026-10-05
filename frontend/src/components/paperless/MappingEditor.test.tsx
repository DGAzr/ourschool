import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TagMapCard from './TagMapCard'
import DoctypeMapCard from './DoctypeMapCard'
import { PaperlessTagMap, PaperlessDoctypeMap } from '../../types/paperless'
import { Subject } from '../../types/subject'

const subjects = [{id:10,name:'Math',color:'#336699'},{id:20,name:'Science'}] as Subject[]
const tags: PaperlessTagMap[] = [
  {paperless_tag_id:1,paperless_tag_name:'Math',subject_id:10,auto_matched:true,configured:false,in_scope:true},
  {paperless_tag_id:2,paperless_tag_name:'Nature',subject_id:null,auto_matched:true,configured:false,in_scope:true},
  {paperless_tag_id:3,paperless_tag_name:'Household',subject_id:null,auto_matched:true,configured:false,in_scope:false},
]
const defaults = {optionsReady:true,disabled:false,onRemap:vi.fn().mockResolvedValue(undefined),onRemove:vi.fn().mockResolvedValue(undefined)}
const types: PaperlessDoctypeMap[] = [
  {paperless_doctype_id:7,paperless_doctype_name:'Worksheet',material_kind:'worksheet',configured:false,in_scope:true},
  {paperless_doctype_id:8,paperless_doctype_name:'Bank statement',material_kind:'other',configured:false,in_scope:false},
]

describe('explicit Paperless mapping blocks',()=>{
  it('starts empty despite automatic classifications and offers only scoped sources',()=>{
    render(<TagMapCard {...defaults} tagMaps={tags} subjects={subjects} />)
    expect(screen.getByText('No mappings added. Automatic classification still applies.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox',{name:'Subject for Math'})).not.toBeInTheDocument()
    const choices = screen.getByRole('combobox',{name:'Tag from Sync Scope'})
    expect(within(choices).getByRole('option',{name:'Math'})).toBeInTheDocument()
    expect(within(choices).queryByRole('option',{name:'Household'})).not.toBeInTheDocument()
  })

  it('adds repeated pairs, excludes configured sources, and saves edits and removals',async()=>{
    const user = userEvent.setup()
    const onRemap = vi.fn().mockResolvedValue(undefined), onRemove = vi.fn().mockResolvedValue(undefined)
    const props = {...defaults,subjects,onRemap,onRemove}
    const view = render(<TagMapCard {...props} tagMaps={tags} />)
    await user.selectOptions(screen.getByRole('combobox',{name:'Tag from Sync Scope'}),'1')
    await user.selectOptions(screen.getByRole('combobox',{name:'Subject'}),'20')
    await user.click(screen.getByRole('button',{name:'Add mapping'}))
    expect(onRemap).toHaveBeenLastCalledWith(1,20)
    const configured = [{...tags[0],subject_id:20,configured:true,auto_matched:false},...tags.slice(1)]
    view.rerender(<TagMapCard {...props} tagMaps={configured} />)
    const sources = screen.getByRole('combobox',{name:'Tag from Sync Scope'})
    expect(within(sources).queryByRole('option',{name:'Math'})).not.toBeInTheDocument()
    await user.selectOptions(sources,'2')
    await user.click(screen.getByRole('button',{name:'Add mapping'}))
    expect(onRemap).toHaveBeenLastCalledWith(2,null)
    await user.selectOptions(screen.getByRole('combobox',{name:'Subject for Math'}),'10')
    expect(onRemap).toHaveBeenLastCalledWith(1,10)
    await user.click(screen.getByRole('button',{name:'Remove mapping for Math'}))
    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it('retains inactive configured rows, blocks editing, and permits removal',async()=>{
    const user = userEvent.setup()
    const onRemove = vi.fn().mockResolvedValue(undefined)
    render(<TagMapCard {...defaults} onRemove={onRemove} subjects={subjects} tagMaps={[{...tags[0],configured:true,in_scope:false}]} />)
    expect(screen.getByText('Outside Sync Scope')).toBeInTheDocument()
    expect(screen.getByRole('combobox',{name:'Subject for Math'})).toBeDisabled()
    await user.click(screen.getByRole('button',{name:'Remove mapping for Math'}))
    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it('disables stale choices until refreshed and discards a source that leaves scope',async()=>{
    const user = userEvent.setup()
    const view = render(<TagMapCard {...defaults} tagMaps={tags} subjects={subjects} />)
    await user.selectOptions(screen.getByRole('combobox',{name:'Tag from Sync Scope'}),'1')
    view.rerender(<TagMapCard {...defaults} tagMaps={tags} subjects={subjects} optionsReady={false} scopeError="Inventory failed" />)
    expect(screen.getByRole('status')).toHaveTextContent('scope sync failed')
    expect(screen.getByRole('combobox',{name:'Tag from Sync Scope'})).toBeDisabled()
    expect(screen.getByRole('button',{name:'Add mapping'})).toBeDisabled()
    view.rerender(<TagMapCard {...defaults} tagMaps={[tags[1]]} subjects={subjects} />)
    expect(screen.getByRole('combobox',{name:'Tag from Sync Scope'})).toHaveValue('')
    expect(screen.getByRole('button',{name:'Add mapping'})).toBeDisabled()
    await user.selectOptions(screen.getByRole('combobox',{name:'Tag from Sync Scope'}),'2')
    expect(screen.getByRole('button',{name:'Add mapping'})).toBeEnabled()
  })

  it('keeps a failed add draft for retry and prevents duplicate submissions',async()=>{
    const user = userEvent.setup()
    let reject!: (reason: Error) => void
    const onRemap = vi.fn().mockImplementationOnce(()=>new Promise<void>((_,fail)=>{reject=fail})).mockResolvedValue(undefined)
    render(<TagMapCard {...defaults} onRemap={onRemap} tagMaps={tags} subjects={subjects} />)
    await user.selectOptions(screen.getByRole('combobox',{name:'Tag from Sync Scope'}),'2')
    await user.selectOptions(screen.getByRole('combobox',{name:'Subject'}),'20')
    await user.dblClick(screen.getByRole('button',{name:'Add mapping'}))
    expect(onRemap).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button',{name:'Add mapping'})).toBeDisabled()
    reject(new Error('Network failed'))
    await waitFor(()=>expect(screen.getByRole('button',{name:'Add mapping'})).toBeEnabled())
    expect(screen.getByRole('combobox',{name:'Tag from Sync Scope'})).toHaveValue('2')
    expect(screen.getByRole('combobox',{name:'Subject'})).toHaveValue('20')
    await user.click(screen.getByRole('button',{name:'Add mapping'}))
    expect(onRemap).toHaveBeenCalledTimes(2)
  })

  it('uses the same compact workflow for document types, including Other',async()=>{
    const user = userEvent.setup()
    const onRemap = vi.fn().mockResolvedValue(undefined)
    render(<DoctypeMapCard {...defaults} onRemap={onRemap} doctypeMaps={types} />)
    const choices = screen.getByRole('combobox',{name:'Document type from Sync Scope'})
    expect(within(choices).queryByRole('option',{name:'Bank statement'})).not.toBeInTheDocument()
    await user.selectOptions(choices,'7')
    await user.selectOptions(screen.getByRole('combobox',{name:'Material kind'}),'other')
    await user.click(screen.getByRole('button',{name:'Add mapping'}))
    expect(onRemap).toHaveBeenCalledWith(7,'other')
  })

  it('shows no huge row list with a large catalogue',()=>{
    const catalogue = Array.from({length:500},(_,i)=>({...tags[0],paperless_tag_id:i+1,paperless_tag_name:`Scoped tag ${i+1}`}))
    render(<TagMapCard {...defaults} tagMaps={catalogue} subjects={subjects} />)
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
    expect(screen.queryByRole('button',{name:/Remove mapping/})).not.toBeInTheDocument()
  })
})
