import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, AuthContextType } from '../contexts/AuthContext'
import { useRecoverableDraft } from './useRecoverableDraft'
const wrapper=({children}: {children:React.ReactNode})=><AuthContext.Provider value={{user:{id:7}} as AuthContextType}>{children}</AuthContext.Provider>
beforeEach(()=>localStorage.clear())
describe('local form recovery',()=>{
  it('saves changes locally and resumes only when requested',()=>{
    const restore=vi.fn()
    const first=renderHook(({value})=>useRecoverableDraft('lesson.4',value,restore),{wrapper,initialProps:{value:{title:'Saved'}}})
    first.rerender({value:{title:'Unsaved draft'}})
    expect(localStorage.getItem('ourschool.draft.7.lesson.4')).toContain('Unsaved draft')
    first.unmount()
    const reopened=renderHook(()=>useRecoverableDraft('lesson.4',{title:'Saved'},restore),{wrapper})
    expect(restore).not.toHaveBeenCalled()
    act(()=>reopened.result.current.resume())
    expect(restore).toHaveBeenCalledWith({title:'Unsaved draft'})
    act(()=>reopened.result.current.clear())
    expect(localStorage.getItem('ourschool.draft.7.lesson.4')).toBeNull()
  })
  it('keeps a changed form open until its in-app leave action is confirmed',()=>{
    const closed=vi.fn()
    const confirm=vi.spyOn(window,'confirm')
    const form=renderHook(({value})=>useRecoverableDraft('lesson.4',value,vi.fn()),{wrapper,initialProps:{value:{title:'Saved'}}})
    form.rerender({value:{title:'Changed'}})
    act(()=>form.result.current.close(closed))
    expect(closed).not.toHaveBeenCalled()
    expect(form.result.current.pendingClose).not.toBeNull()
    act(()=>form.result.current.cancelClose())
    expect(closed).not.toHaveBeenCalled()
    act(()=>form.result.current.close(closed))
    act(()=>form.result.current.confirmClose())
    expect(closed).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
    confirm.mockRestore()
  })
  it('does not expose another account draft' ,()=>{
    localStorage.setItem('ourschool.draft.99.lesson.4',JSON.stringify({value:{title:'Private'}}))
    const result=renderHook(()=>useRecoverableDraft('lesson.4',{title:'Saved'},vi.fn()),{wrapper})
    expect(result.result.current.recovery).toBeNull()
  })
})
