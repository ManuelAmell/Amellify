import nextConfig from 'eslint-config-next'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'drizzle/**',
      'public/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'backups/**',
      'scripts/**',
      '*.mjs',
      '*.config.*',
    ],
  },
  ...nextConfig,
  ...tseslint.configs.recommended,
  {
    settings: {
      react: {
        version: '19.0',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  }
)
