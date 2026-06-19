/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:  ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
        serif: ['Newsreader', 'Georgia', 'serif'],
      },
      colors: {
        /* Surfaces */
        bg:        'var(--bg)',
        panel:     'var(--panel)',
        'panel-2': 'var(--panel-2)',
        /* Text */
        ink:       'var(--ink)',
        'ink-2':   'var(--ink-2)',
        muted:     'var(--muted)',
        faint:     'var(--faint)',
        faintest:  'var(--faintest)',
        /* Borders */
        line:      'var(--line)',
        'line-2':  'var(--line-2)',
        'line-3':  'var(--line-3)',
        /* Controls */
        track:        'var(--track)',
        'seg-active': 'var(--seg-active)',
        'field-border':'var(--field-border)',
        'field-bg':   'var(--field-bg)',
        'btn-border': 'var(--btn-border)',
        'check-border':'var(--check-border)',
        /* Accent */
        accent:       'var(--accent)',
        'accent-soft':'var(--accent-soft)',
        'accent-line':'var(--accent-line)',
        /* Functional */
        danger:       'var(--danger)',
        'nav-active': 'var(--nav-active)',
        /* Buttons */
        'btn-primary-bg':'var(--btn-primary-bg)',
        'btn-primary-fg':'var(--btn-primary-fg)',
        /* Status */
        'pos-fg':'var(--pos-fg)', 'pos-bg':'var(--pos-bg)',
        'info-fg':'var(--info-fg)','info-bg':'var(--info-bg)',
        'sub-fg':'var(--sub-fg)', 'sub-bg':'var(--sub-bg)',
        'exc-fg':'var(--exc-fg)', 'exc-bg':'var(--exc-bg)',
        'neg-fg':'var(--neg-fg)', 'neg-bg':'var(--neg-bg)',
        'ns-fg':'var(--ns-fg)',   'ns-bg':'var(--ns-bg)',
        /* Reply */
        reply: 'var(--reply)',
        /* Overlay */
        overlay: 'var(--overlay)',
      },
      borderRadius: {
        card: '13px',
        'card-lg': '16px',
        field: '8px',
        pill: '6px',
      },
      boxShadow: {
        card:  '0 1px 4px var(--shadow)',
        float: '0 4px 20px var(--shadow-lg)',
        menu:  '0 2px 12px var(--shadow)',
      },
    },
  },
  plugins: [],
}
