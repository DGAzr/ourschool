import { act, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { useAssignmentFilters } from './useAssignmentFilters'

it('preserves the work tab across rapid search and subject changes', async () => {
  const {result} = renderHook(() => useAssignmentFilters(true), {wrapper:({children}) => <MemoryRouter>{children}</MemoryRouter>})
  act(() => {
    result.current.changeParams(next => next.set('tab','submitted'))
    result.current.setSearchTerm('mixed')
    result.current.setSelectedSubject(3)
  })
  await waitFor(() => expect(result.current.params.get('tab')).toBe('submitted'))
  expect(result.current.searchTerm).toBe('mixed')
  expect(result.current.selectedSubject).toBe(3)
  act(() => { result.current.setSearchTerm(''); result.current.setSelectedSubject(null) })
  expect(result.current.params.get('tab')).toBe('submitted')
  expect(result.current.searchTerm).toBe('')
  expect(result.current.selectedSubject).toBeNull()
})
