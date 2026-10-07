import {it,expect} from 'vitest'
import {isSystemBackupFile} from './backup'
it('rejects unsupported and incomplete backup files before restore',()=>{
  const valid={format_version:'2.6',backup_timestamp:'2026-10-04T12:00:00Z',created_by:'Teacher',users:[],subjects:[],terms:[],assignment_templates:[],student_assignments:[]}
  expect(isSystemBackupFile(valid)).toBe(true)
  expect(isSystemBackupFile({...valid,format_version:'2.5'})).toBe(true)
  expect(isSystemBackupFile({...valid,format_version:'2.4'})).toBe(true)
  expect(isSystemBackupFile({...valid,format_version:'999'})).toBe(false)
  expect(isSystemBackupFile({...valid,backup_timestamp:'not a date'})).toBe(false)
  expect(isSystemBackupFile({...valid,student_assignments:undefined})).toBe(false)
})
