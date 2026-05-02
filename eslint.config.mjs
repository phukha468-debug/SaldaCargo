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
        { type: 'pkg-shared-types', pattern: 'packages/shared-types/**' },
        { type: 'domain-shared', pattern: 'packages/domain/shared/**' },
        { type: 'domain-module', pattern: 'packages/domain/!(shared)/**' },
      ],
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // domain-модули могут импортировать только из domain/shared и shared-types
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: 'app-web',
              allow: ['pkg-ui', 'pkg-shared-types', 'domain-shared', 'domain-module'],
            },
            {
              from: 'app-miniapp',
              allow: ['pkg-ui', 'pkg-shared-types', 'domain-shared', 'domain-module'],
            },
            { from: 'pkg-ui', allow: ['pkg-shared-types'] },
            { from: 'domain-module', allow: ['domain-shared', 'pkg-shared-types'] },
            { from: 'domain-shared', allow: ['pkg-shared-types'] },
            { from: 'pkg-shared-types', allow: [] },
          ],
        },
      ],
    },
  },
];

export default config;

