Ты — Senior Fullstack Developer. Твоя задача — починить ошибку сборки (build), из-за которой Vercel не может задеплоить проект.

[CONTEXT]
При деплое на Vercel проект падает на шаге pnpm run build внутри пакета apps/miniapp.
Кусочек лога Vercel:

Plaintext
@saldacargo/miniapp:build:   30 |     }
@saldacargo/miniapp:build:   31 |
@saldacargo/miniapp:build: Next.js build worker exited with code: 1
Также есть ворнинг от Turborepo: MAX_BOT_TOKEN is set on your Vercel project, but missing from "turbo.json".

[ACTIONABLE TASKS]
Шаг 1: Воспроизведи ошибку локально
Выполни команду сборки (например, pnpm run build или pnpm turbo build --filter=miniapp) в терминале, чтобы увидеть полный текст ошибки.

Шаг 2: Исправь ошибку компиляции
Найди файл и строку (где-то в районе 30-й строки), на которую ругается TypeScript или ESLint, и внеси исправления напрямую в код. Убедись, что локальный билд теперь проходит без ошибок.

Шаг 3: Исправь turbo.json (опционально)
Если в корневом turbo.json нет переменной MAX_BOT_TOKEN в массиве env (внутри пайплайна build), добавь её туда, чтобы убрать предупреждение Vercel.

[EXPECTED DELIVERABLE]

Напиши, в каком файле была ошибка и в чем именно она заключалась.

Выведи diff изменений, которые ты внес для починки билда.

Сообщи, когда локальный build будет проходить успешно на 100%.