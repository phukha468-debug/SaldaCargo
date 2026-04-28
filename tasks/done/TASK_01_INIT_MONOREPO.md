# TASK 01: Инициализация монорепо

**Адресат:** Claude Code.
**Длительность:** 30–45 минут.
**Зависимости:** TASK_00 выполнен (файлы разложены по папкам).

---

## Цель

Создать скелет pnpm-монорепо: корневые конфиги (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `turbo.json`, `.eslintrc.json`, `.prettierrc.json`, `.gitignore` и т.д.), пустые папки `apps/`, `packages/`, `supabase/`, `scripts/`, `tests/`, `.github/workflows/`. Инициализировать git, сделать первый коммит. **На этом этапе НЕ создаём Next.js приложения и пакеты — это в TASK_02 и далее.**

---

## Алгоритм

### Шаг 1. Проверить, что всё на месте

Перед стартом убедись:

```powershell
# Команды для проверки
ls C:\salda\
# Должны быть видны:
# - START_HERE.md
# - 00_BOOTSTRAP_MANIFEST.md
# - TASK_00, TASK_01, ... в корне
# - папка docs/

ls C:\salda\docs\
# Должны быть видны: architecture, business, design, flows, modules, database, decisions, runbook
```

Если структуры `docs/` нет — TASK_00 не был выполнен. Остановись и сообщи пользователю.

### Шаг 2. Проверить версии инструментов

```powershell
node --version    # должно быть v20.x.x или выше
pnpm --version    # должно быть 9.x
git --version     # любая
```

Если что-то не установлено — остановись и сообщи пользователю.

### Шаг 3. Создать пустые папки (без содержимого)

```powershell
mkdir apps
mkdir packages
mkdir packages\domain
mkdir supabase
mkdir supabase\migrations
mkdir supabase\seed
mkdir scripts
mkdir tests
mkdir tests\fixtures
mkdir .github
mkdir .github\workflows

```

### Шаг 4. Создать корневые конфиги

Создай следующие файлы с **точно** таким содержимым.

**`.gitignore`:**

```
# Dependencies
node_modules/

# Build outputs
.next/
.turbo/
out/
build/
dist/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local
!.env.example


# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Vercel
.vercel

# Supabase
.supabase/
supabase/.branches/
supabase/.temp/

# Testing
coverage/

# Cache
.eslintcache
.cache/
```

**`.gitattributes`:**

```
* text=auto eol=lf
*.{cmd,[cC][mM][dD]} text eol=crlf
*.{bat,[bB][aA][tT]} text eol=crlf
*.png binary
*.jpg binary
*.jpeg binary
*.jfif binary
*.gif binary
```

**`.editorconfig`:**

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_size = 2
indent_style = space
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```

**`.prettierrc.json`:**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "endOfLine": "lf",
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

**`.prettierignore`:**

```
node_modules
.next
.turbo
dist
build
out
coverage
.vercel
*.lock
*.log
docs/business/examples/
```

**`pnpm-workspace.yaml`:**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'packages/domain/*'
```

**`tsconfig.base.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "jsx": "preserve",
    "allowJs": false,
    "noEmit": true
  }
}
```

**`turbo.json`:**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env.local", "tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**`package.json`** (корневой):

```json
{
  "name": "saldacargo",
  "version": "0.1.0",
  "private": true,
  "description": "Система управления транспортным бизнесом — MiniApp в МАХ + Web Dashboard",
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,yaml,yml}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,yaml,yml}\"",
    "gen:types": "supabase gen types typescript --local > packages/shared-types/src/database.types.ts",
    "seed:apply": "tsx scripts/seed-from-md.ts",
    "prepare": "husky"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "prettier": "^3.2.5",
    "tsx": "^4.7.1",
    "turbo": "^2.0.3",
    "typescript": "^5.4.5"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

### Шаг 5. Создать `.env.example`

**`.env.example`** (в корне):

```
# Supabase (получишь в Supabase Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=

# МАХ Mini App (получишь у @MasterBot в МАХ при создании бота)
MAX_BOT_TOKEN=
MAX_OAUTH_CLIENT_ID=
MAX_OAUTH_CLIENT_SECRET=
NEXT_PUBLIC_MAX_BOT_USERNAME=

# App URLs (для CORS и redirect)
NEXT_PUBLIC_WEB_URL=http://localhost:3000
NEXT_PUBLIC_MINIAPP_URL=http://localhost:3001
```

### Шаг 6. Создать `.vscode/`

**`.vscode/extensions.json`:**

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "supabase.vscode-supabase",
    "yoavbls.pretty-ts-errors"
  ]
}
```

**`.vscode/settings.json`:**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "[markdown]": {
    "files.trimTrailingWhitespace": false
  }
}
```

### Шаг 7. Создать заглушки для папок (`.gitkeep`)

Чтобы git не игнорировал пустые папки, создай `.gitkeep` файлы:

```
apps/.gitkeep
packages/.gitkeep
packages/domain/.gitkeep
supabase/migrations/.gitkeep
supabase/seed/.gitkeep
scripts/.gitkeep
tests/fixtures/.gitkeep
.github/workflows/.gitkeep
```

(Это пустые файлы. Когда в этих папках появится реальный контент в следующих заданиях — `.gitkeep` можно удалить.)

### Шаг 8. Создать корневой `CHANGELOG.md`

```markdown
# Changelog

