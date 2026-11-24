import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '.history/**', '.husky/_/**'],
  },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      // Keep committed tests honest: no focused (.only) or skipped (.skip) tests.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[object.name=/^(it|test|describe)$/][property.name=/^(only|skip)$/]',
          message: 'Do not commit focused or skipped tests.',
        },
      ],
    },
  },

  {
    files: ['web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },

  // Plain JavaScript config files are not part of any tsconfig.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Must stay last: turns off rules that clash with Prettier formatting.
  prettier,
);
