# TASK 09: Seed-скрипт — генерация данных из Markdown

**Адресат:** Claude Code.
**Длительность:** 60–90 минут.
**Зависимости:** TASK_08 выполнен (все таблицы БД созданы).

---

## Цель

Создать скрипт `scripts/generate-seed-from-md.ts` который:

1. Читает `docs/business/fleet.md` и `docs/business/people.md`
2. Парсит таблицы Markdown
3. Генерирует SQL INSERT файлы в `supabase/seed/`
4. Применяет seed к БД

Также создать `supabase/seed/00-base-data.sql` — статические данные которые не парсятся из MD (юрлицо, кошельки, категории транзакций).

**Принцип Data as Code:**

- `docs/business/*.md` — единственный источник правды
- Редактируешь MD → запускаешь скрипт → БД обновляется
- Строки с `TODO` значениями → вставляются с `NULL` или флагом `needs_update = true`

---

## Алгоритм

### Шаг 1. Установить зависимости для скрипта

```powershell
pnpm add -D tsx @types/node --workspace-root
```

`tsx` уже должен быть из TASK_01 — проверь, не дублируй.

### Шаг 2. Создать `supabase/seed/00-base-data.sql`

Это статические данные — не парсятся из MD, применяются первыми.

```sql
-- ============================================================
-- SaldaCargo — Базовые данные (статические)
-- Применяется первым, перед данными из MD
-- ============================================================

-- Юрлицо
INSERT INTO legal_entities (id, name, type, inn, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ИП Нигамедьянов А.С.',
  'ip',
  NULL, -- TODO: заполнить ИНН
  true
) ON CONFLICT (id) DO NOTHING;

-- Кошельки компании
INSERT INTO wallets (id, name, type, legal_entity_id, is_active) VALUES
  (
    '00000000-0000-0000-0001-000000000001',
    'Р/с ИП',
    'bank_account',
    '00000000-0000-0000-0000-000000000001',
    true
  ),
  (
    '00000000-0000-0000-0001-000000000002',
    'Касса офиса',
    'cash_register',
    '00000000-0000-0000-0000-000000000001',
    true
  ),
  (
    '00000000-0000-0000-0001-000000000003',
    'Личный карман Владельца',
    'owner_personal',
    '00000000-0000-0000-0000-000000000001',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Типы активов
INSERT INTO asset_types (id, code, name, capacity_m, has_gps, requires_odometer_photo) VALUES
  ('00000000-0000-0000-0002-000000000001', 'valdai_6m',   'Валдай 6м',           6.0, false, false),
  ('00000000-0000-0000-0002-000000000002', 'valdai_5m',   'Валдай 5м',           5.0, false, false),
  ('00000000-0000-0000-0003-000000000001', 'valdai_dump', 'Валдай-самосвал',     6.0, false, false),
  ('00000000-0000-0000-0002-000000000004', 'gazelle_4m',  'Газель 4м (Некст)',   4.0, false, true),
  ('00000000-0000-0000-0002-000000000005', 'gazelle_3m',  'Газель 3м',           3.0, false, true),
  ('00000000-0000-0000-0002-000000000006', 'gazelle_project', 'Газель-проект',   3.0, false, true),
  ('00000000-0000-0000-0002-000000000007', 'canter',      'Митсубиси Кантер 5т', 5.0, false, true)
ON CONFLICT (id) DO NOTHING;
```

### Шаг 3. Создать скрипт `scripts/generate-seed-from-md.ts`

