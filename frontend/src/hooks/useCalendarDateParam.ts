/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { isValidISODate, todayISO } from '../utils/dates'

/** Build a date-preserving module link while keeping today's URL canonical. */
export const calendarDateHref = (path: string, date: string): string =>
  date === todayISO() ? path : `${path}?date=${encodeURIComponent(date)}`

/**
 * Keep a local calendar date in the ``date`` search parameter. Today is
 * represented by no parameter; invalid values are replaced with that default.
 */
export const useCalendarDateParam = (): [string, (date: string) => void] => {
  const [searchParams, setSearchParams] = useSearchParams()
  const today = todayISO()
  const rawDate = searchParams.get('date')
  const selectedDate = isValidISODate(rawDate) ? rawDate : today

  useEffect(() => {
    if (rawDate === null || (isValidISODate(rawDate) && rawDate !== today)) return
    const next = new URLSearchParams(searchParams)
    next.delete('date')
    setSearchParams(next, { replace: true })
  }, [rawDate, searchParams, setSearchParams, today])

  const setSelectedDate = useCallback(
    (date: string) => {
      const normalized = isValidISODate(date) ? date : today
      if (normalized === selectedDate && !(rawDate && normalized === today)) return
      const next = new URLSearchParams(searchParams)
      if (normalized === today) next.delete('date')
      else next.set('date', normalized)
      setSearchParams(next)
    },
    [rawDate, searchParams, selectedDate, setSearchParams, today]
  )

  return [selectedDate, setSelectedDate]
}