Все значимые изменения в этом проекте документируются здесь.

Формат основан на [Keep a Changelog](https://keepachangelog.com/),
проект следует [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Инициализация монорепо (TASK_01)
- Структура документации (TASK_00)
```

### Шаг 9. Установить зависимости

```powershell
pnpm install
```

Это создаст `pnpm-lock.yaml` и `node_modules/` в корне.

### Шаг 10. Проверка работоспособности

Должны выполниться без ошибок:

```powershell
pnpm typecheck   # ничего не должно сломаться (модулей ещё нет)
pnpm lint        # тоже
pnpm format:check # покажет несоответствия форматирования (исправь pnpm format если нужно)
```

Команды могут показывать «No tasks to run» — это нормально, потому что в `apps/` и `packages/` пока ничего нет.

### Шаг 11. Инициализация git

Если `.git/` ещё нет в корне:

```powershell
git init
git branch -M main
```

### Шаг 12. Подключить удалённый репозиторий

**ВАЖНО:** перед этим шагом узнай у пользователя URL его GitHub-репозитория. Если он не указал — спроси:

> «Подскажи URL твоего репозитория на GitHub. Должен быть формата https://github.com/<логин>/saldacargo.git. Если репозиторий ещё не создан — создай его на github.com (Private, без README/gitignore/LICENSE), и пришли URL.»

Если пользователь дал URL:

```powershell
git remote add origin https://github.com/<логин>/saldacargo.git
```

### Шаг 13. Первый коммит и push

```powershell
git add .
git commit -m "init: монорепо, конфиги, структура документации

- pnpm workspace
- TypeScript strict, Prettier, корневые конфиги
- Структура docs/ (architecture, business, design, flows, modules, database, decisions, runbook)
- Дизайн-референсы и примеры путевых листов в docs/
- VS Code workspace settings"
git push -u origin main
```

Если push провалился (например, repo не пустой) — сообщи пользователю и не делай force push.

---

## Критерии приёмки

После выполнения проверь каждый пункт:

- [ ] В корне есть файлы: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `turbo.json`, `.gitignore`, `.gitattributes`, `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `.env.example`, `CHANGELOG.md`.
- [ ] Существуют папки: `apps/`, `packages/`, `packages/domain/`, `supabase/migrations/`, `supabase/seed/`, `scripts/`, `tests/fixtures/`, `.github/workflows/`, `.vscode/`.
- [ ] В этих пустых папках есть `.gitkeep`.
- [ ] `pnpm install` прошёл без ошибок, `node_modules/` создалась.
- [ ] `pnpm typecheck` проходит (или говорит «No tasks to run»).
- [ ] `pnpm lint` проходит.
- [ ] `git status` показывает чистое рабочее дерево после коммита.
- [ ] `git log` показывает один коммит с инициализацией.
- [ ] `git remote -v` показывает origin (если URL был дан).
- [ ] `.env.local` НЕ создан (только `.env.example` коммитится).
- [ ] Содержимое папок `docs/architecture/`, `docs/business/`, `docs/flows/` и т.д. не тронуто.

---

## Что НЕ делать

- ❌ Не создавай Next.js приложения внутри `apps/` (это TASK_02).
- ❌ Не создавай `package.json` в подпапках `apps/` или `packages/` (это TASK_02 и TASK_03).
- ❌ Не устанавливай дополнительные библиотеки (React, Tailwind, ESLint plugins) — только то, что в корневом `package.json`.
- ❌ Не запускай `npx create-next-app` или похожие команды.
- ❌ Не пиши код вне конфигов.
- ❌ Не создавай миграции БД.
- ❌ Не создавай `.env.local`.

---

## Отчёт после выполнения

```
✅ TASK_01 выполнено

Создано файлов: X
Создано папок: Y
Установлено зависимостей: Z (см. node_modules)

Версии:
- Node: vXX.X.X
- pnpm: X.X.X
- TypeScript: X.X.X

Команды прошли успешно:
- pnpm install ✓
- pnpm typecheck ✓
- pnpm lint ✓

Git:
- Инициализирован: да/нет
- Remote: https://github.com/.../saldacargo.git
- Push: успешно/не выполнен (причина)

Вопросы / проблемы:
- (если есть)
```

---

## Если что-то идёт не так

- **`pnpm install` падает:** покажи полный вывод ошибки. Не пытайся обойти. Возможные причины: старая версия Node, нет интернета, проблема с registry.
- **`git push` падает:** проверь, что origin указывает на правильный репозиторий и что у тебя есть права. НЕ делай force push.
- **Конфликт с существующими файлами:** если в корне уже есть `package.json` (например, от прошлой неудачной попытки) — спроси пользователя, можно ли перезаписать.

После завершения остановись. Жди следующего задания — `TASK_02_CREATE_APPS.md`.
