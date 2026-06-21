# Component Development Guide

This guide provides standards and best practices for creating reusable React components in the OurSchool project.

## 🏗️ Component Architecture

### Component Hierarchy

```
src/components/
├── ui/                    # Basic UI building blocks
│   ├── Button/           # Atomic components
│   ├── Input/
│   ├── Modal/
│   └── Card/
├── layouts/              # Layout components
│   ├── PageLayout/
│   ├── DashboardLayout/
│   └── TablePageLayout/
├── assignments/          # Domain-specific components
│   ├── CreateTemplateModal/
│   ├── EditTemplateModal/
│   ├── AssignmentCard/
│   ├── QuickAssignModal/
│   ├── InlineGradeForm/
│   ├── GradingAssignmentsTable/
│   └── common/           # Shared within domain
└── shared/               # Cross-domain shared components
    ├── LoadingSpinner/
    ├── ErrorBoundary/
    └── ConfirmDialog/
```

### Component Types

#### 1. UI Components (Atomic)
Basic building blocks with no business logic:

```typescript
// components/ui/Button/Button.tsx
/**
 * A flexible button component with multiple variants and states.
 */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  ...props
}) => {
  // Implementation
}
```

#### 2. Layout Components
Provide consistent page structure:

```typescript
// components/layouts/PageLayout/PageLayout.tsx
/**
 * Standard page layout with header, content area, and loading states.
 */
export interface PageLayoutProps {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
  loading?: boolean
  error?: string
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  children,
  actions,
  loading,
  error
}) => {
  // Implementation with error boundary, loading states, etc.
}
```

#### 3. Domain Components
Feature-specific components with business logic:

```typescript
// components/assignments/CreateTemplateModal/CreateTemplateModal.tsx
/**
 * Modal for creating assignment templates with form validation.
 */
export interface CreateTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (template: AssignmentTemplate) => void
  initialData?: Partial<AssignmentTemplateCreate>
}

export const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData
}) => {
  // Business logic, form handling, API calls
}
```

## 📁 File Structure

### Standard Component Structure

```
ComponentName/
├── index.ts              # Clean exports
├── ComponentName.tsx     # Main component
├── ComponentName.types.ts # Type definitions (if complex)
├── ComponentName.test.tsx # Unit tests
└── ComponentName.stories.tsx # Storybook stories (optional)
```

### Example Implementation

```typescript
// components/ui/Button/index.ts
export { default as Button } from './Button'
export type { ButtonProps } from './Button'

// components/ui/Button/Button.tsx
import React from 'react'
import { ButtonProps } from './Button.types'

/**
 * Component documentation here
 */
export const Button: React.FC<ButtonProps> = (props) => {
  // Implementation
}

export default Button

// components/ui/Button/Button.types.ts
export interface ButtonProps {
  // Type definitions
}
```

## 🎨 Styling Guidelines

### Tailwind CSS Best Practices

```typescript
// ✅ Good: Organized class composition
const getButtonClasses = (variant: ButtonVariant, size: ButtonSize) => {
  const baseClasses = [
    'inline-flex items-center justify-center',
    'font-medium rounded-lg transition-all',
    'focus:outline-none focus:ring-2 focus:ring-offset-2'
  ]
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
    danger: 'bg-red-600 hover:bg-red-700 text-white'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }
  
  return [
    ...baseClasses,
    variantClasses[variant],
    sizeClasses[size]
  ].join(' ')
}

// ✅ Use constants for repeated patterns
const CARD_STYLES = {
  base: 'bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700',
  header: 'px-6 py-4 border-b border-gray-200 dark:border-gray-700',
  content: 'px-6 py-4',
  footer: 'px-6 py-4 border-t border-gray-200 dark:border-gray-700'
}
```

### Dark Mode Support

```typescript
// ✅ Always include dark mode variants
className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
className="border-gray-200 dark:border-gray-700"
className="hover:bg-gray-50 dark:hover:bg-gray-700"
```

## 🔧 Component Patterns

### 1. Compound Components

```typescript
// Card with subcomponents
interface CardComponent extends React.FC<CardProps> {
  Header: React.FC<CardHeaderProps>
  Content: React.FC<CardContentProps>
  Footer: React.FC<CardFooterProps>
}

const Card = CardBase as CardComponent
Card.Header = CardHeader
Card.Content = CardContent
Card.Footer = CardFooter

// Usage:
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Content>Content</Card.Content>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

### 2. Render Props Pattern

```typescript
interface DataProviderProps<T> {
  children: (data: {
    items: T[]
    loading: boolean
    error: string | null
    refetch: () => void
  }) => React.ReactNode
}

export const DataProvider = <T,>({ children }: DataProviderProps<T>) => {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const refetch = useCallback(() => {
    // Fetch logic
  }, [])
  
  return children({ items, loading, error, refetch })
}

// Usage:
<DataProvider<User>>
  {({ items: users, loading, error, refetch }) => (
    <UserList users={users} loading={loading} onRefresh={refetch} />
  )}
