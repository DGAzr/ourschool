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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { Spinner, useToast, Select, Input, Button } from '../components/ui'
import { subjectsApi } from '../services/subjects'
import { assignmentsApi } from '../services/assignments'
import { api } from '../services/api'
import { Subject, User } from '../types'
import { AssignmentImpact, Lesson } from '../types/lesson'
import { useLessons } from '../hooks/useLessons'
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
import { addDays, isValidISODate } from '../utils/dates'

import { lessonDraft, mergeLessonOrder } from '../utils/lessonChanges'
import Modal from '../components/ui/Modal/Modal'
import PrintPlan from '../components/lessons/PrintPlan'

const DAYS_STORAGE_KEY = 'lessonPlanning.daysShown'

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

  const [rangeStart, setRangeStart] = useCalendarDateParam()
  const [daysShown, setDaysShown] = useState<number>(() => readStoredDays())
  const [skipWeekends, setSkipWeekends] = useState<boolean>(true)

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [drawerLessons, setDrawerLessons] = useState<Lesson[]>([])

  const filterKey = `lessonPlanning.filters.${user?.id}`
  const [filters, setFilters] = useState<{student:string;subject:string}>(() => {
    try {const stored = JSON.parse(localStorage.getItem(filterKey) ?? '{}'); return {student: String(stored?.student ?? ''),subject: String(stored?.subject ?? '')}} catch {return {student:'',subject:''}}
  })
  const [review, setReview] = useState<{title:string;impacts:AssignmentImpact[];resolve:(confirmed:boolean)=>void} | null>(null)
  const [batchDate, setBatchDate] = useState('')
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

  const refreshDrawer = useCallback(async () => {
    const data = await lessonsApi.drawer()
    setDrawerLessons(data || [])
  }, [])

  // Reconcile overdue lessons using the browser's school date, then load the
  // canonical drawer. The operation is idempotent, including StrictMode runs.
  useEffect(() => {
    if (!isAdmin) return
    lessonsApi
      .rollover(todayISO())
      .then((result) => {
        setDrawerLessons(result.lessons || [])
        result.warnings.forEach((warning) => toast(warning, 'danger'))
        if (result.moved_count > 0) {
          toast(`${result.moved_count} lesson${result.moved_count === 1 ? '' : 's'} moved to the drawer. Assigned work was kept.`)
          void refetch()
        }
      })
      .catch(() => refreshDrawer().catch(() => setDrawerLessons([])))
  }, [isAdmin, refetch, refreshDrawer, toast])

  const matches = (lesson:Lesson) => (!filters.subject || String(lesson.subject_id) === filters.subject) && (!filters.student || lesson.students.some(s=>String(s.id) === filters.student))
  const scopedLessons = lessons.filter(matches)
  const boardDays = includeScheduledDays(days, scopedLessons)
  const scopedDrawer = drawerLessons.filter(matches)
  const readiness = computeReadiness(scopedLessons)
  const confirmImpacts = useCallback(async (sources: Lesson[], destination: string | null, title: string, copy = false, restore = false, selectedStudents:number[]|null=null): Promise<boolean> => {
    const earliest = sources.reduce((min,l)=>l.date && l.date < min ? l.date : min,sources[0]?.date ?? destination ?? todayISO())
    const offset = copy && destination ? Math.round((Date.parse(destination)-Date.parse(earliest))/86400000) : 0
    const impacts = (await Promise.all(sources.map(lesson=>lessonsApi.impact({
      ...lessonDraft(lesson, restore ? lesson.last_scheduled_date ?? null : copy && lesson.date ? addDays(lesson.date,offset) : destination, copy ? offset : undefined),
      ...(copy && selectedStudents!==null ? {student_ids:selectedStudents}:{}),
      lesson_id: copy ? undefined : lesson.id,
    })))).flat()
    return new Promise(resolve=>setReview({title,impacts,resolve}))
  },[])
  const handleBatch = async (sources: Lesson[], action: 'schedule'|'restore_taught'|'copy', destination?:string) => {
    if (sources.length === 0 || copying) return
    setCopying(true)
    try {
      if (!await confirmImpacts(sources,destination ?? null,action === 'copy' ? `Copy ${sources.length} lessons to new instances` : action === 'restore_taught' ? `Mark ${sources.length} lessons taught on their former days` : `Schedule ${sources.length} lessons`,action === 'copy',action === 'restore_taught',copyStudents)) return
      const results = await lessonsApi.batch(sources.map(l=>l.id),action,destination,action==='copy' ? copyStudents??undefined : undefined)
      results.flatMap(r=>r.warnings).forEach(w=>toast(w,'danger'))
      await Promise.all([refetch(),refreshDrawer()])
      toast(`${results.length} lessons ${action === 'copy' ? 'copied. Grades, submissions and work logs were not copied.' : action === 'restore_taught' ? 'restored and marked taught. Published work was kept.' : 'scheduled. Existing work was reused.'}`)
    } catch(err) {toast(getErrorMessage(err,'Could not apply the lesson changes.'),'danger')}
    finally {setCopying(false)}
  }
  const preparePeriod = async (kind: 'day' | 'week', copyingPeriod = false) => {
    if (periodBusy || copying) return
    setPeriodBusy(true)
    try {
      const rows = (await lessonsApi.list({
        start_date: rangeStart,
        end_date: kind === 'week' ? addDays(rangeStart, 6) : rangeStart,
      })).filter(matches)
      if (!rows.length) {
        toast('No lessons in this date and filter scope.')
        return
      }
      if (copyingPeriod) await handleBatch(rows, 'copy', batchDate || addDays(rangeStart, 7))
      else {
        setPrintLessons(rows)
        setTeacherCopy(false)
        setPrinting(kind)
      }
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
      setDrawer(null)
      warnings.forEach((w) => toast(w, 'danger'))
      refetch()
      void refreshDrawer()
    },
    [refetch, refreshDrawer, toast]
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
      <div className="flex flex-wrap items-end gap-3 my-4">
        <Select label="Student filter" value={filters.student} onChange={e=>setFilters({...filters,student:e.target.value})} options={[{value:'',label:'All students'},...students.map(s=>({value:s.id,label:`${s.first_name} ${s.last_name}`}))]} fullWidth={false} />
        <Select label="Subject filter" value={filters.subject} onChange={e=>setFilters({...filters,subject:e.target.value})} options={[{value:'',label:'All subjects'},...subjects.map(s=>({value:s.id,label:s.name}))]} fullWidth={false} />
        <Button variant="outline" onClick={()=>setFilters({student:'',subject:''})}>Clear filters</Button>
        <span className="text-xs text-muted">Plan: {scopedLessons.length}/{lessons.length} · Drawer: {scopedDrawer.length}/{drawerLessons.length}</span>
      </div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Input label="Copy starting on" type="date" value={batchDate || addDays(rangeStart,7)} onChange={e=>setBatchDate(e.target.value)} fullWidth={false} /><details className="text-sm"><summary className="cursor-pointer text-accent">Students for copies · {copyStudents===null?'same as original':copyStudents.length+' selected'}</summary><button type="button" className="text-accent mr-3" onClick={()=>setCopyStudents(null)}>Use original students</button>{students.map(student=><label key={student.id} className="inline-flex items-center gap-1 mr-3"><input type="checkbox" checked={copyStudents?.includes(student.id)??false} onChange={e=>setCopyStudents(previous=>e.target.checked?[...(previous??[]),student.id]:(previous??[]).filter(id=>id!==student.id))}/>{student.first_name}</label>)}</details>
        <Button variant="outline" disabled={copying || !scopedLessons.some(l=>l.date===rangeStart)} onClick={()=>void handleBatch(scopedLessons.filter(l=>l.date===rangeStart),'copy',batchDate || addDays(rangeStart,7))}>Copy day</Button>
        <Button variant="outline" disabled={copying || periodBusy || loading} onClick={()=>void preparePeriod('week',true)}>Copy week</Button>
        <Button variant="outline" onClick={()=>void preparePeriod('day')} disabled={periodBusy || !scopedLessons.some(l=>l.date===rangeStart)}>Print day</Button>
        <Button variant="outline" onClick={()=>void preparePeriod('week')} disabled={periodBusy || loading}>Print week</Button>
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
          onClose={() => setDrawer(null)}
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
