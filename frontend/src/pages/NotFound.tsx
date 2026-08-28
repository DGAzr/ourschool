import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Home } from 'lucide-react'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">404</p>
      <h1 className="mt-2 text-[28px] font-bold tracking-[-0.02em] text-ink">Page not found</h1>
      <p className="mt-2 max-w-md text-[14px] leading-6 text-muted">
        This page may have moved, or the link may be out of date. Your work is still safe.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-field border border-line bg-panel px-4 text-[13.5px] font-semibold text-ink hover:bg-track"
        >
          <ArrowLeft size={16} />
          Go back
        </button>
        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-field bg-btn-primary-bg px-4 text-[13.5px] font-semibold text-btn-primary-fg hover:opacity-90"
        >
          <Home size={16} />
          Dashboard
        </Link>
      </div>
    </div>
  )
}

export default NotFound