</DataProvider>
```

### 3. Custom Hooks for Logic

```typescript
// Extract complex logic into custom hooks
export const useAssignmentForm = (initialData?: AssignmentTemplateCreate) => {
  const [formData, setFormData] = useState(initialData || {})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name) newErrors.name = 'Name is required'
    if (!formData.subject_id) newErrors.subject_id = 'Subject is required'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])
  
  const submitForm = useCallback(async () => {
    if (!validateForm()) return false
    
    setIsSubmitting(true)
    try {
      await api.createAssignmentTemplate(formData)
      return true
    } catch (error) {
      setErrors({ submit: 'Failed to create assignment template' })
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validateForm])
  
  return {
    formData,
    setFormData,
    errors,
    isSubmitting,
    validateForm,
    submitForm
  }
}
```

## 📝 Documentation Standards

### Component Documentation Template

```typescript
/**
 * [Component Name] - Brief description of what it does
 * 
 * [Longer description of the component's purpose and key features]
 * 
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <ComponentName 
 *   prop1="value1" 
 *   prop2={value2}
 * >
 *   Content
 * </ComponentName>
 * 
 * // Advanced usage
 * <ComponentName 
 *   prop1="value1"
 *   prop2={value2}
 *   onAction={handleAction}
 * >
 *   <ChildComponent />
 * </ComponentName>
 * ```
 */
export interface ComponentProps {
  /** Description of prop with @default if applicable */
  prop1?: string
  /** Required props should have clear descriptions */
  prop2: number
  /** Event handlers should specify what they receive */
  onAction?: (data: ActionData) => void
  /** Children should specify expected content type */
  children: React.ReactNode
}
```

### Prop Documentation Guidelines

```typescript
interface ButtonProps {
  /** 
   * Visual style variant of the button
   * @default 'primary' 
   */
  variant?: 'primary' | 'secondary' | 'danger'
  
  /** 
   * Size of the button affecting padding and font size
   * @default 'md' 
   */
  size?: 'sm' | 'md' | 'lg'
  
  /** 
   * Shows loading spinner and disables user interaction
   * @default false 
   */
  loading?: boolean
  
  /** 
   * Click handler called when button is pressed
   * Not called when loading or disabled
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  
  /** Content displayed inside the button */
  children: React.ReactNode
}
```

## 🧪 Testing Components

### Testing Principles

1. **Test behavior, not implementation**
2. **Test from the user's perspective**
3. **Mock external dependencies**
4. **Test error states and edge cases**

### Component Test Template

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComponentName } from './ComponentName'

describe('ComponentName', () => {
  // Test default rendering
  it('renders with default props', () => {
    render(<ComponentName>Content</ComponentName>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })
  
  // Test user interactions
  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const mockClick = jest.fn()
    
    render(
      <ComponentName onClick={mockClick}>
        Click me
      </ComponentName>
    )
    
    await user.click(screen.getByRole('button'))
    expect(mockClick).toHaveBeenCalledTimes(1)
  })
  
  // Test different states
  it('shows loading state correctly', () => {
    render(
      <ComponentName loading>
        Button text
      </ComponentName>
    )
    
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })
  
  // Test accessibility
  it('is accessible', () => {
    render(<ComponentName aria-label="Test button">Content</ComponentName>)
    
    const button = screen.getByRole('button', { name: 'Test button' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAccessibleName('Test button')
  })
})
```

## ♿ Accessibility Guidelines

### Essential A11y Practices

```typescript
// ✅ Provide proper semantic markup
<button type="button" aria-label="Close modal" onClick={onClose}>
  <XIcon aria-hidden="true" />
</button>

// ✅ Use proper heading hierarchy
<div>
  <h1>Page Title</h1>
  <section>
    <h2>Section Title</h2>
    <h3>Subsection</h3>
  </section>
</div>

// ✅ Label form inputs properly
<div>
  <label htmlFor="email">Email Address</label>
  <input
    id="email"
    type="email"
    aria-describedby={error ? 'email-error' : undefined}
    aria-invalid={!!error}
  />
  {error && <div id="email-error" role="alert">{error}</div>}
</div>

// ✅ Manage focus properly in modals
const Modal = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus()
    }
  }, [isOpen])
  
  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabIndex={-1}
    >
      {/* Modal content */}
    </div>
  )
}
```

## 🚀 Performance Best Practices

### Optimization Techniques

```typescript
// ✅ Use React.memo for expensive renders
export const ExpensiveComponent = React.memo<Props>(({ data, onAction }) => {
  // Expensive rendering logic
}, (prevProps, nextProps) => {
  // Custom comparison logic
  return prevProps.data.id === nextProps.data.id
})

// ✅ Use useCallback for stable references
const ParentComponent = () => {
  const [items, setItems] = useState([])
  
  const handleItemClick = useCallback((id: number) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])
  
  return (
    <div>
      {items.map(item => (
        <ItemComponent
          key={item.id}
          item={item}
          onClick={handleItemClick} // Stable reference
        />
      ))}
    </div>
  )
}

// ✅ Use useMemo for expensive calculations
const StatisticsComponent = ({ data }: { data: number[] }) => {
  const statistics = useMemo(() => {
    return {
      mean: data.reduce((a, b) => a + b, 0) / data.length,
      max: Math.max(...data),
      min: Math.min(...data)
    }
  }, [data])
  
  return <div>{/* Render statistics */}</div>
}
```

## 🔄 Migration Guide

### Upgrading Existing Components

1. **Add TypeScript types** if missing
2. **Add JSDoc documentation**
3. **Extract business logic** into custom hooks
4. **Add proper error handling**
5. **Improve accessibility**
6. **Add tests** for critical functionality

### Refactoring Checklist

- [ ] Component has single responsibility
- [ ] Props are well-typed and documented
- [ ] Component is accessible
- [ ] Logic is extracted into hooks where appropriate
- [ ] Tests cover main functionality
- [ ] Performance is optimized
- [ ] Error states are handled
- [ ] Dark mode is supported

---

Following these guidelines ensures that components are consistent, maintainable, and provide a great user experience across the OurSchool application.