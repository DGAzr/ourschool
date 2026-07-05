import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  // Ignore built output and this config file itself
  { ignores: ['dist', 'eslint.config.js'] },

  // eslint:recommended equivalent (re-exported by typescript-eslint)
  tseslint.configs.eslintRecommended,

  // TypeScript recommended rules (includes parser + plugin setup)
  ...tseslint.configs.recommended,

  {
    // Apply plugin rules to all TS/TSX source files
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Core hooks rules (stable, from v4)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // react-hooks v7 React compiler lint suite. The pre-existing warning
      // debt was burned down on 2026-07-05; enforced as errors since.
      'react-hooks/immutability': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/set-state-in-render': 'error',
      'react-hooks/static-components': 'error',
      'react-hooks/use-memo': 'error',
      'react-hooks/preserve-manual-memoization': 'error',
      'react-hooks/incompatible-library': 'error',
      'react-hooks/globals': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/error-boundaries': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/unsupported-syntax': 'error',
      'react-hooks/config': 'error',
      'react-hooks/gating': 'error',

      // Error when a file mixes default-exported components with other exports
      // (breaks React Fast Refresh HMR)
      'react-refresh/only-export-components': 'error',

      // All explicit `any` usage has been eliminated from the codebase, so
      // this is enforced as an error.
      '@typescript-eslint/no-explicit-any': 'error',

      // Caught-error vars intentionally unused (catch (err) { ... }).
      // Downgraded from error; suppress per-occurrence by renaming to _err
      // or adding a comment. caughtErrors:'none' ignores caught-block vars.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
)
