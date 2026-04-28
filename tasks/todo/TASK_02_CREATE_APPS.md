# TASK 02: Создание apps/web и apps/miniapp

**Адресат:** Claude Code.
**Длительность:** 30–45 минут.
**Зависимости:** TASK_01 выполнен (монорепо инициализирован).

---

## Цель

Создать два Next.js 15 приложения внутри монорепо: `apps/web` (будущий Web Dashboard) и `apps/miniapp` (будущая мини-аппа в МАХ). Настроить их под наш стек: TypeScript strict, Tailwind, App Router, без `src/` директории. Подключить к workspace, проверить, что оба запускаются на разных портах. **На этом этапе экранов не делаем — только Hello World.**

---

## Алгоритм

### Шаг 1. Проверка готовности

Убедись, что монорепо уже инициализирован (TASK_01 выполнен):

```powershell
ls C:\salda\
# Должны быть: package.json, pnpm-workspace.yaml, tsconfig.base.json, apps/, packages/, ...

cat C:\salda\package.json
# Должен показать "name": "saldacargo", scripts dev/build/lint и т.д.
```

Если этого нет — TASK_01 не выполнен. Остановись.

### Шаг 2. Создать `apps/web` (Next.js 15)

**ВАЖНО:** не используй `npx create-next-app` интерактивно — он будет задавать вопросы. Используй неинтерактивный режим с флагами.

```powershell
cd C:\salda\apps
pnpm create next-app@latest web --typescript --eslint --tailwind --app --import-alias "@/*" --no-src-dir --use-pnpm --turbopack
```

Если флаги Next.js изменились и команда падает — попробуй интерактивный режим, отвечая:

- TypeScript: **Yes**
- ESLint: **Yes**
- Tailwind CSS: **Yes**
- `src/` directory: **No**
- App Router: **Yes**
- Turbopack: **Yes**
- Customize import alias: **Yes** (`@/*`)

После создания у тебя появится `apps/web/` с базовым проектом Next.js.

### Шаг 3. Создать `apps/miniapp` (тоже Next.js 15)

```powershell
cd C:\salda\apps
pnpm create next-app@latest miniapp --typescript --eslint --tailwind --app --import-alias "@/*" --no-src-dir --use-pnpm --turbopack
```

### Шаг 4. Привести `package.json` обоих приложений к стандарту проекта

#### `apps/web/package.json`

Замени имя на `@saldacargo/web` и установи порт 3000. Поправь скрипты:

```json
{
  "name": "@saldacargo/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "15.x",
    "react": "19.x",
    "react-dom": "19.x"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "15.x",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.5",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

**ВАЖНО:** не выдумывай версии. Возьми реальные версии из того, что Next.js установил при создании. Не понижай и не повышай — оставь как есть.

#### `apps/miniapp/package.json`

То же самое, но имя `@saldacargo/miniapp` и порт 3001:

```json
{
  "name": "@saldacargo/miniapp",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  ...
}
```

Зависимости оставь те же, что Next.js установил.

### Шаг 5. Настроить tsconfig обоих приложений

#### `apps/web/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### `apps/miniapp/tsconfig.json`

Идентично.

### Шаг 6. Заменить стандартный контент Next.js на простой Hello World

#### `apps/web/app/page.tsx`

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900">SaldaCargo Web</h1>
        <p className="mt-2 text-slate-600">Web Dashboard для админа и владельца</p>
        <p className="mt-8 text-sm text-slate-400">port 3000 · in development</p>
      </div>
    </main>
  );
}
```

#### `apps/web/app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SaldaCargo Web',
  description: 'Управление транспортным бизнесом',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

#### `apps/web/app/globals.css`

Оставь стандартный, который сгенерил Next.js, либо замени на минимальный:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-inter: 'Inter', system-ui, sans-serif;
}

body {
  font-family: var(--font-inter);
}
```

#### `apps/miniapp/app/page.tsx`

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-orange-50 p-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-orange-700">SaldaCargo MiniApp</h1>
        <p className="mt-2 text-slate-600">Мини-приложение для МАХ</p>
        <p className="mt-8 text-xs text-slate-400">port 3001 · in development</p>
      </div>
    </main>
  );
}
```

#### `apps/miniapp/app/layout.tsx`

То же, что `apps/web/app/layout.tsx`, только с `title: 'SaldaCargo MiniApp'`.

#### `apps/miniapp/app/globals.css`

То же, что у `apps/web`.

### Шаг 7. Удалить файлы Next.js, которые не нужны

В обоих приложениях удали:

- `apps/*/public/next.svg`
- `apps/*/public/vercel.svg`
- (любые стандартные иллюстрации, которые Next.js кладёт)

Файл `apps/*/public/favicon.ico` — оставь, если он есть.

### Шаг 8. Удалить `apps/.gitkeep`

После создания приложений в `apps/` появились реальные подпапки. Удали `apps/.gitkeep`.

### Шаг 9. Проверка

В корне `C:\salda`:

```powershell
pnpm install
pnpm typecheck
pnpm lint
pnpm build
```

