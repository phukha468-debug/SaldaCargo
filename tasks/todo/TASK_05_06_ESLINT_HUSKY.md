# TASK 05: ESLint Boundaries — правила импортов

**Адресат:** Claude Code.
**Длительность:** 20–30 минут.
**Зависимости:** TASK_04 выполнен (все domain модули созданы).

---

## Цель

Настроить `eslint-plugin-boundaries` чтобы запретить неправильные импорты между модулями. Например: `apps/web` может импортировать из `packages/domain/*`, но `packages/domain/logistics` не должен импортировать из `packages/domain/finance` напрямую — только через `packages/domain/shared`.

---

## Правила импортов (граф зависимостей)

```
apps/web, apps/miniapp
    ↓ может импортировать
packages/ui, packages/shared-types
packages/domain/* (любой)
    ↓ может импортировать
packages/domain/shared (только shared!)
packages/shared-types
    ↓ не импортирует ничего из монорепо
```

**Запрещено:**

- `packages/domain/X` → `packages/domain/Y` (кроме shared)
- `packages/ui` → `packages/domain/*`
- `packages/shared-types` → что-либо из монорепо

---

## Алгоритм

### Шаг 1. Установить плагин

```powershell
cd C:\salda
pnpm add -D eslint-plugin-boundaries --workspace-root
```

### Шаг 2. Создать корневой `eslint.config.mjs`

Если уже есть `.eslintrc.json` — удали его и создай `eslint.config.mjs` (flat config, Next.js 15 использует его):

```javascript
import boundaries from 'eslint-plugin-boundaries';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    plugins: {
      boundaries,
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
```

### Шаг 3. Проверить

```powershell
pnpm lint
```

Должно пройти зелёным. Если есть ошибки — исправь нарушения импортов в соответствующих файлах.

### Шаг 4. Коммит

```powershell
git add .
git commit -m "chore: ESLint Boundaries — граф зависимостей модулей

- domain-модули не могут импортировать друг друга
- только через domain/shared или shared-types
- apps/ могут импортировать из packages/*"
git push
```

---

## Критерии приёмки

- [ ] `eslint-plugin-boundaries` установлен в devDependencies корня
- [ ] `eslint.config.mjs` создан с правилами
- [ ] `pnpm lint` зелёный
- [ ] Коммит и push выполнены

---

## Отчёт

```
✅ TASK_05 выполнено
- eslint-plugin-boundaries настроен
- pnpm lint ✓
- Git: push успешно
```

---

---

# TASK 06: Husky + lint-staged — pre-commit хуки

**Адресат:** Claude Code.
**Длительность:** 15–20 минут.
**Зависимости:** TASK_05 выполнен.

---

## Цель

Настроить `husky` и `lint-staged` так чтобы при каждом `git commit`:

1. ESLint проверял изменённые `.ts` и `.tsx` файлы.
2. Prettier форматировал изменённые файлы.
3. TypeScript проверял типы (только для быстрой проверки — `tsc --noEmit`).

Если хоть что-то упало — коммит не проходит.

---

## Алгоритм

### Шаг 1. Установить зависимости

```powershell
cd C:\salda
pnpm add -D husky lint-staged --workspace-root
```

### Шаг 2. Инициализировать Husky

```powershell
pnpm exec husky init
```

Это создаст папку `.husky/` и файл `.husky/pre-commit`.

### Шаг 3. Настроить `.husky/pre-commit`

Перезапиши содержимое `.husky/pre-commit`:

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
```

### Шаг 4. Добавить `lint-staged` конфиг в корневой `package.json`

Добавь в `package.json` секцию `lint-staged`:

```json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{js,jsx,mjs,cjs}": [
    "prettier --write"
  ],
  "*.{json,md,yaml,yml,css}": [
    "prettier --write"
  ]
}
```

### Шаг 5. Проверить что husky работает

Сделай небольшое изменение в любом файле и попробуй закоммитить:

```powershell
echo "// test" >> packages/shared-types/src/index.ts
git add packages/shared-types/src/index.ts
git commit -m "test: проверка husky"
```

Должны запуститься lint-staged проверки. После — отмени тестовый коммит:

```powershell
git reset HEAD~1
# Верни файл к оригиналу
git checkout packages/shared-types/src/index.ts
```

### Шаг 6. Коммит

```powershell
git add .
git commit -m "chore: husky + lint-staged pre-commit хуки

- ESLint + Prettier на staged файлах
- Коммит блокируется при ошибках линтера"
git push
```

---

## Критерии приёмки

- [ ] `.husky/pre-commit` существует и содержит `pnpm lint-staged`
- [ ] `lint-staged` конфиг в `package.json` настроен
- [ ] `husky` и `lint-staged` в devDependencies корня
- [ ] Тестовый коммит запустил lint-staged (видно в выводе)
- [ ] Коммит и push выполнены

---

## Что НЕ делать

- ❌ Не добавляй `commit-msg` хук с проверкой conventional commits — это лишнее на MVP
- ❌ Не добавляй `pre-push` с полным `tsc` — слишком медленно

---

## Отчёт

```
✅ TASK_06 выполнено
- husky инициализирован
- lint-staged настроен
- pre-commit хук работает (проверено тестовым коммитом)
- Git: push успешно
```
