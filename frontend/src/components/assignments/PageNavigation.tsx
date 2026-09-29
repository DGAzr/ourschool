interface Props {
  total: number
  page: number
  hasNext: boolean
  hasPrevious: boolean
  next: () => void
  previous: () => void
}

export default function PageNavigation({ total, page, hasNext, hasPrevious, next, previous }: Props) {
  return <nav aria-label="Results pages" className="flex items-center justify-between gap-3 py-3 text-[13px] text-muted">
    <span>{total.toLocaleString()} results · Page {page}</span>
    <div className="flex gap-2">
      <button type="button" disabled={!hasPrevious} onClick={previous} className="px-3 py-2 border border-line rounded-field disabled:opacity-40">Previous</button>
      <button type="button" disabled={!hasNext} onClick={next} className="px-3 py-2 border border-line rounded-field disabled:opacity-40">Next</button>
    </div>
  </nav>
}
