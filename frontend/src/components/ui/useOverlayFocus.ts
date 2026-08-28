import { useEffect, type RefObject } from 'react'

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

/** Shared keyboard and background isolation for modal surfaces. */
export const useOverlayFocus = (
  isOpen: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void
) => {
  useEffect(() => {
    if (!isOpen || !panelRef.current) return

    const panel = panelRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const portalRoot = Array.from(document.body.children).find((child) => child.contains(panel))
    const background = Array.from(document.body.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== portalRoot)
      .map((element) => ({
        element,
        inert: element.inert,
        inertAttribute: element.hasAttribute('inert'),
        ariaHidden: element.getAttribute('aria-hidden'),
      }))

    document.body.style.overflow = 'hidden'
    background.forEach(({ element }) => {
      element.inert = true
      element.setAttribute('inert', '')
      element.setAttribute('aria-hidden', 'true')
    })

    const focusTimer = window.setTimeout(() => {
      const preferred = panel.querySelector<HTMLElement>(
        '[data-autofocus], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"]'
      )
      ;(preferred ?? visibleFocusable(panel)[0] ?? panel).focus()
    }, 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
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
      document.body.style.overflow = previousOverflow
      background.forEach(({ element, inert, inertAttribute, ariaHidden }) => {
        element.inert = inert
        if (!inertAttribute) element.removeAttribute('inert')
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
      })
      previouslyFocused?.focus?.()
    }
  }, [isOpen, onClose, panelRef])
}
