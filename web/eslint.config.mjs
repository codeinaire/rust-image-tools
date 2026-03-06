// @ts-check
import tseslint from 'typescript-eslint'
import astroPlugin from 'eslint-plugin-astro'

export default tseslint.config(
  // Global ignores
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**'],
  },

  // Strict type-aware rules for TypeScript/TSX source files
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce `import type` for type-only imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Prevent side effects from type-only imports
      '@typescript-eslint/no-import-type-side-effects': 'error',
      // Disallow non-null assertions — use proper narrowing instead
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Require explicit return types on exported functions
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // Warn on console usage (use proper logging in production code)
      'no-console': 'warn',
      // Require strict equality
      eqeqeq: ['error', 'always'],
    },
  },

  // Astro files
  ...astroPlugin.configs['flat/recommended'],
)
