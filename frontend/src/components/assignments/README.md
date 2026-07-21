# Assignment Components

Reusable assignment dialogs, cards, and form primitives used by the
Assignments, Templates, Grading, and Dashboard pages.

## Structure

- `AssignmentDetailModal.tsx` — read-only assignment and submission details.
- `StudentAssignmentCard.tsx` — responsive student-assignment summary card.
- `SubmissionDialog.tsx` — student submission workflow.
- `GradeAssignmentModal.tsx` — administrator grading workflow.
- `CreateTemplateModal.tsx` / `EditTemplateModal.tsx` — template forms.
- `AssignTemplateModal.tsx` / `QuickAssignModal.tsx` — assignment creation.
- `ExportAssignmentModal.tsx` / `ImportAssignmentModal.tsx` — portable
  template transfer.
- `shared/` — modal shell, form fields, footer, error display, and shared form
  state.

Page-level data loading and filtering live in `frontend/src/hooks/`:

- `useAssignments.ts` loads templates, assignments, students, subjects, and
  assignment types for the current page mode.
- `useAssignmentFilters.ts` owns shared search and filter state.

## Usage

Most components are default exports and are imported directly:

```typescript
import StudentAssignmentCard from '../components/assignments/StudentAssignmentCard'
import SubmissionDialog from '../components/assignments/SubmissionDialog'
```

The shared form primitives have a barrel export:

```typescript
import { AssignmentModalBase, AssignmentFormFields } from './shared'
```

Keep API calls in `frontend/src/services/assignments.ts`, domain types in
`frontend/src/types/assignment.ts`, and page orchestration in
`frontend/src/pages/`. New modal forms should reuse the primitives in
`shared/` so validation and layout remain consistent.
