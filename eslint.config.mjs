import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/generated/**',
      // Components created by the shadcn tool. We do not edit them by hand.
      'web/src/components/ui/**',
      '.history/**',
      '.husky/_/**',
    ],
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

  // HTTP tests read `response.body`, which supertest types as `any`.
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // The seed command prints its progress to the terminal.
  {
    files: ['api/prisma/seed.ts'],
    rules: { 'no-console': 'off' },
  },

  // The browser check scripts print to the terminal, and parts of them run inside the browser page.
  {
    files: ['docs/qa/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-console': 'off' },
  },

  // The web app runs in a browser and uses React, so the rules of hooks apply.
  {
    files: ['web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
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
