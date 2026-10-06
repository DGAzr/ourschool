import { lessonDraft } from '../../utils/lessonChanges'
import { addDays } from '../../utils/dates'
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

import { CSSProperties, useState } from 'react'
import { Plus, SlidersHorizontal, Trash2, X } from 'lucide-react'

import { Button, Drawer, Input, SegmentedControl, TextArea, useToast } from '../ui'
import { AssignmentTemplate, Subject, User } from '../../types'
import {
  AssignmentImpact,
  Lesson,
  LessonCreate,
  LessonMaterialInput,
  LessonResourceInput,
  LessonStatus,
  LessonTemplateLinkInput,
  LessonWriteResponse,
} from '../../types/lesson'
import { lessonsApi } from '../../services/lessons'
import { paperlessApi } from '../../services/paperless'
import { getErrorMessage } from '../../services/api'
import { PaperlessMaterial } from '../../types/paperless'
import { subjectTint, todayISO } from '../../utils/lessonPlanning'
import Modal from '../ui/Modal/Modal'
import { useRecoverableDraft } from '../../hooks/useRecoverableDraft'
import DraftRecovery from '../ui/DraftRecovery'
import StudentAvatars from './StudentAvatars'
import AssignmentComposer from '../assignments/composer/AssignmentComposer'
import TemplateLibraryModal from './TemplateLibraryModal'
import LessonLinkCustomizeModal, { LinkDraft } from './LessonLinkCustomizeModal'
import PaperlessMaterialsSection from './PaperlessMaterialsSection'

interface MaterialDraft {
  label: string
  is_gathered: boolean
}
interface ResourceDraft {
  label: string
  url: string
}

interface LessonEditorProps {
  initialDate: string | null
  lesson: Lesson | null
  subjects: Subject[]
  students: User[]
  onClose: () => void
  onSaved: (warnings: string[]) => void
  onDeleted: (warnings: string[]) => void
}

const formatScheduled = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

