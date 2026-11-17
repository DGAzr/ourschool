import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { lessonsApi } from '../services/lessons'
import { todayISO } from '../utils/dates'

export function useSchoolToday() {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const update = () => setToday(todayISO())
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])
  return today
}

export function useStudentDay(date: string, enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['student-day', user?.id, date],
    queryFn: ({ signal }) => lessonsApi.myDay(date, signal),
    enabled: enabled && user?.role === 'student',
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    throwOnError: false,
  })
}

export function useStudentLesson(id: number | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['student-lesson', user?.id, id],
    queryFn: ({ signal }) => lessonsApi.myLesson(id!, signal),
    enabled: !!id && user?.role === 'student',
    throwOnError: false,
  })
}
