import { settingsApi } from '../services/settings'
/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { Spinner, useToast, Select, Input, Button } from '../components/ui'
import { subjectsApi } from '../services/subjects'
import { assignmentsApi } from '../services/assignments'
import { api } from '../services/api'
import { Subject, User } from '../types'
import { AssignmentImpact, Lesson } from '../types/lesson'
import { useLessons } from '../hooks/useLessons'
import { useLessonRecovery } from '../hooks/useLessonRecovery'
import LessonRecovery from '../components/lessons/LessonRecovery'
import { lessonsApi } from '../services/lessons'
import { getErrorMessage } from '../services/api'
import {
  DEFAULT_DAYS,
  clampDaysShown,
  generateDays,
  includeScheduledDays,
  rangeLabel as formatRangeLabel,
  readiness as computeReadiness,
  stepRange,
  todayISO,
} from '../utils/lessonPlanning'
import PlannerHeader from '../components/lessons/PlannerHeader'
import ReadinessStrip from '../components/lessons/ReadinessStrip'
import LessonBoard from '../components/lessons/LessonBoard'
import LessonEditor from '../components/lessons/LessonEditor'
import {
  calendarDateHref,
  useCalendarDateParam,
} from '../hooks/useCalendarDateParam'
import { formatDateOnly } from '../utils/formatters'
import { addDays, isValidISODate } from '../utils/dates'

import { lessonDraft, mergeLessonOrder } from '../utils/lessonChanges'
import Modal from '../components/ui/Modal/Modal'
import PrintPlan from '../components/lessons/PrintPlan'

const DAYS_STORAGE_KEY = 'lessonPlanning.daysShown'

type CopyPreview = {
  sourceStart: string
  sourceEnd: string
  destinationStart: string
  destinationEnd: string
  lessons: { id: number; title: string; from: string; to: string }[]
}

type DrawerState =
  | { mode: 'create'; date: string | null }
  | { mode: 'edit'; lesson: Lesson }
  | null

const readStoredDays = (): number => {
  const raw = localStorage.getItem(DAYS_STORAGE_KEY)
  if (!raw) return DEFAULT_DAYS
  return clampDaysShown(Number(raw))
}