/** The right-hand slide-over form for creating or editing a lesson. */
const LessonEditor: React.FC<LessonEditorProps> = ({
  initialDate,
  lesson,
  subjects,
  students,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const { toast } = useToast()
  const isEdit = lesson !== null

  const [date, setDate] = useState(initialDate ?? '')
  const [title, setTitle] = useState(lesson?.title ?? '')
  const [subjectId, setSubjectId] = useState<number | null>(
    lesson?.subject_id ?? null
  )
  const [objective, setObjective] = useState(lesson?.objective ?? '')
  const [durationMinutes, setDurationMinutes] = useState<string>(
    lesson?.duration_minutes ? String(lesson.duration_minutes) : ''
  )
  const [status, setStatus] = useState<LessonStatus>(lesson?.status ?? 'planned')
  const [studentIds, setStudentIds] = useState<number[]>(
    lesson?.students.map((s) => s.id) ?? []
  )
  const [links, setLinks] = useState<LinkDraft[]>(
    (lesson?.templates ?? []).flatMap((l) =>
      l.template
        ? [
            {
              template_id: l.template.id,
              name: l.template.name,
              assignment_type: l.template.assignment_type,
              max_points: l.template.max_points,
              assignment_timing: l.assignment_timing ?? 'on_schedule',
              due_offset_days: l.due_offset_days ?? 0,
              custom_due_date: l.custom_due_date ?? null,
              custom_max_points: l.custom_max_points ?? null,
              custom_instructions: l.custom_instructions ?? null,
            },
          ]
        : []
    )
  )
  const [materials, setMaterials] = useState<MaterialDraft[]>(
    lesson?.materials.map((m) => ({ label: m.label, is_gathered: m.is_gathered })) ??
      []
  )
  const [resources, setResources] = useState<ResourceDraft[]>(
    lesson?.resources.map((r) => ({ label: r.label, url: r.url ?? '' })) ?? []
  )
  const [notes, setNotes] = useState(lesson?.notes ?? '')
  // Create mode only: Paperless picks buffered until the lesson exists
  // (attachments need a lesson id, so they're written right after create).
  const [pendingPaperless, setPendingPaperless] = useState<PaperlessMaterial[]>(
    []
  )

  const [newMaterial, setNewMaterial] = useState('')
  const [newResourceLabel, setNewResourceLabel] = useState('')
  const [newResourceUrl, setNewResourceUrl] = useState('')

  const [libraryOpen, setLibraryOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [customizingIndex, setCustomizingIndex] = useState<number | null>(null)
  const [review, setReview] = useState<{payload: LessonCreate; impacts: AssignmentImpact[]; deleting: boolean} | null>(null)
  const [saving, setSaving] = useState(false)

  const recoverable = useRecoverableDraft(`lesson.${lesson?.id ?? `new.${initialDate ?? 'drawer'}`}`, {date,title,subjectId,objective,durationMinutes,status,studentIds,links,materials,resources,notes,pendingPaperless}, saved => {
    setDate(saved.date); setTitle(saved.title); setSubjectId(saved.subjectId); setObjective(saved.objective); setDurationMinutes(saved.durationMinutes); setStatus(saved.status); setStudentIds(saved.studentIds); setLinks(saved.links); setMaterials(saved.materials); setResources(saved.resources); setNotes(saved.notes); setPendingPaperless(saved.pendingPaperless)
  })
  const closeEditor = () => recoverable.close(onClose)

  const toggleStudent = (id: number) => {
    setStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const attachTemplate = (template: AssignmentTemplate) => {
    // Ignore a duplicate (the backend rejects duplicate links anyway).
    if (links.some((l) => l.template_id === template.id)) return
    setLinks((prev) => [
      ...prev,
      {
        template_id: template.id,
        name: template.name,
        assignment_type: template.assignment_type,
        max_points: template.max_points,
        custom_due_date: null,
        custom_max_points: null,
        custom_instructions: null,
      },
    ])
    // Pre-fill only empty fields from the template.
    if (!title.trim()) setTitle(template.name)
    if (subjectId === null) setSubjectId(template.subject_id)
    if (!durationMinutes && template.estimated_duration_minutes) {
      setDurationMinutes(String(template.estimated_duration_minutes))
    }
  }

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index))
  }

  const applyCustomize = (index: number, patch: Partial<LinkDraft>) => {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const linkIsCustomized = (l: LinkDraft): boolean =>
    l.custom_due_date != null ||
    l.custom_max_points != null ||
    (l.custom_instructions ?? '') !== ''

  const addMaterial = () => {
    const label = newMaterial.trim()
    if (!label) return
    setMaterials((prev) => [...prev, { label, is_gathered: false }])
    setNewMaterial('')
  }

  const addResource = () => {
    const label = newResourceLabel.trim()
    if (!label) return
    setResources((prev) => [...prev, { label, url: newResourceUrl.trim() }])
    setNewResourceLabel('')
    setNewResourceUrl('')
  }

  const gatheredCount = materials.filter((m) => m.is_gathered).length

  // Saved lessons key Paperless suggestions off the stored subject; unsaved
  // ones off the picker selection.
  const paperlessSubjectId = (isEdit ? lesson?.subject_id : null) ?? subjectId
  const paperlessSubjectName =
    subjects.find((s) => s.id === paperlessSubjectId)?.name ?? null

  const handleSave = async () => {
    if (!title.trim()) {
      toast('Give the lesson a title first.', 'danger')
      return
    }
    setSaving(true)
    const payload: LessonCreate = {
      title: title.trim(),
      date: date || null,
      subject_id: subjectId,
      objective: objective.trim() || null,
      duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      notes: notes.trim() || null,
      status,
      student_ids: studentIds,
      templates: links.map(
        (l): LessonTemplateLinkInput => ({
          template_id: l.template_id,
          assignment_timing: l.assignment_timing ?? 'on_schedule',
          due_offset_days: l.due_offset_days ?? 0,
          custom_due_date: l.custom_due_date ?? null,
          custom_max_points: l.custom_max_points ?? null,
          custom_instructions: l.custom_instructions ?? null,
        })
      ),
      materials: materials.map(
        (m): LessonMaterialInput => ({
          label: m.label,
          is_gathered: m.is_gathered,
        })
      ),
      resources: resources.map(
        (r): LessonResourceInput => ({
          label: r.label,
          url: r.url || null,
        })
      ),
    }
    try {
      const impacts = await lessonsApi.impact({...payload, lesson_id: lesson?.id})
      setReview({payload, impacts, deleting: false})
    } catch (err) {
      toast(getErrorMessage(err, 'Could not review the assignment changes.'), 'danger')
    } finally { setSaving(false) }
  }

  const confirmSave = async () => {
    if (!review) return
    if (review.deleting) { await handleDelete(true); return }
    setSaving(true)
    const payload = review.payload
    try {
      const result: LessonWriteResponse =
        isEdit && lesson
          ? await lessonsApi.update(lesson.id, payload)
          : await lessonsApi.create(payload)
      // Buffered Paperless picks (create mode) attach now that an id exists.
      const warnings = [...result.warnings]
      for (const material of isEdit ? [] : pendingPaperless) {
        try {
          await paperlessApi.attachToLesson(
            result.lesson.id,
            material.document_id
          )
        } catch {
          warnings.push(`Could not attach "${material.title}" from Paperless.`)
        }
      }
      toast(
        isEdit ? 'Lesson updated.' : date ? 'Lesson planned.' : 'Lesson saved to the drawer.',
        'default'
      )
      recoverable.clear()
      onSaved(warnings)
    } catch (err) {
      toast(getErrorMessage(err, 'Could not save the lesson.'), 'danger')
      setSaving(false)
    }
  }

  const handleDelete = async (confirmed = false) => {
    if (!lesson) return
    setSaving(true)
    try {
      if (!confirmed) {
        const payload: LessonCreate = {title: lesson.title, date: lesson.date}
        const impacts = await lessonsApi.impact({...payload, lesson_id: lesson.id, deleting: true})
        setReview({payload, impacts, deleting: true})
        setSaving(false)
        return
      }
      const result = await lessonsApi.remove(lesson.id)
      toast('Lesson deleted.', 'default')
      recoverable.clear()
      onDeleted(result.warnings)
    } catch (err) {
      toast(getErrorMessage(err, 'Could not delete the lesson.'), 'danger')
      setSaving(false)
    }
  }

  const [duplicateDate,setDuplicateDate]=useState<string|null>(null)
  const [duplicateImpact,setDuplicateImpact]=useState<AssignmentImpact[]|null>(null)
  const duplicate=async()=>{if(!lesson||!duplicateDate)return;setSaving(true);try{const result=await lessonsApi.batch([lesson.id],'copy',duplicateDate,studentIds);recoverable.clear();onSaved(result.flatMap(r=>r.warnings));toast('Lesson copied to new work. Existing submissions, grades and logs were kept with the original.')}catch(err){toast(getErrorMessage(err,'Could not copy the lesson.'),'danger')}finally{setSaving(false)}}
  const chipBase =
    'px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors'

  return (
    <Drawer
      isOpen
      wide
      onClose={closeEditor}
      title={isEdit ? 'Edit lesson' : date ? 'Plan a lesson' : "Add to Teacher's Drawer"}
      footer={
        <>
          {isEdit && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleDelete()}
              disabled={saving}
              icon={<Trash2 size={14} />}
              className="mr-auto"
            >
              Delete
            </Button>
          )}
          {lesson&&<Button variant="outline" size="sm" disabled={saving} onClick={()=>{setDuplicateDate(addDays(lesson.date??todayISO(),7));setDuplicateImpact(null)}}>Duplicate lesson</Button>}
          <Button variant="outline" size="sm" onClick={closeEditor} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
            Review changes
          </Button>
        </>
      }
    >
      {duplicateDate&&lesson&&<Modal isOpen title="Duplicate lesson" onClose={()=>setDuplicateDate(null)} footer={<Button loading={saving} onClick={async()=>{if(duplicateImpact){await duplicate();return}setSaving(true);try{const offset=Math.round((Date.parse(duplicateDate)-Date.parse(lesson.date??duplicateDate))/86400000);setDuplicateImpact(await lessonsApi.impact({...lessonDraft(lesson,duplicateDate,offset),student_ids:studentIds}))}catch(err){toast(getErrorMessage(err,'Could not review the copy.'),'danger')}finally{setSaving(false)}}}>{duplicateImpact?'Create new lesson and work':'Review new assignments'}</Button>}><Input label="New lesson date" type="date" value={duplicateDate} onChange={e=>{setDuplicateDate(e.target.value);setDuplicateImpact(null)}}/><p className="text-sm mt-3">Uses the students selected in this editor. Copies the saved lesson plan; unsaved edits, grades, submissions and logs are excluded. The original work stays intact.</p>{duplicateImpact&&<ul className="text-sm mt-3 space-y-2">{duplicateImpact.map((impact,index)=><li key={index}>{impact.student_name}: {impact.action} · {impact.explanation}</li>)}</ul>}</Modal>}
      {review && <Modal isOpen onClose={() => setReview(null)} title={review.deleting ? 'Review lesson deletion' : 'Review assignment changes'} footer={<><Button variant="outline" onClick={() => setReview(null)} disabled={saving}>Back to editing</Button><Button variant={review.deleting ? 'danger' : 'primary'} onClick={confirmSave} loading={saving}>{review.deleting ? 'Delete lesson' : 'Save lesson'}</Button></>}>
        <p className="text-sm text-muted mb-3">{review.deleting ? 'The lesson will be removed.' : 'The lesson and its activities will be saved.'} Published work survives drawer moves. Changes reflect the records currently saved.</p>
        {review.impacts.length === 0 && <p>No student assignments affected.</p>}
        <ul className="space-y-3">{review.impacts.map((impact, i) => <li key={i} className="border border-line rounded-lg p-3 text-sm"><strong className="capitalize">{impact.action}</strong> · {impact.student_name} · {impact.template_name}<div>{impact.due_date ? `Due ${formatScheduled(impact.due_date)}` : 'No deadline'} · {impact.explanation}</div></li>)}</ul>
      </Modal>}
      <DraftRecovery closing={recoverable.pendingClose !== null} onConfirmClose={recoverable.confirmClose} onCancelClose={recoverable.cancelClose} available={recoverable.recovery !== null} dirty={recoverable.dirty} storageError={recoverable.storageError} onResume={recoverable.resume} onDiscard={recoverable.discard} />
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 items-end">
          <Input
            label="Date (optional)"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            helperText="Leave blank to keep this lesson in the Teacher's Drawer."
          />
          <p className="text-[12.5px] text-muted pb-2.5 truncate">
            {date ? formatScheduled(date) : "Unscheduled · Teacher's Drawer"}
            {isEdit && date !== lesson?.date ? (
              <span className="text-accent"> · rescheduling</span>
            ) : null}
          </p>
        </div>

        {/* Subject chips */}
        <div>
          <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
            Subject
          </label>
          <div className="flex flex-wrap gap-2">
            {subjects.map((subject) => {
              const active = subjectId === subject.id
              const tint = subjectTint(subject.color) as CSSProperties
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() =>
                    setSubjectId(active ? null : subject.id)
                  }
                  style={
                    active
                      ? {
                          ...tint,
                          backgroundColor: 'var(--subject-soft)',
                          borderColor: 'var(--subject-line)',
                          color: 'var(--subject-ink)',
                        }
                      : undefined
                  }
                  className={`${chipBase} ${
                    active ? '' : 'border-line bg-panel text-muted hover:text-ink'
                  }`}
                >
                  {subject.name}
                </button>
              )
            })}
          </div>
        </div>

        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Adding fractions"
        />

        <TextArea
          label="Objective"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="What should students walk away understanding?"
          rows={2}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Duration (min)"
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder="45"
          />
          <div>
            <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
              Status
            </label>
            <SegmentedControl<LessonStatus>
              segments={[
                { value: 'planned' as const, label: 'Planning' },
                { value: 'ready' as const, label: 'Ready' },
                { value: 'taught' as const, label: 'Taught' },
              ]}
              value={status}
              onChange={setStatus}
            />
          </div>
        </div>

        {/* Students */}
        <div>
          <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
            Students
          </label>
          <div className="flex flex-wrap gap-2">
            {students.map((student) => {
              const active = studentIds.includes(student.id)
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => toggleStudent(student.id)}
                  className={`${chipBase} inline-flex items-center gap-1.5 pl-1.5 ${
                    active
                      ? 'border-accent-line bg-accent-soft text-ink'
                      : 'border-line bg-panel text-muted hover:text-ink'
                  }`}
                >
                  <StudentAvatars
                    students={[
                      {
                        id: student.id,
                        first_name: student.first_name,
                        last_name: student.last_name,
                        username: student.username,
                      },
                    ]}
                    size={18}
                  />
                  {student.first_name}
                </button>
              )
            })}
            {students.length === 0 && (
              <span className="text-[12.5px] text-faint">No students yet.</span>
            )}
          </div>
        </div>

        {/* Linked assignments (multiple) */}
        <div>
          <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
            Linked assignments
          </label>
          <div className="flex flex-col gap-2">
            {links.map((link, idx) => (
              <div
                key={link.template_id}
                className="flex items-center gap-2 border border-line rounded-[10px] px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-ink break-words">
                    {link.name}
                  </div>
                  <div className="text-[11.5px] text-muted">
                    <span>{link.assignment_timing === 'draft' ? 'Draft' : link.assignment_timing === 'now' ? 'Assign now' : 'Assign when scheduled'}</span> · <span className="uppercase">{link.assignment_type}</span> ·{' '}
                    {link.custom_max_points ?? link.max_points} pts
                    {link.custom_due_date ? (
                      <span> · due {link.custom_due_date}</span>
                    ) : null}
                    {linkIsCustomized(link) ? (
                      <span className="text-accent"> · customized</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomizingIndex(idx)}
                  aria-label="Customize this assignment"
                  title="Customize"
                  className="text-muted hover:text-accent transition-colors"
                >
                  <SlidersHorizontal size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => removeLink(idx)}
                  aria-label="Remove linked template"
                  className="text-muted hover:text-danger transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="w-full py-2.5 rounded-[10px] border border-dashed border-btn-border text-[12.5px] font-semibold text-faint hover:text-ink hover:border-faint transition-colors"
            >
              ＋ Link from your template library
            </button>
          </div>
          {links.length > 0 && (
            <p className="text-[11.5px] text-muted mt-1.5">
              {date
                ? "Published activities create or reuse assignments for the selected students. Draft activities wait. Due dates follow each activity’s policy; submitted and graded work keeps its dates."
                : "Draft activities wait in the drawer. Activities set to Assign now are available immediately, with no deadline unless customized. Previously assigned work keeps its due dates."}
            </p>
          )}
        </div>

        {/* Materials from Paperless — write-through on a saved lesson;
            buffered locally in create mode and attached on save. Renders
            nothing when the integration isn't connected. */}
        {isEdit && lesson ? (
          <PaperlessMaterialsSection
            lesson={lesson}
            subjectName={paperlessSubjectName}
          />
        ) : (
          <PaperlessMaterialsSection
            pendingMaterials={pendingPaperless}
            onPendingChange={setPendingPaperless}
            subjectId={subjectId}
            subjectName={paperlessSubjectName}
          />
        )}

        {/* Materials */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[12px] font-semibold text-faint uppercase tracking-wide">
              Materials
            </label>
            {materials.length > 0 && (
              <span className="text-[11.5px] text-muted">
                {gatheredCount} of {materials.length} gathered
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {materials.map((material, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Gathered ${material.label}`}
                  checked={material.is_gathered}
                  onChange={(e) =>
                    setMaterials((prev) =>
                      prev.map((m, i) =>
                        i === idx ? { ...m, is_gathered: e.target.checked } : m
                      )
                    )
                  }
                  className="accent-pos"
                />
                <span
                  className={`flex-1 text-[13px] ${
                    material.is_gathered
                      ? 'line-through text-faint'
                      : 'text-ink'
                  }`}
                >
                  {material.label}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setMaterials((prev) => prev.filter((_, i) => i !== idx))
                  }
                  aria-label="Remove material"
                  className="text-faint hover:text-danger"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              label="New material"
              value={newMaterial}
              onChange={(e) => setNewMaterial(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addMaterial()
                }
              }}
              placeholder="Add a material…"
            />
            <Button variant="outline" size="sm" onClick={addMaterial} icon={<Plus size={14} />}>
              Add
            </Button>
          </div>
        </div>

        {/* Resources */}
        <div>
          <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
            Resource links
          </label>
          <div className="flex flex-col gap-1.5">
            {resources.map((resource, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="flex-1 text-[13px] text-ink truncate">
                  {resource.label}
                  {resource.url ? (
                    <span className="text-faint"> — {resource.url}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setResources((prev) => prev.filter((_, i) => i !== idx))
                  }
                  aria-label="Remove resource"
                  className="text-faint hover:text-danger"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <Input
              label="Resource name"
              value={newResourceLabel}
              onChange={(e) => setNewResourceLabel(e.target.value)}
              placeholder="Resource label"
            />
            <div className="flex gap-2">
              <Input
                label="Resource URL"
                value={newResourceUrl}
                onChange={(e) => setNewResourceUrl(e.target.value)}
                placeholder="https://…"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addResource}
                icon={<Plus size={14} />}
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        <TextArea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything to remember while teaching…"
          helperText="Markdown supported — formatting renders in Teach."
          rows={2}
        />
      </div>

      <TemplateLibraryModal
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        subjects={subjects}
        subjectId={subjectId}
        excludeTemplateIds={links.map((l) => l.template_id)}
        onAttach={attachTemplate}
        onCreateNew={() => {
          setLibraryOpen(false)
          setComposerOpen(true)
        }}
      />

      {composerOpen && (
        <AssignmentComposer
          mode={{
            kind: 'create',
            showAssign: false,
            libraryDefault: false,
            prefill: {
              subject_id: subjectId,
              assigned_date: date || initialDate || todayISO(),
            },
          }}
          subjects={subjects}
          students={students}
          onClose={() => setComposerOpen(false)}
          onSuccess={(result) => {
            setComposerOpen(false)
            if (result) attachTemplate(result.template)
          }}
        />
      )}

      {customizingIndex !== null && links[customizingIndex] && (
        <LessonLinkCustomizeModal
          link={links[customizingIndex]}
          lessonDate={date}
          onClose={() => setCustomizingIndex(null)}
          onSave={(patch) => applyCustomize(customizingIndex, patch)}
        />
      )}
    </Drawer>
  )
}

export default LessonEditor
