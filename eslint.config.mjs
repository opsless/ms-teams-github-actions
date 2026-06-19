// Flat config migration from .eslintrc.json (extended plugin:github/recommended)
// to align with actions/typescript-action template structure.
// See: https://github.com/actions/typescript-action/blob/main/eslint.config.mjs

import {FlatCompat} from '@eslint/eslintrc'
import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import jest from 'eslint-plugin-jest'
import prettier from 'eslint-plugin-prettier'
import globals from 'globals'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

export default [
  {
    ignores: [
      '**/coverage',
      '**/dist',
      '**/lib',
      '**/node_modules',
      'package-lock.json'
    ]
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jest/recommended',
    'plugin:prettier/recommended'
  ),
  {
    files: ['src/**/*.ts', 'src/__tests__/**/*.ts'],
    plugins: {
      jest,
      prettier,
      '@typescript-eslint': typescriptEslint
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly'
      },

      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module'
    },

    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: 'tsconfig.json'
        }
      }
    },

    rules: {
      camelcase: 'off',
      'eslint-comments/no-use': 'off',
      'import/no-namespace': 'off',
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {accessibility: 'no-public'}
      ],
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-useless-constructor': 'error',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/prefer-function-type': 'warn',
      '@typescript-eslint/array-type': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-array-constructor': 'error',
      'prettier/prettier': 'error',
      semi: 'off'
    }
  },
  {
    // Config files at the repo root are not part of tsconfig.json's include.
    // Lint them with the base rules but without type-aware project settings.
    files: ['*.js', '*.mjs', '*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node
      },
      ecmaVersion: 2023,
      sourceType: 'module'
    }
  }
]