const LessonPlanningContent: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [rangeStart, setRangeStart] = useCalendarDateParam()
  const [daysShown, setDaysShown] = useState<number>(() => readStoredDays())
  const [skipWeekends, setSkipWeekends] = useState<boolean>(true)

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [drawer, setDrawer] = useState<DrawerState>(() =>
    location.state?.planLesson === true ? { mode: 'create', date: rangeStart } : null
  )
  const closeDrawer = useCallback(() => {
    setDrawer(null)
    if (location.state?.planLesson === true) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
    }
  }, [location.pathname, location.search, location.state, navigate])
  const [drawerFallback, setDrawerFallback] = useState<Lesson[]>()

  const [plannerParams]=useSearchParams()
  const filterKey = `lessonPlanning.filters.${user?.id}`
  const [filters, setFilters] = useState<{student:string;subject:string}>(() => {
    try {const stored = JSON.parse(localStorage.getItem(filterKey) ?? '{}'); return {student: plannerParams.get('student_id') ?? String(stored?.student ?? ''),subject: plannerParams.get('subject_id') ?? String(stored?.subject ?? '')}} catch {return {student:plannerParams.get('student_id')??'',subject:plannerParams.get('subject_id')??''}}
  })
  const [review, setReview] = useState<{title:string;impacts:AssignmentImpact[];copyPreview?:CopyPreview;resolve:(confirmed:boolean)=>void} | null>(null)
  const [batchDate, setBatchDate] = useState('')
  const [planControlsOpen, setPlanControlsOpen] = useState(false)
  const planControlsId = useId()
  const [copyStudents,setCopyStudents]=useState<number[]|null>(null)
  const [copying, setCopying] = useState(false)
  const [printing, setPrinting] = useState<'day'|'week'|null>(null)
  const [printLessons, setPrintLessons] = useState<Lesson[]>([])
  const [periodBusy, setPeriodBusy] = useState(false)
  const [teacherCopy, setTeacherCopy] = useState(false)
  const [schoolName, setSchoolName] = useState('OurSchool')
  const [schoolLogo, setSchoolLogo] = useState('')
  useEffect(() => {try {localStorage.setItem(filterKey,JSON.stringify(filters))} catch { /* Filters still work when device storage is full. */ }},[filterKey,filters])
  useEffect(() => {
    api.get('/settings/school/identity').then((s:{name:string;logo:string|null})=>{setSchoolName(s.name);setSchoolLogo(s.logo??'')}).catch(()=>undefined)
  },[])

  // Persist the chosen day count.
  useEffect(() => {
    localStorage.setItem(DAYS_STORAGE_KEY, String(daysShown))
  }, [daysShown])

  // Load reference data + the org's skip_weekends setting.
  useEffect(() => {
    if (!isAdmin) return
    subjectsApi.getAll().then(setSubjects).catch(() => setSubjects([]))
    assignmentsApi.getStudents().then(setStudents).catch(() => setStudents([]))
    settingsApi
      .getGroupedSettings()
      .then((s) => setSkipWeekends(s.attendance.skip_weekends))
      .catch(() => undefined)
  }, [isAdmin])

  const days = useMemo(
    () => generateDays(rangeStart, daysShown, skipWeekends),
    [rangeStart, daysShown, skipWeekends]
  )

  const startDate = days[0]?.iso ?? rangeStart
  const endDate = days[days.length - 1]?.iso ?? rangeStart

  const { lessons, loading, error, refetch, toggleMaterial } = useLessons({
    startDate,
    endDate,
  })

  const recovery = useLessonRecovery(isAdmin, () => void refetch())
  const { data: recoveryData, load: loadRecovery, error: recoveryError } = recovery

  const drawerLessons = useMemo(
    () => drawerFallback ?? recoveryData?.lessons ?? [],
    [drawerFallback, recoveryData?.lessons]
  )

  const refreshDrawer = useCallback(async () => {
    if (recoveryData?.settings && await loadRecovery(false)) {
      setDrawerFallback(undefined)
    } else {
      setDrawerFallback(await lessonsApi.drawer())
    }
  }, [loadRecovery, recoveryData?.settings])

  useEffect(() => {
    if (recoveryError && !recoveryData) {
      void lessonsApi.drawer().then(setDrawerFallback).catch(() => undefined)
    }
  }, [recoveryData, recoveryError])

  const matches = (lesson:Lesson) => (!filters.subject || String(lesson.subject_id) === filters.subject) && (!filters.student || lesson.students.some(s=>String(s.id) === filters.student))
  const scopedLessons = lessons.filter(matches)
  const boardDays = includeScheduledDays(days, scopedLessons)
  const scopedDrawer = drawerLessons.filter(matches)
  const readiness = computeReadiness(scopedLessons)
  const confirmImpacts = useCallback(async (
    sources: Lesson[],
    destination: string | null,
    title: string,
    options: { copyPreview?: CopyPreview; restore?: boolean; studentIds?: number[] } = {},
  ): Promise<boolean> => {
    const { copyPreview, restore, studentIds } = options
    const offset = copyPreview
      ? (Date.parse(copyPreview.destinationStart) - Date.parse(copyPreview.sourceStart)) / 86400000
      : undefined
    const copyDates = new Map(copyPreview?.lessons.map(lesson => [lesson.id, lesson.to]))
    const impacts = (await Promise.all(sources.map(lesson => lessonsApi.impact({
      ...lessonDraft(lesson, restore ? lesson.last_scheduled_date ?? null : copyDates.get(lesson.id) ?? destination, offset),
      ...(studentIds === undefined ? {} : { student_ids: studentIds }),
      lesson_id: copyPreview ? undefined : lesson.id,
    })))).flat()
    return new Promise(resolve => setReview({ title, impacts, copyPreview, resolve }))
  }, [])

  const handleBatch = async (
    sources: Lesson[],
    action: 'schedule' | 'restore_taught' | 'copy',
    destination?: string,
    copyPreview?: CopyPreview,
  ) => {
    if (sources.length === 0 || copying) return
    setCopying(true)
    const studentIds = action === 'copy' ? copyStudents ?? undefined : undefined
    try {
      const title = action === 'copy' ? `Review ${sources.length} lessons to copy`
        : action === 'restore_taught' ? `Mark ${sources.length} lessons taught on their former days`
        : `Schedule ${sources.length} lessons`
      if (!await confirmImpacts(sources, destination ?? null, title, {
        copyPreview, restore: action === 'restore_taught', studentIds,
      })) return
      const results = await lessonsApi.batch(sources.map(lesson => lesson.id), action, destination, studentIds, copyPreview?.sourceStart)
      results.flatMap(r => r.warnings).forEach(w => toast(w, 'danger'))
      await Promise.all([refetch(), refreshDrawer()])
      toast(`${results.length} lessons ${action === 'copy' ? 'copied.' : action === 'restore_taught' ? 'restored and marked taught. Published work was kept.' : 'scheduled. Existing work was reused.'}`)
    } catch (err) {
      toast(getErrorMessage(err, 'Could not apply the lesson changes.'), 'danger')
    } finally {
      setCopying(false)
    }
  }

  const weekEnd = addDays(rangeStart, 6)
  const copyPlan = async (kind: 'day' | 'week') => {
    if (periodBusy || copying) return
    const sourceEnd = kind === 'week' ? weekEnd : rangeStart
    const destinationStart = batchDate || addDays(rangeStart, 7)
    const offset = (Date.parse(destinationStart) - Date.parse(rangeStart)) / 86400000
    setPeriodBusy(true)
    try {
      const sources = (await lessonsApi.list({ start_date: rangeStart, end_date: sourceEnd })).filter(matches)
      if (!sources.length) {
        toast('No lessons in this date and filter scope.')
        return
      }
      await handleBatch(sources, 'copy', destinationStart, {
        sourceStart: rangeStart,
        sourceEnd,
        destinationStart,
        destinationEnd: addDays(sourceEnd, offset),
        lessons: sources.flatMap(lesson => lesson.date ? [{
          id: lesson.id, title: lesson.title, from: lesson.date, to: addDays(lesson.date, offset),
        }] : []),
      })
    } catch (err) {
      toast(getErrorMessage(err, 'Could not load the lessons to copy.'), 'danger')
    } finally {
      setPeriodBusy(false)
    }
  }

  const preparePeriod = async (kind: 'day' | 'week') => {
    if (periodBusy || copying) return
    setPeriodBusy(true)
    try {
      const rows = (await lessonsApi.list({
        start_date: rangeStart,
        end_date: kind === 'week' ? weekEnd : rangeStart,
      })).filter(matches)
      if (!rows.length) {
        toast('No lessons in this date and filter scope.')
        return
      }
      setPrintLessons(rows)
      setTeacherCopy(false)
      setPrinting(kind)
    } catch (err) {
      toast(getErrorMessage(err, 'Could not load the selected plan.'), 'danger')
    } finally {
      setPeriodBusy(false)
    }
  }
  const rangeLabel = useMemo(() => formatRangeLabel(days), [days])

  const handleStepRange = useCallback(
    (dir: 1 | -1) => {
      setRangeStart(stepRange(rangeStart, daysShown, skipWeekends, dir))
    },
    [daysShown, rangeStart, setRangeStart, skipWeekends]
  )

  const handleStepDays = useCallback((delta: 1 | -1) => {
    setDaysShown((prev) => clampDaysShown(prev + delta))
  }, [])

  const handleAdd = useCallback((dateISO: string) => {
    setDrawer({ mode: 'create', date: dateISO })
  }, [])

  const handleLessonClick = useCallback((lesson: Lesson) => {
    setDrawer({ mode: 'edit', lesson })
  }, [])

  const handleSaved = useCallback(
    (warnings: string[]) => {
      closeDrawer()
      warnings.forEach((w) => toast(w, 'danger'))
      refetch()
      void refreshDrawer()
    },
    [closeDrawer, refetch, refreshDrawer, toast]
  )

  const handleReorder = useCallback(
    async (dateISO: string | null, orderedIds: number[]): Promise<boolean> => {
      try {
        const all = [...lessons,...drawerLessons]
        const moving = all.filter(l=>orderedIds.includes(l.id) && l.date !== dateISO)
        if (dateISO && moving.length && !await confirmImpacts(moving,dateISO,'Review lesson move')) return false
        const result = await lessonsApi.reorder(dateISO, mergeLessonOrder(all,dateISO,orderedIds))
        result.warnings.forEach((warning) => toast(warning, 'danger'))
        await Promise.all([refetch(), refreshDrawer()])
        return true
      } catch (err) {
        toast(getErrorMessage(err, 'Move failed — the change was undone.'), 'danger')
        return false
      }
    },
    [lessons, drawerLessons, confirmImpacts, refetch, refreshDrawer, toast]
  )

  const handleSchedule = useCallback(
    async (lesson: Lesson, dateISO: string): Promise<boolean> => {
      try {
        if (!await confirmImpacts([lesson],dateISO,'Review lesson schedule')) return false
        const result = await lessonsApi.update(lesson.id, { date: dateISO })
        result.warnings.forEach((warning) => toast(warning, 'danger'))
        await Promise.all([refetch(), refreshDrawer()])
        return true
      } catch (err) {
        toast(getErrorMessage(err, 'Scheduling failed — the lesson stayed in the drawer.'), 'danger')
        return false
      }
    },
    [confirmImpacts, refetch, refreshDrawer, toast]
  )

  const handleToggleMaterial = useCallback(
    async (lessonId: number, materialId: number, isGathered: boolean) => {
      const ok = await toggleMaterial(lessonId, materialId, isGathered)
      if (!ok) toast('Could not update the material.', 'danger')
    },
    [toast, toggleMaterial]
  )

  const handleRestoreTaught = useCallback(
    async (lesson: Lesson): Promise<boolean> => {
      if (!lesson.last_scheduled_date) return false
      try {
        const result = await lessonsApi.update(lesson.id, {
          date: lesson.last_scheduled_date,
          status: 'taught',
        })
        result.warnings.forEach((warning) => toast(warning, 'danger'))
        setRangeStart(lesson.last_scheduled_date)
        await Promise.all([refetch(), refreshDrawer()])
        toast('Lesson marked taught on its original day. Assigned work was kept.')
        return true
      } catch (err) {
        toast(getErrorMessage(err, 'Could not restore the lesson. It stayed in the drawer.'), 'danger')
        return false
      }
    },
    [refetch, refreshDrawer, setRangeStart, toast]
  )

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted">
        Lesson planning is available to teachers only.
      </div>
    )
  }

  return (
    <div>
      <PlannerHeader
        rangeLabel={rangeLabel}
        selectedDate={rangeStart}
        daysShown={daysShown}
        skipWeekends={skipWeekends}
        onStepRange={handleStepRange}
        onSelectDate={setRangeStart}
        onStepDays={handleStepDays}
        onPlanLesson={() => handleAdd(rangeStart)}
        onOpenTeach={() => navigate(calendarDateHref('/teach', rangeStart))}
      />
      <LessonRecovery
        data={recoveryData}
        drawerLessons={drawerLessons}
        error={recoveryError}
        showSettings
        onRefresh={async () => {
          if (await loadRecovery(!recoveryData)) setDrawerFallback(undefined)
        }}
        onChanged={() => Promise.all([refetch(), refreshDrawer()])}
      />
      <div className="flex flex-wrap items-end gap-3 my-4">
        <div className="flex max-w-full flex-wrap items-end gap-3">
          <Select label="Student filter" value={filters.student} onChange={e=>setFilters({...filters,student:e.target.value})} options={[{value:'',label:'All students'},...students.map(s=>({value:s.id,label:`${s.first_name} ${s.last_name}`}))]} fullWidth={false} />
          <Select label="Subject filter" value={filters.subject} onChange={e=>setFilters({...filters,subject:e.target.value})} options={[{value:'',label:'All subjects'},...subjects.map(s=>({value:s.id,label:s.name}))]} fullWidth={false} />
          <Button variant="outline" onClick={()=>setFilters({student:'',subject:''})}>Clear filters</Button>
          <span className="text-xs text-muted">Plan: {scopedLessons.length}/{lessons.length} · Drawer: {scopedDrawer.length}/{drawerLessons.length}</span>
        </div>
        <button
          type="button"
          aria-expanded={planControlsOpen}
          aria-controls={planControlsId}
          onClick={() => setPlanControlsOpen(open => !open)}
          className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-field px-2 py-2 text-sm text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          More Plan Controls
          <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${planControlsOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div id={planControlsId} hidden={!planControlsOpen}>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <Input label="Copy starting on" type="date" value={batchDate || addDays(rangeStart,7)} onChange={e=>setBatchDate(e.target.value)} fullWidth={false} /><details className="text-sm"><summary className="cursor-pointer text-accent">Students for copies · {copyStudents===null?'same as original':copyStudents.length+' selected'}</summary><button type="button" className="text-accent mr-3" onClick={()=>setCopyStudents(null)}>Use original students</button>{students.map(student=><label key={student.id} className="inline-flex items-center gap-1 mr-3"><input type="checkbox" checked={copyStudents?.includes(student.id)??false} onChange={e=>setCopyStudents(previous=>e.target.checked?[...(previous??[]),student.id]:(previous??[]).filter(id=>id!==student.id))}/>{student.first_name}</label>)}</details>
          <Button variant="outline" disabled={copying || !scopedLessons.some(l=>l.date===rangeStart)} onClick={() => void copyPlan('day')}>Copy day</Button>
          <Button variant="outline" disabled={copying || periodBusy || loading} onClick={() => void copyPlan('week')}>Copy week</Button>
          <span className="text-xs text-muted w-full">Copy week uses {formatDateOnly(rangeStart)} through {formatDateOnly(weekEnd)}.</span>
          <Button variant="outline" onClick={()=>void preparePeriod('day')} disabled={periodBusy || !scopedLessons.some(l=>l.date===rangeStart)}>Print day</Button>
          <Button variant="outline" onClick={()=>void preparePeriod('week')} disabled={periodBusy || loading}>Print week</Button>
        </div>
      </div>
      <ReadinessStrip readiness={readiness} />
      {boardDays.length > days.length && <p className="text-sm text-muted">Scheduled weekend lessons are also shown so work stays visible.</p>}

      {error && (
        <div className="text-danger text-sm mb-4">{error}</div>
      )}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <LessonBoard
          days={boardDays}
          lessons={scopedLessons}
          drawerLessons={scopedDrawer}
          onBatch={(sources,action,date)=>void handleBatch(sources,action,date)}
          onAdd={handleAdd}
          onLessonClick={handleLessonClick}
          onReorder={handleReorder}
          onSchedule={handleSchedule}
          onRestoreTaught={handleRestoreTaught}
          onToggleMaterial={handleToggleMaterial}
          onAddToDrawer={() => setDrawer({ mode: 'create', date: null })}
        />
      )}

      {review && <Modal isOpen onClose={()=>{review.resolve(false);setReview(null)}} title={review.title} footer={<><Button variant="outline" onClick={()=>{review.resolve(false);setReview(null)}}>Cancel</Button><Button onClick={()=>{review.resolve(true);setReview(null)}}>Apply changes</Button></>}>
        <p className="text-sm text-muted mb-3">Existing work stays attached when moving lessons. Copies start with fresh student work and ungathered materials.</p>
        {review.copyPreview && <div className="mb-4 space-y-2 text-sm">
          <p>Copying {formatDateOnly(review.copyPreview.sourceStart)} through {formatDateOnly(review.copyPreview.sourceEnd)}.</p>
          <p>Destination {formatDateOnly(review.copyPreview.destinationStart)} through {formatDateOnly(review.copyPreview.destinationEnd)}.</p>
          <ul className="space-y-1">
            {review.copyPreview.lessons.map(lesson => <li key={lesson.id}>
              <strong>{lesson.title}</strong> · {formatDateOnly(lesson.from)} → {formatDateOnly(lesson.to)}
            </li>)}
          </ul>
        </div>}
        {review.impacts.length===0 && <p>No assignments affected.</p>}
        <ul className="space-y-2">{review.impacts.map((impact,i)=><li className="text-sm border border-line rounded-lg p-2" key={i}><strong className="capitalize">{impact.action}</strong> · {impact.student_name} · {impact.template_name}<p>{impact.due_date ? `Due ${impact.due_date}` : 'No deadline'} · {impact.explanation}</p></li>)}</ul>
      </Modal>}
      {printing && <><PrintPlan lessons={printLessons} teacherCopy={teacherCopy} schoolName={schoolName} logo={schoolLogo} /><Modal isOpen title="Print learning plan" onClose={()=>setPrinting(null)} footer={<Button onClick={()=>window.print()}>Print</Button>}><p>Prints {printing==='day' ? 'the selected day' : 'seven calendar days from the selected date'}, using the current student and subject filters.</p><label className="block mt-4"><input type="checkbox" checked={teacherCopy} onChange={e=>setTeacherCopy(e.target.checked)} /> Include private teacher notes</label></Modal></>}
      {drawer && (
        <LessonEditor
          key={drawer.mode === 'edit' ? drawer.lesson.id : `create-${drawer.date}`}
          initialDate={drawer.mode === 'create' ? drawer.date : drawer.lesson.date}
          lesson={drawer.mode === 'edit' ? drawer.lesson : null}
          subjects={subjects}
          students={students}
          onClose={closeDrawer}
          initialStudentId={Number(filters.student) || undefined}
          initialSubjectId={Number(filters.subject) || undefined}
          onSaved={handleSaved}
          onDeleted={handleSaved}
        />
      )}
    </div>
  )
}

const LessonPlanning: React.FC = () => {
  const [searchParams] = useSearchParams()
  if (searchParams.get('view') === 'teach') {
    const rawDate = searchParams.get('date')
    const date = isValidISODate(rawDate) ? rawDate : todayISO()
    return <Navigate to={calendarDateHref('/teach', date)} replace />
  }
  return <LessonPlanningContent />
}

export default LessonPlanning
