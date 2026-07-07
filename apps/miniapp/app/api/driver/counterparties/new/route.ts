/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/**
 * POST /api/driver/counterparties/new — создать нового клиента (с проверкой дублей)
 *
 * Улучшенная проверка:
 * - Нормализация имени (trim + collapse spaces)
 * - Fuzzy-поиск: ищет имена, СОДЕРЖАЩИЕ введённый текст (а не только точное совпадение)
 * - Возвращает найденные дубли с is_legal_entity для корректного отображения
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { name: string; type?: string; is_legal_entity?: boolean };

  // Нормализация: trim + схлопнуть множественные пробелы
  const name = body.name?.trim().replace(/\s+/g, ' ');
  if (!name) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });

  const supabase = createAdminClient();

  // Проверка дубликатов — ищем содержание (fuzzy), не точное совпадение
  // Пример: ввод "УВС" найдёт "УВС", "увс", "УВС Транспорт", "ООО УВС"
  const { data: existing } = await (supabase as any)
    .from('counterparties')
    .select('id, name, phone, is_active, is_legal_entity')
    .ilike('name', `%${name}%`)
    .in('type', ['client', 'both'])
    .limit(5);

  if (existing && existing.length > 0) {
    // Среди найденных ищем точное совпадение (нормализованное)
    const exactMatch = existing.find(
      (e: any) => e.name.trim().replace(/\s+/g, ' ').toLowerCase() === name.toLowerCase(),
    );

    if (exactMatch) {
      // Точный дубль — жёсткий отказ
      return NextResponse.json(
        {
          error: 'duplicate',
          message: `Клиент «${exactMatch.name}» уже существует`,
          existing: [exactMatch],
        },
        { status: 409 },
      );
    }

    // Нет точного, но есть похожие — предупреждение с возможностью продолжить
    return NextResponse.json(
      {
        error: 'similar',
        message: `Найдены похожие клиенты — проверьте, может это тот же`,
        existing,
      },
      { status: 409 },
    );
  }

  // Нет дублей — создаём
  const { data, error } = await (supabase as any)
    .from('counterparties')
    .insert({
      name,
      type: body.type || 'client',
      is_active: true,
      is_legal_entity: body.is_legal_entity ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
