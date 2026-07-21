# Assignment Components

This directory contains the components, hooks, and pure-logic helpers that make up
the assignment surface (templates, student assignments, the composer, and grading).

## Structure

### Composer (`composer/`)
- `AssignmentComposer.tsx` - The single create/assign surface. Drives both "create a
  reusable template" (Save to library) and "assign to students" from one drawer.
- `AssignmentOverridesFields.tsx` - Shared per-student override fields (due date,
  points, etc.) used when assigning.
- `composerLogic.ts` / `composerLogic.test.ts` - Pure logic for composer mode,
  draft state, and payload building.

### Shared form pieces (`shared/`)
- `AssignmentFormFields.tsx` - Common template/assignment field inputs.
- `AssignmentFormError.tsx` - Inline form error display.
- `index.ts` - Re-exports the shared form components.

### Cards & views
- `AssignmentInfo.tsx` - Read-only assignment info + `SubmissionCard` display.
- `StudentAssignmentCard.tsx` - Card for a student's assignment (status, grade display).
- `StudentAssignmentsView.tsx` - Student-facing list of assignments.

### Grading
- `GradeForm.tsx` - The only grading UI. Real validation, points-based input
  (letter grade is display-only, derived from the score).
- `gradeFormLogic.ts` / `gradeFormLogic.test.ts` - Pure grading validation/derivation logic.

### Materials
- `PaperlessMaterialsPicker.tsx` - Picker for attaching Paperless documents.
- `assignmentMaterialsLogic.ts` / `assignmentMaterialsLogic.test.ts` - Materials
  selection logic.

### Modals & dialogs
- `AssignmentDetailModal.tsx` - Detail view for a single assignment.
- `SubmissionDialog.tsx` - Student submission dialog.
- `ImportAssignmentModal.tsx` / `ExportAssignmentModal.tsx` - Import/export flows.

## Related shared UI

- `components/ui/ActionMenu.tsx` - The shared action menu (reopen, archive, excuse,
  unassign, etc.) used by the assignments and grading surfaces.

## Conventions

1. **One create/assign surface** - all template creation and assignment goes through
   `AssignmentComposer`; there are no separate quick-assign/template modals.
2. **Points in, letter out** - grading takes a numeric score; any letter grade shown
   is derived for display only (`utils/grading`, `gradeFormLogic`).
3. **Pure logic is testable** - `*Logic.ts` files hold framework-free logic with
   colocated `*.test.ts` unit tests.

## Usage

```typescript
import AssignmentComposer from '../components/assignments/composer/AssignmentComposer'
import { AssignmentInfo } from '../components/assignments/AssignmentInfo'
```
