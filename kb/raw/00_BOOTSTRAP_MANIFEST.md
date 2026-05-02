# Bootstrap Manifest

**Назначение этого файла:** содержит точное соответствие «какой файл из корня `C:\salda` должен лежать в какой папке проекта». Этот файл читает AI-ассистент в задании `TASK_00_BOOTSTRAP_AND_DISTRIBUTE.md` и использует как карту для раскладки.

**ВАЖНО:** этот файл **сам себя** не упоминает в раскладке — он остаётся в корне на всё время работы как референс.

---

## Структура файлов после раскладки

После выполнения TASK_00 структура `C:\salda` должна быть такой:

```
C:\salda\
├── README.md                                    ← из 01_README.md
├── CLAUDE.md                                    ← из 02_CLAUDE.md
├── GEMINI.md                                    ← из 03_GEMINI.md
├── START_HERE.md                                ← остаётся в корне
├── 00_BOOTSTRAP_MANIFEST.md                     ← остаётся в корне
├── TASK_00_BOOTSTRAP_AND_DISTRIBUTE.md          ← остаётся в корне (выполнен)
├── TASK_01_INIT_MONOREPO.md                     ← остаётся в корне
├── TASK_02_CREATE_APPS.md                       ← остаётся в корне
├── ... (остальные TASK_*.md в корне)
├── docs/
│   ├── architecture/
│   │   ├── 01-overview.md                       ← из 04_architecture-overview.md
│   │   ├── 02-modules.md                        ← из 05_architecture-modules.md
│   │   └── 03-conventions.md                    ← из 06_architecture-conventions.md
│   ├── business/
│   │   ├── README.md                            ← из 07_business-readme.md
│   │   ├── people.md                            ← из 08_business-people.md
│   │   ├── fleet.md                             ← из 09_business-fleet.md
│   │   ├── legal-entities.md                    ← из 10_business-legal-entities.md
│   │   ├── payroll-rules.md                     ← из 11_business-payroll-rules.md
│   │   ├── service-catalog.md                   ← из 12_business-service-catalog.md
│   │   ├── maintenance-regulations.md           ← из 13_business-maintenance-regulations.md
│   │   ├── categories.md                        ← из 14_business-categories.md
│   │   ├── wallets.md                           ← из 15_business-wallets.md
│   │   ├── counterparties.md                    ← из 16_business-counterparties.md
│   │   ├── goals.md                             ← из 17_business-goals.md
│   │   ├── glossary.md                          ← из 18_business-glossary.md
│   │   └── examples/
│   │       ├── README.md                        ← из 19_business-examples-README.md
│   │       ├── 19-04-2026_machine-099_denis.jfif      ← из EXAMPLE_19-04-2026_machine-099_denis.jfif
│   │       ├── 19-04-2026_machine-866_vova.jfif       ← из EXAMPLE_19-04-2026_machine-866_vova.jfif
│   │       ├── 20-04-2026_machine-877_faruh.jfif      ← из EXAMPLE_20-04-2026_machine-877_faruh.jfif
│   │       ├── 20-04-2026_machine-099_denis.jfif      ← из EXAMPLE_20-04-2026_machine-099_denis.jfif
│   │       └── 20-04-2026_valdai-188_chat.jpg         ← из EXAMPLE_20-04-2026_valdai-188_chat.jpg
│   ├── design/
│   │   ├── README.md                            ← из 20_design-README.md
│   │   ├── tokens.md                            ← из 21_design-tokens.md
│   │   ├── driver/
│   │   │   ├── 01-home.html                     ← из DESIGN_driver-home.html
│   │   │   └── 03-trip-active.html              ← из DESIGN_driver-trip-active.html
│   │   ├── mechanic/
│   │   │   └── 01-home.html                     ← из DESIGN_mechanic-home.html
│   │   ├── admin-mini/
│   │   │   └── 01-home.html                     ← из DESIGN_admin-mini-home.html
│   │   └── admin-web/
│   │       ├── 01-money-map.html                ← из DESIGN_admin-web-home.html
│   │       ├── 02-review.html                   ← из DESIGN_admin-web-review.html
│   │       └── 03-fleet.html                    ← из DESIGN_admin-web-fleet.html
│   ├── flows/
│   │   ├── README.md                            ← из 28_flows-README.md
│   │   ├── driver-shift.md                      ← из 22_flow-driver-shift.md
│   │   ├── mechanic-repair.md                   ← из 23_flow-mechanic-repair.md
│   │   ├── admin-cash-collect.md                ← из 24_flow-admin-cash-collect.md
│   │   ├── receivable-settle.md                 ← из 25_flow-receivable-settle.md
│   │   ├── depreciation-monthly.md              ← из 26_flow-depreciation-monthly.md
│   │   └── retro-data-import.md                 ← из 27_flow-retro-data-import.md
│   ├── modules/
│   │   ├── shared/README.md                     ← создать пустой stub
│   │   ├── identity/README.md                   ← создать пустой stub
│   │   ├── fleet/README.md                      ← создать пустой stub
│   │   ├── finance/README.md                    ← создать пустой stub
│   │   ├── logistics/README.md                  ← создать пустой stub
│   │   ├── service/README.md                    ← создать пустой stub
│   │   ├── payroll/README.md                    ← создать пустой stub
│   │   └── receivables/README.md                ← создать пустой stub
│   ├── database/
│   │   └── README.md                            ← создать пустой stub
│   ├── decisions/
│   │   └── README.md                            ← создать пустой stub (объяснение формата ADR)
│   └── runbook/
│       └── README.md                            ← создать пустой stub
└── (остальное создаётся в TASK_01: apps/, packages/, supabase/, scripts/, tests/, .github/)
```

