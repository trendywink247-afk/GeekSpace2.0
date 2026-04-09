import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import unicorn from 'eslint-plugin-unicorn'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.worktrees', 'server/dist', 'server/coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-expressions': ['error', {
        allowShortCircuit: true,
        allowTernary: true
      }],
      '@typescript-eslint/no-namespace': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/purity': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/immutability': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
    },
  },
  // Relax rules in test files — test code legitimately uses any for mocks
  // Must come AFTER the general config so it overrides the warn-level rules
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // Enforce filename casing: PascalCase for components, kebab-case for everything else.
  // Existing offenders are grandfathered via the ignores list below — see follow-up issue for renames.
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    plugins: { unicorn },
    rules: {
      'unicorn/filename-case': ['error', { cases: { kebabCase: true, pascalCase: true } }],
    },
  },
  // Grandfather existing filename-case offenders — DO NOT ADD NEW FILES HERE.
  // These must be renamed as tracked in the follow-up issue.
  {
    files: [
      // acronym-heavy names (CTA, AI, HUD, PWA) that unicorn can't fully accept
      'src/components/PWAInstallPrompt.tsx',
      'src/components/StickyMobileCTA.tsx',
      'src/dashboard/pages/AISpecialistPage.tsx',
      'src/dashboard/pages/office/SpotlightHUD.tsx',
      'src/dashboard/pages/portfolio/AITab.tsx',
      'src/landing/sections/TelegramCTASection.tsx',
      // camelCase utility modules
      'src/dashboard/pages/office/agentBehavior.ts',
      'src/dashboard/pages/office/collisionLoader.ts',
      'src/dashboard/pages/office/proactiveSuggestions.ts',
      'src/dashboard/pages/office/roomZones.ts',
      'src/dashboard/pages/office/smartObjects.ts',
      'src/dashboard/pages/office/taskQueue.ts',
      // camelCase test files
      'src/dashboard/pages/office/__tests__/agentBehavior.complete.test.ts',
      'src/dashboard/pages/office/__tests__/agentBehavior.smart-objects.test.ts',
      'src/dashboard/pages/office/__tests__/agentBehavior.test.ts',
      'src/dashboard/pages/office/__tests__/collisionLoader.alpha-parsing.test.ts',
      'src/dashboard/pages/office/__tests__/collisionLoader.complete.test.ts',
      'src/dashboard/pages/office/__tests__/collisionLoader.test.ts',
      'src/dashboard/pages/office/__tests__/roomZones.test.ts',
      'src/dashboard/pages/office/__tests__/taskQueue.test.ts',
    ],
    rules: {
      'unicorn/filename-case': 'off',
    },
  },
])
