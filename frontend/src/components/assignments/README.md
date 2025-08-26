# Assignment Components Refactoring

This directory contains the refactored assignment components that were extracted from the original monolithic `Assignments.tsx` file (now moved to `Assignments-Original.tsx`).

## Structure

### Hooks
- `useAssignments.ts` - Custom hook for managing assignment data and API calls
- `useAssignmentFilters.ts` - Custom hook for managing filter state and filtering logic

### Components
- `AssignmentHeader.tsx` - Header component with view mode toggles and create button
- `AssignmentFilters.tsx` - Filter controls for search, subject, type, and difficulty
- `AssignmentTemplateCard.tsx` - Card component for displaying assignment templates (admin view)
- `StudentAssignmentCard.tsx` - Card component for displaying student assignments
- `CreateTemplateModal.tsx` - Modal for creating new assignment templates

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

The refactored version includes several TODO comments for functionality that needs to be implemented:

1. Edit template functionality
2. Assignment template assignment functionality  
3. Submission modal for student assignments
4. Grading modal and functionality
5. Archive/delete functionality for student assignments

These TODOs represent functionality from the original file that can be added back incrementally as separate components.

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