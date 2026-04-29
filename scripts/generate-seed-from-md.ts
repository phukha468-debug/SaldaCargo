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

  while (i < lines.length && lines[i].trim().startsWith('|')) {
    const cells = lines[i]
      .split('|')
      .map((c) => c.trim())
      .filter((c, idx) => idx > 0 && idx <= headers.length); // учитываем обрамляющие |

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
 * Извлекает секцию из MD файла между заголовком H2/H3 и следующим заголовком.
 */
function extractSection(content: string, sectionTitle: string): string {
  // Ищем заголовок любого уровня (## или ###), содержащий sectionTitle
  const lines = content.split('\n');
  const startIdx = lines.findIndex((l) => l.match(new RegExp(`^#{2,3}\\s+.*${sectionTitle}`, 'i')));

  if (startIdx === -1) return '';

  const sectionLines = [lines[startIdx]];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('##')) break; // новый заголовок — конец секции
    sectionLines.push(lines[i]);
  }

  return sectionLines.join('\n');
}

/**
 * Нормализует значение: если TODO — возвращает null.
 */
function val(v: string | undefined): string | null {
  if (!v || v.trim() === '' || v.trim().toUpperCase() === 'TODO') return null;
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

  const sections = [
    { title: 'Валдаи' },
    { title: 'Газели \\(основные' },
    { title: 'Газели \\(городские' },
    { title: 'Специальные' },
  ];

  lines.push('-- АКТИВЫ (МАШИНЫ)');
  lines.push('');

  for (const section of sections) {
    const sectionContent = extractSection(content, section.title);
    const assets = parseMarkdownTable(sectionContent, section.title);

    for (const asset of assets) {
      const regNumber = val(asset['reg_number']);
      const shortName = val(asset['short_name']) ?? regNumber ?? 'TODO';
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
