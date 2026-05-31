const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');

// Flat config shared across the workspace. Resolved from each package dir by
// walking up to the repo root.
module.exports = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.config.*',
    ],
  },
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Tests mock the Anthropic SDK with lightweight fakes; allow `any` there.
    files: ['**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
