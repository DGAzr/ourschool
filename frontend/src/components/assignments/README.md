# Assignment Components Refactoring

This directory contains the refactored assignment components that were extracted from the original monolithic `Assignments.tsx` file (now moved to `Assignments-Original.tsx`).

## Structure

### Hooks
- `useAssignments.ts` - Custom hook for managing assignment data and API calls
- `useAssignmentFilters.ts` - Custom hook for managing filter state and filtering logic

### Components
- `AssignmentHeader.tsx` - Header component with view mode toggles, create button, quick-assign button, and pending grades count
- `AssignmentFilters.tsx` - Filter controls for search, subject, type, and difficulty
- `AssignmentTemplateCard.tsx` - Card component for displaying assignment templates (admin view)
- `StudentAssignmentCard.tsx` - Card component for displaying student assignments
- `CreateTemplateModal.tsx` - Modal for creating new assignment templates
- `EditTemplateModal.tsx` - Modal for editing existing assignment templates
- `QuickAssignModal.tsx` - Modal for rapid template creation with immediate assignment to students
- `InlineGradeForm.tsx` - Inline grading form for grading assignments without opening a modal
- `GradingAssignmentsTable.tsx` - Table view for grading multiple student assignments

### Main Component
- `Assignments.tsx` - Refactored main component (reduced from 2000+ lines to ~300 lines)

## Benefits of Refactoring

1. **Reduced Complexity**: Main component went from 2000+ lines to ~300 lines
2. **Separation of Concerns**: Each component has a single responsibility
3. **Reusability**: Components and hooks can be reused in other parts of the application
4. **Maintainability**: Easier to understand, test, and modify individual pieces
5. **Type Safety**: Better TypeScript support with focused interfaces
6. **Testing**: Smaller components are easier to unit test

## TODO Items

The refactored version has addressed several items from the original monolithic file:

### Completed
- ✅ Edit template functionality (`EditTemplateModal.tsx`)
- ✅ Assignment template assignment functionality (`QuickAssignModal.tsx`)
- ✅ Grading functionality (`InlineGradeForm.tsx`, `GradingAssignmentsTable.tsx`)

### Still Pending
1. Submission modal for student assignments
2. Archive/delete functionality for student assignments
3. Bulk export improvements

## Usage

Import components from the index file:

```typescript
import { AssignmentHeader, AssignmentFilters, CreateTemplateModal } from '../components/assignments'
```

Or import individually:

```typescript
import AssignmentHeader from '../components/assignments/AssignmentHeader'
```

## File Size Comparison

- **Original**: `Assignments.tsx` - 2000+ lines
- **Refactored**: `Assignments.tsx` - ~300 lines
- **Total components**: ~1000 lines across multiple focused files
- **Net reduction**: 50% fewer lines with better organization