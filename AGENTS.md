# Правила и стандарты разработки SALDA (PRO B2B SaaS)

Единый источник истины для всех AI-агентов (Antigravity, Claude Code, Gemini, Cursor) находится в директории **`.agent/rules/`**:

- [00-core-product-scope.md](./.agent/rules/00-core-product-scope.md) — PRO B2B SaaS, 152-ФЗ, запрет хардкода ТК501, **заморозка `apps/android`**.
- [01-architecture-modularity.md](./.agent/rules/01-architecture-modularity.md) — модульный конструктор (Feature Flags), единый слой `packages/service`, абстрактные адаптеры интеграций, запрет `any`, Next.js 16.
- [02-security-multitenancy.md](./.agent/rules/02-security-multitenancy.md) — Multi-tenancy (`organization_id`), строгий RLS, RBAC, Zod-валидация, защита секретов и TLS.
- [03-domain-invariants.md](./.agent/rules/03-domain-invariants.md) — финансовые и доменные инварианты (двухосный статус транзакций, динамические балансы, деньги строкой, ручная ЗП, soft-delete, идемпотентность).
- [04-ui-density-ux.md](./.agent/rules/04-ui-density-ux.md) — Dense 1-Line Layout (Web + MiniApp + Боты) и языковые конвенции.
- [05-workflow-hygiene.md](./.agent/rules/05-workflow-hygiene.md) — Plan First (Implementation Plan до кода), Minimal Diff, Context Hygiene, миграции БД и база знаний `kb/wiki/`.

Стратегический аудит и дорожная карта: [AUDIT_AND_ROADMAP.md](./AUDIT_AND_ROADMAP.md).
