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

import React, { useState } from 'react'
import { Button, Drawer, Input, Toggle, useToast } from '../../ui'
import { AssignmentFormError, AssignmentFormFields } from '../shared'
import PaperlessMaterialsPicker from '../PaperlessMaterialsPicker'
import AssignmentOverridesFields from './AssignmentOverridesFields'
import {
  ComposerMode,
  initialDraft,
  validateDraft,
  buildComposePayload,
  buildAssignPayload,
  buildTemplateUpdate,
} from './composerLogic'
import { assignmentsApi } from '../../../services/assignments'
import { paperlessApi } from '../../../services/paperless'
import { getErrorMessage } from '../../../services/api'
import { AssignmentComposeResponse, Subject, User } from '../../../types'
import { PaperlessMaterial } from '../../../types/paperless'

import { useRecoverableDraft } from '../../../hooks/useRecoverableDraft'
import DraftRecovery from '../../ui/DraftRecovery'

interface AssignmentComposerProps {
  mode: ComposerMode
  subjects: Subject[]
  students: User[]
  onClose: () => void
  onSuccess: (result?: AssignmentComposeResponse) => void
}

const TITLES = {
  create: 'New assignment',
  assign: 'Assign to students',
  edit: 'Edit template',
} as const

/**
 * The single create/assign surface. Modes:
 * - create: full form + optional assign section + "Save to library" toggle
 * - assign: existing template (fields locked) + assign section
 * - edit:   existing template metadata only (no assign section)
 */