Всё должно пройти зелёным.

### Шаг 10. Запустить оба приложения параллельно

```powershell
pnpm dev
```

Это запустит turbo, который параллельно запустит `apps/web` и `apps/miniapp`.

Открой в браузере:

- http://localhost:3000 → должен показать «SaldaCargo Web»
- http://localhost:3001 → должен показать «SaldaCargo MiniApp»

Если оба приложения открываются — отлично. Останови dev (`Ctrl+C`).

### Шаг 11. Коммит

```powershell
git add .
git commit -m "feat: apps/web и apps/miniapp на Next.js 15

- apps/web: дашборд (порт 3000)
- apps/miniapp: мини-аппа МАХ (порт 3001)
- TypeScript strict, App Router, Tailwind, без src/
- Inter (latin + cyrillic) как основной шрифт
- Hello World на обоих приложениях"
git push
```

---

## Критерии приёмки

- [ ] Папка `apps/web/` существует, содержит структуру Next.js 15 (`app/`, `package.json`, `tsconfig.json`, `next.config.js` или `next.config.ts`).
- [ ] Папка `apps/miniapp/` существует, такая же структура.
- [ ] `apps/web/package.json` содержит `"name": "@saldacargo/web"`.
- [ ] `apps/miniapp/package.json` содержит `"name": "@saldacargo/miniapp"`.
- [ ] `apps/web/tsconfig.json` extends `../../tsconfig.base.json`.
- [ ] `apps/miniapp/tsconfig.json` extends `../../tsconfig.base.json`.
- [ ] `apps/.gitkeep` удалён.
- [ ] `pnpm install` в корне проходит без ошибок.
- [ ] `pnpm typecheck` зелёный.
- [ ] `pnpm lint` зелёный.
- [ ] `pnpm build` зелёный.
- [ ] `pnpm dev` запускает оба приложения, они открываются на :3000 и :3001.
- [ ] http://localhost:3000 показывает «SaldaCargo Web».
- [ ] http://localhost:3001 показывает «SaldaCargo MiniApp».
- [ ] Шрифт Inter подгружается, поддерживает кириллицу.
- [ ] Коммит сделан и запушен.

---

## Что НЕ делать

- ❌ Не устанавливай shadcn/ui, lucide-react, recharts и другие библиотеки — это в следующих заданиях.
- ❌ Не создавай папки `apps/web/components/`, `apps/web/lib/` и т.д. — пусть пока будет минимум.
- ❌ Не настраивай авторизацию.
- ❌ Не подключай Supabase Client — это позже.
- ❌ Не создавай API routes (`app/api/`) — позже.
- ❌ Не используй `src/` директорию.
- ❌ Не выдумывай версии пакетов — оставь те, что установил `create-next-app`.

---

## Отчёт

```
✅ TASK_02 выполнено

Создано приложений: 2
- apps/web @saldacargo/web (Next.js X.X.X)
- apps/miniapp @saldacargo/miniapp (Next.js X.X.X)

Версии (что установил Next.js):
- Next.js: X.X.X
- React: X.X.X
- Tailwind: X.X.X
- TypeScript: X.X.X

Команды:
- pnpm install ✓
- pnpm typecheck ✓
- pnpm lint ✓
- pnpm build ✓
- pnpm dev: оба приложения запускаются

URL проверены:
- http://localhost:3000 ✓ "SaldaCargo Web"
- http://localhost:3001 ✓ "SaldaCargo MiniApp"

Git:
- Коммит: "feat: apps/web и apps/miniapp на Next.js 15"
- Push: успешно

Вопросы:
- (если есть)
```

---

## Если что-то идёт не так

### Проблема 1: `pnpm create next-app` падает с непонятными флагами

В новых версиях Next.js некоторые флаги могли поменяться. Проверь `pnpm create next-app@latest --help` и адаптируй команду. Если не уверен — используй интерактивный режим с ответами из Шага 2.

### Проблема 2: `pnpm dev` запускает только одно приложение

Это значит, что Turbo не подхватил оба workspace. Проверь:

- В корневом `pnpm-workspace.yaml` есть `apps/*`.
- В корневом `turbo.json` есть `dev` task.
- В `apps/web/package.json` и `apps/miniapp/package.json` есть скрипт `dev`.

### Проблема 3: Оба приложения пытаются занять порт 3000

Проверь, что в скриптах `dev` явно указаны разные порты (`-p 3000` и `-p 3001`).

### Проблема 4: TypeScript ругается на пути

Это нормально на первом запуске — Next.js создаёт `next-env.d.ts` после первой сборки. Запусти `pnpm build` один раз, потом проверь.

### Проблема 5: ESLint в одном приложении ругается на другой

Каждое приложение имеет свой `.eslintrc.json` (или `eslint.config.mjs` в Next.js 15) — они изолированы. Если ругается на корневые файлы — добавь в `eslintignore` соответствующие пути.

---

После завершения остановись. Жди следующее задание — `TASK_03_CREATE_PACKAGES.md`.