---

## Полная таблица соответствия

### Корневые файлы (переименовываются)

| Из (в корне C:\salda) | В (тоже корень, новое имя) |
| --------------------- | -------------------------- |
| `01_README.md`        | `README.md`                |
| `02_CLAUDE.md`        | `CLAUDE.md`                |
| `03_GEMINI.md`        | `GEMINI.md`                |

### Документация архитектуры

| Из (корень)                      | В                                     |
| -------------------------------- | ------------------------------------- |
| `04_architecture-overview.md`    | `docs/architecture/01-overview.md`    |
| `05_architecture-modules.md`     | `docs/architecture/02-modules.md`     |
| `06_architecture-conventions.md` | `docs/architecture/03-conventions.md` |

### Источники правды

| Из (корень)                              | В                                          |
| ---------------------------------------- | ------------------------------------------ |
| `07_business-readme.md`                  | `docs/business/README.md`                  |
| `08_business-people.md`                  | `docs/business/people.md`                  |
| `09_business-fleet.md`                   | `docs/business/fleet.md`                   |
| `10_business-legal-entities.md`          | `docs/business/legal-entities.md`          |
| `11_business-payroll-rules.md`           | `docs/business/payroll-rules.md`           |
| `12_business-service-catalog.md`         | `docs/business/service-catalog.md`         |
| `13_business-maintenance-regulations.md` | `docs/business/maintenance-regulations.md` |
| `14_business-categories.md`              | `docs/business/categories.md`              |
| `15_business-wallets.md`                 | `docs/business/wallets.md`                 |
| `16_business-counterparties.md`          | `docs/business/counterparties.md`          |
| `17_business-goals.md`                   | `docs/business/goals.md`                   |
| `18_business-glossary.md`                | `docs/business/glossary.md`                |
| `19_business-examples-README.md`         | `docs/business/examples/README.md`         |

### Дизайн-референсы

| Из (корень)                      | В                                         |
| -------------------------------- | ----------------------------------------- |
| `20_design-README.md`            | `docs/design/README.md`                   |
| `21_design-tokens.md`            | `docs/design/tokens.md`                   |
| `DESIGN_driver-home.html`        | `docs/design/driver/01-home.html`         |
| `DESIGN_driver-trip-active.html` | `docs/design/driver/03-trip-active.html`  |
| `DESIGN_mechanic-home.html`      | `docs/design/mechanic/01-home.html`       |
| `DESIGN_admin-mini-home.html`    | `docs/design/admin-mini/01-home.html`     |
| `DESIGN_admin-web-home.html`     | `docs/design/admin-web/01-money-map.html` |
| `DESIGN_admin-web-fleet.html`    | `docs/design/admin-web/03-fleet.html`     |
| `DESIGN_admin-web-review.html`   | `docs/design/admin-web/02-review.html`    |

### Flows (пользовательские сценарии)

| Из (корень)                       | В                                    |
| --------------------------------- | ------------------------------------ |
| `22_flow-driver-shift.md`         | `docs/flows/driver-shift.md`         |
| `23_flow-mechanic-repair.md`      | `docs/flows/mechanic-repair.md`      |
| `24_flow-admin-cash-collect.md`   | `docs/flows/admin-cash-collect.md`   |
| `25_flow-receivable-settle.md`    | `docs/flows/receivable-settle.md`    |
| `26_flow-depreciation-monthly.md` | `docs/flows/depreciation-monthly.md` |
| `27_flow-retro-data-import.md`    | `docs/flows/retro-data-import.md`    |
| `28_flows-README.md`              | `docs/flows/README.md`               |

### Примеры путевых листов

| Из (корень)                                 | В                                                          |
| ------------------------------------------- | ---------------------------------------------------------- |
| `EXAMPLE_19-04-2026_machine-099_denis.jfif` | `docs/business/examples/19-04-2026_machine-099_denis.jfif` |
| `EXAMPLE_19-04-2026_machine-866_vova.jfif`  | `docs/business/examples/19-04-2026_machine-866_vova.jfif`  |
| `EXAMPLE_20-04-2026_machine-877_faruh.jfif` | `docs/business/examples/20-04-2026_machine-877_faruh.jfif` |
| `EXAMPLE_20-04-2026_machine-099_denis.jfif` | `docs/business/examples/20-04-2026_machine-099_denis.jfif` |
| `EXAMPLE_20-04-2026_valdai-188_chat.jpg`    | `docs/business/examples/20-04-2026_valdai-188_chat.jpg`    |

