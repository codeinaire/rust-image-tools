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
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
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
      // Disable this — it conflicts with no-non-null-assertion (it tells you to use `!`)
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      // Require explicit return types on exported functions
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // Warn on console usage (use proper logging in production code)
      'no-console': 'warn',
      // Require strict equality
      eqeqeq: ['error', 'always'],
      // Disallow var — use const/let
      'no-var': 'error',
      // Prefer const over let when variable is never reassigned
      'prefer-const': 'error',
      // Require curly braces for all control statements
      curly: ['error', 'all'],
      // Disallow implicit type coercion
      'no-implicit-coercion': 'error',
      // Allow numbers in template literals (common in JSX)
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Enforce naming conventions
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'typeLike', format: ['PascalCase'] },
      ],
      // Disallow unused expressions
      '@typescript-eslint/no-unused-expressions': 'error',
      // Enforce switch exhaustiveness
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },

  // Astro files
  ...astroPlugin.configs['flat/recommended'],
)
