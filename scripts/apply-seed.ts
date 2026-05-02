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
      // Исправлено: используем 'db query' с флагом '--file' и '--linked' для удаленной БД
      execSync(`npx supabase db query --file "${filePath}" --linked`, { stdio: 'inherit', cwd: ROOT });
    } catch (err) {
      console.warn(
        `⚠️  Не удалось применить файл ${file} через CLI. Возможно, CLI не настроен или нет доступа к БД.`,
      );
      console.info(
        `💡 Ты можешь применить этот файл вручную через Supabase Dashboard -> SQL Editor: ${filePath}`,
      );
    }
  }

  console.log('\n✅ Процесс завершен (проверь ворнинги выше если были)!');
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
