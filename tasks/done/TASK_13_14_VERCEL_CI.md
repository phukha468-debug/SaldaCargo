# TASK 13: Деплой на Vercel

**Адресат:** Claude Code.
**Длительность:** 30–45 минут.
**Зависимости:** TASK_12 выполнен, оба приложения собираются (`pnpm build` зелёный).

---

## Цель

Задеплоить `apps/web` и `apps/miniapp` на Vercel. Настроить переменные окружения. Проверить что оба приложения открываются по публичным URL.

---

## Перед стартом — нужно от пользователя

1. Аккаунт на https://vercel.com (логин через GitHub)
2. Репозиторий `saldacargo` должен быть на GitHub (private)

---

## Алгоритм

### Шаг 1. Установить Vercel CLI

```powershell
pnpm add -D vercel --workspace-root
```

### Шаг 2. Настроить vercel.json в корне

Создай `vercel.json` в корне `C:\salda`:

```json
{
  "version": 2,
  "projects": [
    {
      "name": "saldacargo-web",
      "src": "apps/web"
    },
    {
      "name": "saldacargo-miniapp",
      "src": "apps/miniapp"
    }
  ]
}
```

> **Примечание:** Vercel Hobby деплоит один проект за раз. Нам нужно создать
> два отдельных Vercel-проекта. Инструкция ниже.

### Шаг 3. Задеплоить apps/web

```powershell
cd C:\salda\apps\web
pnpm exec vercel login
pnpm exec vercel link
# Ответить на вопросы:
# - Set up and deploy? Y
# - Which scope? (выбери свой аккаунт)
# - Link to existing project? N
# - Project name: saldacargo-web
# - Directory: ./
pnpm exec vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Вставить значение из .env.local
pnpm exec vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
pnpm exec vercel env add SUPABASE_SERVICE_ROLE_KEY production
pnpm exec vercel --prod
```

Vercel выдаст URL вида `https://saldacargo-web.vercel.app`.

### Шаг 4. Задеплоить apps/miniapp

```powershell
cd C:\salda\apps\miniapp
pnpm exec vercel link
# Project name: saldacargo-miniapp
pnpm exec vercel env add NEXT_PUBLIC_SUPABASE_URL production
pnpm exec vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
pnpm exec vercel env add SUPABASE_SERVICE_ROLE_KEY production
pnpm exec vercel --prod
```

### Шаг 5. Обновить Supabase Auth Redirect URLs

В Supabase Dashboard → Authentication → URL Configuration добавить:

- `https://saldacargo-web.vercel.app/**`
- `https://saldacargo-miniapp.vercel.app/**`

### Шаг 6. Добавить скрипты деплоя в корневой package.json

Добавь в `scripts`:

```json
"deploy:web": "cd apps/web && vercel --prod",
"deploy:miniapp": "cd apps/miniapp && vercel --prod",
"deploy:all": "pnpm deploy:web && pnpm deploy:miniapp"
```

### Шаг 7. Создать `.vercel` в .gitignore

Убедись что `.vercel` есть в `.gitignore` (уже должно быть из TASK_01).

### Шаг 8. Проверка

Открой в браузере:

- `https://saldacargo-web.vercel.app/login` — должна открыться страница логина
- `https://saldacargo-miniapp.vercel.app` — должен открыться экран загрузки MiniApp

### Шаг 9. Коммит

```powershell
cd C:\salda
git add .
git commit -m "chore: настройка деплоя Vercel

- vercel.json в корне
- скрипты deploy:web, deploy:miniapp, deploy:all
- переменные окружения настроены в Vercel Dashboard"
git push
```

---

## Критерии приёмки

- [ ] `https://saldacargo-web.vercel.app/login` открывается
- [ ] `https://saldacargo-miniapp.vercel.app` открывается
- [ ] Переменные окружения настроены в Vercel (не видны в коде)
- [ ] `.vercel/` не закоммичен в git
- [ ] Коммит и push выполнены

---

## Отчёт

```
✅ TASK_13 выполнено

URLs:
- Web: https://saldacargo-web.vercel.app
- MiniApp: https://saldacargo-miniapp.vercel.app

Vercel проекты:
- saldacargo-web ✓
- saldacargo-miniapp ✓

Git: push успешно
```

---

---

# TASK 14: GitHub Actions CI

**Адресат:** Claude Code.
**Длительность:** 30 минут.
**Зависимости:** TASK_13 выполнен (деплой настроен).

---

## Цель

Настроить CI пайплайн на GitHub Actions: при каждом push в `main` запускать typecheck, lint и build. Это защита от сломанного кода в продакшне.

---

## Алгоритм

### Шаг 1. Создать workflow файл

Создай `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: Typecheck, Lint, Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          # SERVICE_ROLE_KEY намеренно НЕ передаём в CI — build не требует
```

### Шаг 2. Добавить секреты в GitHub

В GitHub → репозиторий → Settings → Secrets and variables → Actions:

- `NEXT_PUBLIC_SUPABASE_URL` — из `.env.local`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — из `.env.local`

### Шаг 3. Удалить .gitkeep из .github/workflows/

```powershell
Remove-Item C:\salda\.github\workflows\.gitkeep
```

### Шаг 4. Коммит и проверка

```powershell
git add .
git commit -m "chore: GitHub Actions CI

- typecheck + lint + build на каждый push в main
- Supabase публичные ключи через GitHub Secrets"
git push
```

Зайди в GitHub → Actions → убедись что пайплайн запустился и прошёл зелёным.

---

## Критерии приёмки

- [ ] `.github/workflows/ci.yml` создан
- [ ] GitHub Secrets настроены
- [ ] CI пайплайн запустился и прошёл зелёным
- [ ] `.github/workflows/.gitkeep` удалён
- [ ] Коммит и push выполнены

---

## Что НЕ делать

- ❌ Не добавляй тесты — их пока нет
- ❌ Не настраивай автодеплой через CI — деплоим вручную через `pnpm deploy:all`
- ❌ Не добавляй `SUPABASE_SERVICE_ROLE_KEY` в CI secrets — build не требует

---

## Отчёт

```
✅ TASK_14 выполнено

GitHub Actions:
- Workflow: .github/workflows/ci.yml ✓
- Secrets: настроены ✓
- Первый запуск: ✅ зелёный

Git: push успешно
```