### Stubs для модулей и runbook

Файлы, которых нет в корне, но AI должен создать как пустые заглушки:

| Файл                                 | Содержимое                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `docs/modules/shared/README.md`      | `# Module: shared\n\n**Статус:** TODO — заполнить при реализации модуля.\n`                             |
| `docs/modules/identity/README.md`    | `# Module: identity\n\n**Статус:** TODO.\n`                                                             |
| `docs/modules/fleet/README.md`       | `# Module: fleet\n\n**Статус:** TODO.\n`                                                                |
| `docs/modules/finance/README.md`     | `# Module: finance\n\n**Статус:** TODO.\n`                                                              |
| `docs/modules/logistics/README.md`   | `# Module: logistics\n\n**Статус:** TODO.\n`                                                            |
| `docs/modules/service/README.md`     | `# Module: service\n\n**Статус:** TODO.\n`                                                              |
| `docs/modules/payroll/README.md`     | `# Module: payroll\n\n**Статус:** TODO.\n`                                                              |
| `docs/modules/receivables/README.md` | `# Module: receivables\n\n**Статус:** TODO.\n`                                                          |
| `docs/database/README.md`            | `# Database\n\n**Статус:** TODO. Здесь будет описание схемы БД, актуализируется при каждой миграции.\n` |
| `docs/decisions/README.md`           | См. ниже секцию «ADR README»                                                                            |
| `docs/runbook/README.md`             | `# Runbook\n\n**Статус:** TODO. Здесь будет операционная информация для поддержки.\n`                   |

### Файлы, которые остаются в корне

| Файл                                  | Назначение                               |
| ------------------------------------- | ---------------------------------------- |
| `START_HERE.md`                       | Инструкция для пользователя, не трогать  |
| `00_BOOTSTRAP_MANIFEST.md`            | Этот файл, остаётся как референс         |
| `TASK_00_BOOTSTRAP_AND_DISTRIBUTE.md` | Задание, оставить как историю выполнения |
| `TASK_01_*.md` ... `TASK_15_*.md`     | Все остальные задания, остаются в корне  |

---

## ADR README (содержимое для `docs/decisions/README.md`)

```markdown
# Architecture Decision Records (ADR)

В этой папке хранятся записи о нетривиальных архитектурных решениях.

## Когда создавать ADR

- Выбор библиотеки или подхода с альтернативами (например: «почему Lucide, а не Material Symbols»).
- Изменение графа модулей.
- Решения, влияющие на множество частей системы.
- Любое решение, которое через 6 месяцев захочется вспомнить «почему мы так сделали».

## Формат

Имя файла: `NNNN-короткое-название.md`, где NNNN — сквозной номер (0001, 0002, ...).

Шаблон:

\`\`\`markdown

# ADR-NNNN: Название решения

**Дата:** YYYY-MM-DD
**Статус:** Принято / Отвергнуто / Заменено ADR-XXXX

## Контекст

Что было до. Какая возникла проблема.

## Решение

Что решили сделать.

## Альтернативы

Что ещё рассматривали и почему отвергли.

## Последствия

Положительные и отрицательные эффекты от принятого решения.
\`\`\`

После создания ADR упоминай его в коммите: `feat: переход на pg_cron (см. ADR-0007)`.
```

---

## Поведение при отсутствии файла

Если в корне не найден какой-то из ожидаемых файлов (например, `08_business-people.md` ещё не пришёл из следующих сессий) — AI **не должен** падать. Он:

1. Создаёт нужную папку (если её ещё нет).
2. Пропускает раскладку этого файла.
3. В отчёте пишет: «не найден файл `08_business-people.md`, папка `docs/business/` создана, файл будет добавлен позже».

Это нормально, потому что часть файлов (источники правды и flows) ты получишь только в сессии 6.

---

## Что НЕ делать при раскладке

- ❌ Не удалять файлы, не указанные в манифесте.
- ❌ Не модифицировать содержимое файлов при перемещении.
- ❌ Не создавать `apps/`, `packages/`, `supabase/`, `scripts/` — это сделает TASK_01.
- ❌ Не запускать `git init` или `pnpm install` — это сделает TASK_01.

---

## Идемпотентность

Если AI запускает TASK_00 повторно (например, после ошибки):

- Файлы, которые уже на местах — не трогать.
- Файлы, которых ещё нет в нужной папке — переместить.
- Stubs, которые уже созданы — не перезаписывать.
- В отчёте указать, сколько файлов перемещено заново, сколько уже было на местах.