const AssignmentComposer: React.FC<AssignmentComposerProps> = ({
  mode, subjects, students, onClose, onSuccess,
}) => {
  const { toast } = useToast()
  const [draft, setDraft] = useState(() => initialDraft(mode))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Create mode: Paperless picks buffered until the template exists.
  const [pendingMaterials, setPendingMaterials] = useState<PaperlessMaterial[]>([])

  const [intent, setIntent] = useState<'template' | 'assign'>(mode.kind === 'create' && !mode.showAssign ? 'template' : 'assign')
  const [advanced, setAdvanced] = useState(false)
  const effectiveMode: ComposerMode = mode.kind === 'create' ? {...mode, showAssign: intent === 'assign'} : mode
  const recoverable = useRecoverableDraft(`assignment.${mode.kind}.${mode.kind === 'create' ? 'new' : mode.template.id}`, {draft,pendingMaterials,intent}, saved => { setDraft(saved.draft); setPendingMaterials(saved.pendingMaterials); setIntent(saved.intent) })
  const closeComposer = () => recoverable.close(onClose)
  const showTemplateFields = mode.kind !== 'assign'
  const showAssign = mode.kind === 'assign' || (mode.kind === 'create' && intent === 'assign')
  const showLibraryToggle = mode.kind === 'create'
  const editTemplate = mode.kind === 'edit' ? mode.template : undefined

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft(d => ({ ...d, [key]: value }))

  const toggleStudent = (id: number) =>
    set('student_ids', draft.student_ids.includes(id)
      ? draft.student_ids.filter(s => s !== id)
      : [...draft.student_ids, id])

  const handleSave = async () => {
    const problem = validateDraft(draft, effectiveMode)
    if (problem) { setError(problem); return }
    setSaving(true)
    setError(null)
    try {
      const submittedDraft = mode.kind === 'create' && intent === 'template' ? {...draft, student_ids: [], save_to_library: true} : draft
      if (mode.kind === 'edit') {
        await assignmentsApi.update(mode.template.id, buildTemplateUpdate(draft))
        toast('Template updated.')
        recoverable.clear()
        onSuccess()
      } else if (mode.kind === 'assign') {
        await assignmentsApi.assignToStudents({
          ...buildAssignPayload(draft, mode.template.id),
          paperless_document_ids: pendingMaterials.map(m => m.document_id),
        })
        toast(`Assigned to ${draft.student_ids.length} student${draft.student_ids.length !== 1 ? 's' : ''}.`)
        recoverable.clear()
        onSuccess()
      } else {
        const result = await assignmentsApi.compose(buildComposePayload(submittedDraft))
        const failed: string[] = []
        for (const material of pendingMaterials) {
          try {
            await paperlessApi.attachToTemplate(result.template.id, material.document_id)
          } catch {
            failed.push(material.title)
          }
        }
        if (failed.length > 0) {
          toast(`Created, but ${failed.length} material${failed.length === 1 ? '' : 's'} failed to attach.`, 'danger')
        } else {
          toast(result.created_assignment_ids.length > 0 ? 'Assignment created.' : 'Template created.')
        }
        recoverable.clear()
        onSuccess(result)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save.'))
      setSaving(false)
    }
  }

  const subjectName = subjects.find(s => s.id === draft.subject_id)?.name ?? null

  return (
    <Drawer
      isOpen
      wide
      onClose={closeComposer}
      title={mode.kind === 'create' && intent === 'template' ? 'Create reusable template' : TITLES[mode.kind]}
      subtitle={mode.kind === 'assign' ? `"${mode.template.name}"` : undefined}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={closeComposer} disabled={saving}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
            {mode.kind === 'edit' ? 'Save changes'
              : showAssign && draft.student_ids.length > 0
                ? `Assign to ${draft.student_ids.length} student${draft.student_ids.length !== 1 ? 's' : ''}`
                : mode.kind === 'create' && intent === 'template' ? 'Save template' : 'Create assignment'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <DraftRecovery closing={recoverable.pendingClose !== null} onConfirmClose={recoverable.confirmClose} onCancelClose={recoverable.cancelClose} available={recoverable.recovery !== null} dirty={recoverable.dirty} storageError={recoverable.storageError} onResume={recoverable.resume} onDiscard={recoverable.discard} />
        {mode.kind === 'create' && mode.showAssign && <fieldset><legend className="font-semibold mb-2">What do you want to do?</legend><div className="flex flex-wrap gap-3"><label><input type="radio" name="assignment-intent" checked={intent === 'assign'} onChange={() => setIntent('assign')} /> Assign work to students</label><label><input type="radio" name="assignment-intent" checked={intent === 'template'} onChange={() => setIntent('template')} /> Create a reusable template</label></div><p className="text-xs text-muted mt-1">{intent === 'template' ? 'Save for later. No student work is created.' : 'Students receive their own assignment when you save.'}</p></fieldset>}
        <AssignmentFormError error={error} />

        {showTemplateFields ? (
          <AssignmentFormFields
            formData={draft}
            subjects={subjects}
            onUpdate={(field, value) => set(field as keyof typeof draft, value as never)}
            showAllFields={advanced}
            disabled={saving}
          />
        ) : (
          /* Assign mode: read-only template summary (fields are locked). */
          <div className="border border-line rounded-[11px] px-4 py-3">
            <div className="text-[13.5px] font-semibold text-ink">{draft.name}</div>
            <div className="text-[11.5px] text-muted flex flex-wrap gap-x-2 mt-0.5">
              <span>{subjectName}</span>
              <span className="uppercase">{draft.assignment_type}</span>
              <span className="font-mono">{draft.max_points} pts</span>
              {draft.estimated_duration_minutes ? (
                <span className="font-mono">{draft.estimated_duration_minutes}m</span>
              ) : null}
            </div>
          </div>
        )}

        {showTemplateFields && <button type="button" className="text-accent text-sm text-left" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>{advanced ? 'Hide optional template details' : 'Show optional template details'}</button>}
        <PaperlessMaterialsPicker
          template={editTemplate}
          pendingMaterials={editTemplate ? undefined : pendingMaterials}
          onPendingChange={editTemplate ? undefined : setPendingMaterials}
          pendingSuccessMessage={count =>
            `Added ${count} material${count === 1 ? '' : 's'} — they'll attach when you save`}
          excludeDocumentIds={
            mode.kind === 'assign'
              ? (mode.template.paperless_materials ?? []).map(m => m.document_id)
              : undefined
          }
          hint={
            mode.kind === 'assign'
              ? "attached to every assignment created below, on top of the template's own materials"
              : undefined
          }
          subjectId={draft.subject_id || null}
          subjectName={subjectName}
        />

        {showAssign && (
          <>
            <div>
              <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
                Students {draft.student_ids.length > 0 && `(${draft.student_ids.length} selected)`}
              </label>
              <div className="border border-field-border rounded-field overflow-hidden max-h-44 overflow-y-auto divide-y divide-line">
                {students.length === 0 ? (
                  <p className="px-3 py-2.5 text-[13px] text-faint">No students found</p>
                ) : students.map(student => (
                  <label key={student.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-track transition-colors">
                    <input
                      type="checkbox"
                      checked={draft.student_ids.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      className="w-4 h-4 rounded accent-[var(--accent)]"
                      disabled={saving}
                    />
                    <span className="text-[13.5px] text-ink">{student.first_name} {student.last_name}</span>
                  </label>
                ))}
              </div>
            </div>

            <Input
              label="Assigned date"
              type="date"
              value={draft.assigned_date}
              onChange={e => set('assigned_date', e.target.value)}
            />

            <AssignmentOverridesFields
              dueDate={draft.due_date}
              onDueDate={v => set('due_date', v)}
              maxPoints={draft.custom_max_points}
              onMaxPoints={v => set('custom_max_points', v)}
              instructions={draft.custom_instructions}
              onInstructions={v => set('custom_instructions', v)}
              defaultMaxPoints={draft.max_points}
            />
          </>
        )}

        {showLibraryToggle && (
          <Toggle
            checked={draft.save_to_library}
            onChange={v => set('save_to_library', v)}
            label="Save to library for reuse"
          />
        )}
      </div>
    </Drawer>
  )
}

export default AssignmentComposer
