import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // async data-fetching functions that call setState from effects are idiomatic React
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // Node.js environment for config files and CommonJS mocks
  {
    files: ['*.config.js', '__mocks__/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // Jest environment for test/setup files
  {
    files: ['src/**/__tests__/**/*.{js,jsx}', 'src/setupTests.js'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
  },
  // Cypress environment for e2e spec files
  {
    files: ['cypress/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        cy: 'readonly',
        Cypress: 'readonly',
        describe: 'readonly',
        context: 'readonly',
        it: 'readonly',
        specify: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        after: 'readonly',
        afterEach: 'readonly',
        expect: 'readonly',
        assert: 'readonly',
      },
    },
  },
])
