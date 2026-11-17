/** Accept only local app destinations. Never send sign-in redirects off-site. */
export function safeReturnPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return fallback
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin || /^\/(login|auth)(\/|$)/.test(url.pathname)) return fallback
    return url.pathname + url.search + url.hash
  } catch { return fallback }
}

export function loginHref(path: string): string {
  const destination = safeReturnPath(path)
  return destination === '/' ? '/login' : `/login?returnTo=${encodeURIComponent(destination)}`
}

export const REMEMBERED_DESTINATION = 'ourschool.sign-in.destination'
