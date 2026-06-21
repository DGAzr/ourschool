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
      'react-hooks/exhaustive-deps': 'warn',

      // react-hooks v7 introduced a full React compiler lint suite.
      // Downgrading the new strict rules to 'warn' so the toolchain upgrade
      // doesn't require simultaneous code changes.
      // TODO: tighten these back to 'error' as the codebase is cleaned up.
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/unsupported-syntax': 'warn',
      'react-hooks/config': 'warn',
      'react-hooks/gating': 'warn',

      // Warn when a file mixes default-exported components with other exports
      // (breaks React Fast Refresh HMR)
      'react-refresh/only-export-components': 'warn',

      // ---- Pre-existing debt: downgrade to warn rather than error ----
      // The codebase has widespread `any` usage from incremental typing.
      // TODO: resolve these progressively and tighten to 'error' before v2.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Caught-error vars intentionally unused (catch (err) { ... }).
      // Downgraded from error; suppress per-occurrence by renaming to _err
      // or adding a comment. caughtErrors:'none' ignores caught-block vars.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
)
