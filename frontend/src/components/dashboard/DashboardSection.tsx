import { ReactNode } from 'react'

export default function DashboardSection({
  title,
  loading,
  error,
  retry,
  children,
  tools,
}: {
  title: string
  loading?: boolean
  error?: string
  retry: () => void
  children: ReactNode
  tools?: ReactNode
}) {
  return (
    <section className="min-w-0 bg-panel border border-line rounded-card p-4">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {tools}
      </div>
      {loading && (
        <p role="status" className="text-sm text-muted">
          Loading…
        </p>
      )}
      {error && (
        <div role="alert" className="text-sm text-neg-fg">
          <p>{error}</p>
          <button
            onClick={retry}
            className="min-h-[44px] text-accent font-semibold"
          >
            Try again
          </button>
        </div>
      )}
      {!loading && !error && children}
    </section>
  )
}

export function OffsetNavigation({
  offset,
  total,
  hasMore,
  onChange,
  limit,
}: {
  offset: number
  total: number
  hasMore: boolean
  onChange: (offset: number) => void
  limit: number
}) {
  if (!offset && !hasMore) return null
  return (
    <nav
      aria-label="Section pages"
      className="flex flex-wrap items-center gap-3 text-sm mt-3"
    >
      <button
        className="min-h-[44px] text-accent disabled:text-muted"
        disabled={!offset}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        Previous
      </button>
      <span>
        {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <button
        className="min-h-[44px] text-accent disabled:text-muted"
        disabled={!hasMore}
        onClick={() => onChange(offset + limit)}
      >
        Next
      </button>
    </nav>
  )
}
