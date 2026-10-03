import boundaries from 'eslint-plugin-boundaries';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      boundaries,
      '@typescript-eslint': tsPlugin,
    },
    settings: {
      'boundaries/elements': [
        { type: 'app-web', pattern: 'apps/web/**' },
        { type: 'app-miniapp', pattern: 'apps/miniapp/**' },
        { type: 'pkg-ui', pattern: 'packages/ui/**' },
        { type: 'pkg-types', pattern: 'packages/types/**' },
        { type: 'pkg-shared', pattern: 'packages/shared/**' },
        { type: 'domain-module', pattern: 'packages/!(shared|types|ui)/**' },
      ],
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: 'app-web',
              allow: ['pkg-ui', 'pkg-types', 'pkg-shared', 'domain-module'],
            },
            {
              from: 'app-miniapp',
              allow: ['pkg-ui', 'pkg-types', 'pkg-shared', 'domain-module'],
            },
            { from: 'pkg-ui', allow: ['pkg-types'] },
            { from: 'domain-module', allow: ['pkg-shared', 'pkg-types'] },
            { from: 'pkg-shared', allow: ['pkg-types'] },
            { from: 'pkg-types', allow: [] },
          ],
        },
      ],
    },
  },
];

export default config;