```typescript
#!/usr/bin/env tsx
/**
 * generate-seed-from-md.ts
 *
 * Читает docs/business/fleet.md и docs/business/people.md,
 * парсит Markdown-таблицы и генерирует SQL seed файлы.
 *
 * Запуск: pnpm seed:generate
 * После генерации: pnpm seed:apply
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const ROOT = join(__dirname, '..');
const DOCS_DIR = join(ROOT, 'docs', 'business');
const SEED_DIR = join(ROOT, 'supabase', 'seed');

// ─── Парсинг Markdown таблиц ──────────────────────────────────────────────

/**
 * Парсит Markdown таблицу в массив объектов.
 * Первая строка — заголовки, остальные — данные.
 */
function parseMarkdownTable(markdown: string, tableName: string): Record<string, string>[] {
  const lines = markdown.split('\n');
  const tableStart = lines.findIndex(
    (l) => l.includes('|') && lines[lines.indexOf(l) + 1]?.includes('---'),
  );

  if (tableStart === -1) {
    console.warn(`⚠️  Таблица не найдена в секции: ${tableName}`);
    return [];
  }

  const headerLine = lines[tableStart];
  const headers = headerLine
    .split('|')
    .map((h) => h.trim())
    .filter(Boolean);

  const rows: Record<string, string>[] = [];
  let i = tableStart + 2; // пропускаем заголовок и разделитель

  while (i < lines.length && lines[i].includes('|')) {
    const cells = lines[i]
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);

    if (cells.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = cells[idx] ?? '';
      });
      rows.push(row);
    }
    i++;
  }

  return rows;
}

/**
 * Извлекает секцию из MD файла между заголовком H3 и следующим заголовком.
 */
function extractSection(content: string, sectionTitle: string): string {
  const startPattern = new RegExp(`### ${sectionTitle}[\\s\\S]*?(?=###|##|$)`);
  const match = content.match(startPattern);
  return match ? match[0] : '';
}

/**
 * Нормализует значение: если TODO — возвращает null.
 */
function val(v: string | undefined): string | null {
  if (!v || v.trim() === '' || v.startsWith('TODO')) return null;
  return v.trim();
}

/**
 * Экранирует строку для SQL.
 */
