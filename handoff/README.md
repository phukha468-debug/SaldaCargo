# SaldaCargo — перенос дизайна в проект

## Что внутри папки `handoff/`

```
handoff/
└── src/
    ├── app/
    │   └── globals.css              ← обновлённые стили + JetBrains Mono
    └── components/
        ├── layout/
        │   ├── TopNav.tsx           ← НОВЫЙ: горизонтальная навигация
        │   └── MainLayout.tsx       ← ОБНОВЛЁН: использует TopNav вместо Sidebar
        └── dashboard/
            ├── WalletCard.tsx       ← обновлён: font-mono для чисел
            ├── PnlCard.tsx          ← обновлён: прогресс-бар, font-mono
            ├── TodayCard.tsx        ← обновлён: font-mono, цвета
            └── AlertsCard.tsx       ← обновлён: цветные блоки алертов
```

---

## 3 шага

### Шаг 1 — Скопируйте файлы
```bash
cp -r handoff/src/ web/src/
```
Это перезапишет только изменённые файлы — остальное останется нетронутым.

### Шаг 2 — Подключите шрифт JetBrains Mono
В `web/src/app/layout.tsx` добавьте в `<head>`:
```html
<link
  href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap"
  rel="stylesheet"
/>
```

### Шаг 3 — Удалите старый Sidebar (опционально)
```bash
rm web/src/components/layout/Sidebar.tsx
```

---

## Что изменится визуально

| До | После |
|---|---|
| Боковое меню 240px | Горизонтальная навигация 52px |
| Больше пространства для контента | ✅ |
| Обычные числа | Monospace-шрифт для ₽-значений |
| Простые алерты | Цветные блоки warning/error |
| Прогресс-бар серый | Цветной по проценту выполнения |

---

## Ничего не сломается
- Все API-роуты остаются прежними
- Все страницы используют `MainLayout` — он обновится автоматически
- `@saldacargo/ui` компоненты не затронуты
