import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const visibleFocusable = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      !element.hidden &&
      getComputedStyle(element).visibility !== 'hidden' &&
      element.getAttribute('aria-hidden') !== 'true'
  )

type BackgroundState = { inert: boolean; inertAttribute: boolean; ariaHidden: string | null }
const overlays = new Set<HTMLElement>()
const backgrounds = new Map<HTMLElement, BackgroundState>()
let originalOverflow = ''

// DOM order identifies the front portal even when React mounts child effects
// before their parent. Recompute isolation instead of overlapping restorations.
const updateIsolation = () => {
  const roots = Array.from(document.body.children).filter((e): e is HTMLElement => e instanceof HTMLElement)
  const top = roots.filter(root => [...overlays].some(panel => root.contains(panel))).slice(-1)[0]
  roots.forEach(root => {
    if (!backgrounds.has(root)) backgrounds.set(root, {
      inert: root.inert, inertAttribute: root.hasAttribute('inert'), ariaHidden: root.getAttribute('aria-hidden'),
    })
    if (overlays.size > 0) {
      root.inert = root !== top
      if (root === top) { root.removeAttribute('inert'); root.removeAttribute('aria-hidden') }
      else { root.setAttribute('inert', ''); root.setAttribute('aria-hidden', 'true') }
    } else {
      const previous = backgrounds.get(root)!
      root.inert = previous.inert
      if (!previous.inertAttribute) root.removeAttribute('inert')
      if (previous.ariaHidden === null) root.removeAttribute('aria-hidden')
      else root.setAttribute('aria-hidden', previous.ariaHidden)
    }
  })
  document.body.style.overflow = overlays.size ? 'hidden' : originalOverflow
  if (!overlays.size) backgrounds.clear()
}

/** Shared keyboard and background isolation for modal surfaces. */
export const useOverlayFocus = (
  isOpen: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void
) => {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!isOpen || !panelRef.current) return

    const panel = panelRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    if (!overlays.size) originalOverflow = document.body.style.overflow
    overlays.add(panel)
    updateIsolation()

    const focusTimer = window.setTimeout(() => {
      if (panel.closest('[inert], [aria-hidden="true"]')) return
      const preferred = panel.querySelector<HTMLElement>(
        '[data-autofocus], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"]'
      )
      ;(preferred ?? visibleFocusable(panel)[0] ?? panel).focus()
    }, 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      // A nested overlay owns keyboard input until it closes. Re-running this
      // effect for changing callbacks would isolate both dialogs from users.
      if (panel.closest('[inert], [aria-hidden="true"]')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = visibleFocusable(panel)
      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      overlays.delete(panel)
      updateIsolation()
      previouslyFocused?.focus?.()
    }
  }, [isOpen, panelRef])
}