function sqlStr(v: string | null): string {
  if (v === null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

// ─── Генератор: fleet.md → 02-fleet.sql ──────────────────────────────────

function generateFleetSeed(): string {
  console.log('📖 Читаю docs/business/fleet.md...');
  const content = readFileSync(join(DOCS_DIR, 'fleet.md'), 'utf-8');

  const lines: string[] = [
    '-- ============================================================',
    '-- АВТОГЕНЕРАЦИЯ из docs/business/fleet.md',
    `-- Сгенерировано: ${new Date().toISOString()}`,
    '-- НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ — редактируй fleet.md',
    '-- ============================================================',
    '',
  ];

  // Парсим Валдаи
  const valdaiSection = extractSection(content, 'Валдаи');
  const valdais = parseMarkdownTable(valdaiSection, 'Валдаи');

  // Парсим Газели основные
  const gazelleMainSection = extractSection(content, 'Газели \\(основные');
  const gazellesMain = parseMarkdownTable(gazelleMainSection, 'Газели основные');

  // Парсим Газели городские
  const gazelleCitySection = extractSection(content, 'Газели \\(городские');
  const gazelleCities = parseMarkdownTable(gazelleCitySection, 'Газели городские');

  // Парсим Специальные
  const specialSection = extractSection(content, 'Специальные');
  const specials = parseMarkdownTable(specialSection, 'Специальные');

  const allAssets = [...valdais, ...gazellesMain, ...gazelleCities, ...specials];

  lines.push('-- АКТИВЫ (МАШИНЫ)');
  lines.push('');

  for (const asset of allAssets) {
    const regNumber = val(asset['reg_number']);
    const shortName = val(asset['short_name']) ?? val(asset['reg_number']) ?? 'TODO';
    const assetTypeCode = val(asset['asset_type_code']);
    const status = val(asset['status']) ?? 'active';
    const needsUpdate = !regNumber || regNumber.startsWith('TODO');
    const displayReg = needsUpdate ? `PLACEHOLDER_${shortName}` : regNumber!;

    lines.push(`-- ${shortName}: ${val(asset['notes']) ?? ''}`);
    lines.push(`INSERT INTO assets (
  id, reg_number, short_name, asset_type_id, status,
  odometer_current, current_book_value, legal_entity_id,
  needs_update, notes
) VALUES (
  uuid_generate_v4(),
  ${sqlStr(displayReg)},
  ${sqlStr(shortName)},
  (SELECT id FROM asset_types WHERE code = ${sqlStr(assetTypeCode)}),
  ${sqlStr(status)},
  0,
  0,
  '00000000-0000-0000-0000-000000000001',
  ${needsUpdate},
  ${sqlStr(val(asset['notes']))}
) ON CONFLICT (reg_number) DO UPDATE SET
  status = EXCLUDED.status,
  needs_update = EXCLUDED.needs_update,
  updated_at = now();`);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Генератор: people.md → 01-people.sql ────────────────────────────────

function generatePeopleSeed(): string {
  console.log('📖 Читаю docs/business/people.md...');
  const content = readFileSync(join(DOCS_DIR, 'people.md'), 'utf-8');

  const lines: string[] = [
    '-- ============================================================',
    '-- АВТОГЕНЕРАЦИЯ из docs/business/people.md',
    `-- Сгенерировано: ${new Date().toISOString()}`,
    '-- НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ — редактируй people.md',
    '-- ============================================================',
    '',
  ];

  const sections = [
    { title: 'Владелец / Управление', defaultRoles: ['owner'] },
    { title: 'Водители Валдаев', defaultRoles: ['driver'] },
    { title: 'Водители Газелей \\(основные', defaultRoles: ['driver'] },
    { title: 'Водители Газелей \\(городские', defaultRoles: ['driver'] },
    { title: 'Механики', defaultRoles: ['mechanic'] },
    { title: 'Грузчики', defaultRoles: ['loader'] },
  ];

  lines.push('-- ПОЛЬЗОВАТЕЛИ');
  lines.push('');

  for (const section of sections) {
    const sectionContent = extractSection(content, section.title);
    const people = parseMarkdownTable(sectionContent, section.title);

    for (const person of people) {
      const name = val(person['name']);
      if (!name || name === 'TODO') continue;

      const maxUserId = val(person['max_user_id']);
      const phone = val(person['phone']);
      const role = val(person['role']) ?? section.defaultRoles[0];
      const isActive = !!maxUserId; // активен только если привязан к МАХ
      const notes = val(person['notes']);
      const assignedReg = val(person['assigned_reg']);

      lines.push(`-- ${name} (${role})`);
      lines.push(`DO $$
DECLARE
  v_user_id UUID;
  v_asset_id UUID;
BEGIN
  -- Upsert пользователя по имени (до привязки MAX)
  INSERT INTO users (id, name, phone, max_user_id, roles, is_active, notes)
  VALUES (
    uuid_generate_v4(),
    ${sqlStr(name)},
    ${sqlStr(phone)},
    ${sqlStr(maxUserId)},
    ARRAY[${sqlStr(role)}]::user_role[],
    ${isActive},
    ${sqlStr(notes)}
  )
  ON CONFLICT (max_user_id) WHERE max_user_id IS NOT NULL
  DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    roles = EXCLUDED.roles,
    is_active = EXCLUDED.is_active,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM users WHERE name = ${sqlStr(name)} LIMIT 1;
  END IF;

  -- Привязать машину если указана
  ${
    assignedReg
      ? `SELECT id INTO v_asset_id FROM assets WHERE short_name = ${sqlStr(assignedReg)} OR reg_number = ${sqlStr(assignedReg)} LIMIT 1;
  IF v_asset_id IS NOT NULL THEN
    UPDATE users SET current_asset_id = v_asset_id WHERE id = v_user_id;
    UPDATE assets SET assigned_driver_id = v_user_id WHERE id = v_asset_id;
  END IF;`
      : '-- нет закреплённой машины'
  }

  -- Подотчётный кошелёк для водителей
  ${
    role === 'driver'
      ? `INSERT INTO wallets (name, type, owner_user_id, legal_entity_id, is_active)
  SELECT
    'Подотчёт ' || ${sqlStr(name)},
    'driver_accountable',
    v_user_id,
    '00000000-0000-0000-0000-000000000001',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM wallets WHERE owner_user_id = v_user_id AND type = 'driver_accountable'
  );`
      : '-- подотчёт не нужен'
  }
END $$;`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ─── Главная функция ──────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Генерация seed файлов из Markdown...\n');

  mkdirSync(SEED_DIR, { recursive: true });

  // Генерируем people (должен идти перед fleet из-за FK)
  const peopleSql = generatePeopleSeed();
  const peopleFile = join(SEED_DIR, '01-people.sql');
  writeFileSync(peopleFile, peopleSql);
  console.log(`✅ Сгенерирован: supabase/seed/01-people.sql`);

  // Генерируем fleet
  const fleetSql = generateFleetSeed();
  const fleetFile = join(SEED_DIR, '02-fleet.sql');
  writeFileSync(fleetFile, fleetSql);
  console.log(`✅ Сгенерирован: supabase/seed/02-fleet.sql`);

  console.log('\n🎉 Готово! Теперь запусти: pnpm seed:apply');
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
```

### Шаг 4. Создать `scripts/apply-seed.ts`

```typescript
#!/usr/bin/env tsx
/**
 * apply-seed.ts
 *
 * Применяет seed файлы к Supabase БД в правильном порядке.
 * Сначала генерирует SQL из MD, потом применяет.
 *
 * Запуск: pnpm seed:apply
 */

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const SEED_DIR = join(ROOT, 'supabase', 'seed');

async function main() {
  console.log('🌱 Применяю seed к БД...\n');

  // Сначала генерируем актуальные SQL из MD
  console.log('1️⃣  Генерирую SQL из Markdown...');
  execSync('tsx scripts/generate-seed-from-md.ts', { stdio: 'inherit', cwd: ROOT });

  // Получаем все SQL файлы в порядке
  const files = readdirSync(SEED_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // 00-*, 01-*, 02-* — по имени

  console.log(`\n2️⃣  Применяю ${files.length} файлов...`);

  for (const file of files) {
    const filePath = join(SEED_DIR, file);
    console.log(`   → ${file}`);
    try {
      execSync(`supabase db execute --file "${filePath}"`, { stdio: 'inherit', cwd: ROOT });
    } catch (err) {
      console.error(`❌ Ошибка в файле ${file}`);
      throw err;
    }
  }

  console.log('\n✅ Seed применён успешно!');
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
```

### Шаг 5. Обновить скрипты в корневом `package.json`

Найди секцию `scripts` и обнови/добавь:

```json
"seed:generate": "tsx scripts/generate-seed-from-md.ts",
"seed:apply": "tsx scripts/apply-seed.ts"
```

### Шаг 6. Удалить `.gitkeep` из scripts/

```powershell
Remove-Item C:\salda\scripts\.gitkeep
```

### Шаг 7. Запустить и проверить

```powershell
# Сначала только генерация (без применения к БД)
pnpm seed:generate

# Проверить что файлы созданы
ls supabase/seed/
# Должны быть: 00-base-data.sql, 01-people.sql, 02-fleet.sql

# Применить к БД
pnpm seed:apply
```

Проверь в Supabase Dashboard → Table Editor что данные появились:

- `asset_types`: 7 записей
- `assets`: 12 записей (некоторые с `needs_update = true`)
- `users`: записи для всех из people.md
- `wallets`: кошельки компании + подотчёты водителей

### Шаг 8. Коммит

```powershell
git add .
git commit -m "feat: seed скрипт — Data as Code из Markdown

- scripts/generate-seed-from-md.ts: парсит fleet.md и people.md
- scripts/apply-seed.ts: применяет seed к БД
- supabase/seed/00-base-data.sql: юрлицо, кошельки, типы активов
- supabase/seed/01-people.sql: автогенерация (не коммитится)
- supabase/seed/02-fleet.sql: автогенерация (не коммитится)
- Строки с TODO → NULL + needs_update = true"
git push
```

> **Примечание:** добавь `supabase/seed/01-people.sql` и `supabase/seed/02-fleet.sql`
> в `.gitignore` — они генерируются автоматически и не должны коммититься.
> Только `00-base-data.sql` коммитится как статический файл.

---

## Критерии приёмки

- [ ] `scripts/generate-seed-from-md.ts` создан и работает
- [ ] `scripts/apply-seed.ts` создан
- [ ] `supabase/seed/00-base-data.sql` создан и закоммичен
- [ ] `pnpm seed:generate` создаёт `01-people.sql` и `02-fleet.sql`
- [ ] `pnpm seed:apply` применяет seed без ошибок
- [ ] В Supabase: asset_types = 7 записей, assets = 12, users > 0
- [ ] Подотчётные кошельки созданы для каждого водителя
- [ ] `scripts/.gitkeep` удалён
- [ ] Коммит и push выполнены

---

## Отчёт

```
✅ TASK_09 выполнено

Seed файлы:
- 00-base-data.sql: статический ✓
- 01-people.sql: автогенерация ✓ (X записей)
- 02-fleet.sql: автогенерация ✓ (X записей)

БД после seed:
- asset_types: 7
- assets: 12
- users: X
- wallets: X

Команды:
- pnpm seed:generate ✓
- pnpm seed:apply ✓

Git: push успешно
```
