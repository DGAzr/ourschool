import { useEffect, useState, type CSSProperties } from 'react'
import { PartyPopper } from 'lucide-react'

export default function TodayCompletion({
  celebrationKey,
  animate,
}: {
  celebrationKey: string
  animate: boolean
}) {
  const [celebrating, setCelebrating] = useState(() => {
    if (!animate) return false
    try {
      return sessionStorage.getItem(celebrationKey) !== 'seen'
    } catch {
      return true
    }
  })

  useEffect(() => {
    if (!celebrating) return
    try {
      sessionStorage.setItem(celebrationKey, 'seen')
    } catch {
      // The completion message still works when browser storage is disabled.
    }
    const timer = window.setTimeout(() => setCelebrating(false), 2400)
    return () => window.clearTimeout(timer)
  }, [celebrating, celebrationKey])

  return (
    <div className="relative overflow-hidden rounded-field border border-[var(--pos-fg)]/20 bg-pos-bg text-pos-fg p-3 mt-4">
      {celebrating && animate && (
        <div
          aria-hidden="true"
          className="today-confetti pointer-events-none absolute inset-0"
        >
          {Array.from({ length: 24 }, (_, index) => (
            <span
              key={index}
              className="today-confetti-piece"
              style={
                {
                  left: `${(index * 37) % 100}%`,
                  backgroundColor: [
                    'var(--pos-fg)',
                    'var(--accent)',
                    'var(--gold)',
                    'var(--info-fg)',
                  ][index % 4],
                  '--confetti-drift': `${((index * 13) % 90) - 45}px`,
                  '--confetti-turn': `${index % 2 ? 420 : -420}deg`,
                  animationDelay: `${(index % 6) * 70}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div role="status" className="relative">
        <h3 className="flex items-center gap-2 font-semibold">
          <PartyPopper size={18} aria-hidden="true" />All done for today!
        </h3>
        <p className="text-sm mt-1">
          Today’s lessons are taught and attendance is recorded. Nice work!
        </p>
      </div>
    </div>
  )
}
