/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/**
 * GET /api/driver/counterparties — список клиентов для водителя
 *
 * Возвращает:
 * - Все активные клиенты (type = client | both)
 * - Поля: id, name, is_legal_entity, is_regular, order_count
 * - Сортировка: постоянные (is_regular) первыми, затем по order_count DESC, затем по имени
 * - Топ-10 (is_top) помечаются для отображения чипами
 * - Дедупликация по имени (case-insensitive)
 */
export async function GET() {
  const supabase = createAdminClient();

  // 1. Все активные клиенты
  const { data: clients, error } = await (supabase
    .from('counterparties')
    .select('id, name, is_legal_entity, is_regular')
    .in('type', ['client', 'both'])
    .eq('is_active', true)
    .order('name') as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. Количество заказов по каждому контрагенту (approved/draft, не cancelled)
  const { data: orderCounts } = await (
    supabase.from('trip_orders').select('counterparty_id') as any
  )
    .neq('lifecycle_status', 'cancelled')
    .not('counterparty_id', 'is', null);

  // Подсчитать количество заказов для каждого counterparty_id
  const countMap = new Map<string, number>();
  if (orderCounts) {
    for (const row of orderCounts) {
      const cid = row.counterparty_id;
      countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
    }
  }

  // 3. Дедупликация по имени (case-insensitive, trimmed)
  const seen = new Set<string>();
  const deduped = (clients ?? []).filter((c: any) => {
    const key = c.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 4. Добавить order_count и отсортировать
  const enriched = deduped.map((c: any) => ({
    ...c,
    order_count: countMap.get(c.id) ?? 0,
  }));

  // Сортировка: по количеству заказов (убывание), затем по имени
  const GENERIC_ID = '30fef3ce-2bf2-48fa-9b6e-5d1b7b94459a';
  enriched.sort((a: any, b: any) => {
    if (a.id === GENERIC_ID) return -1;
    if (b.id === GENERIC_ID) return 1;
    if (b.order_count !== a.order_count) return b.order_count - a.order_count;
    return a.name.localeCompare(b.name, 'ru');
  });

  // 5. Пометить топ-10 (для чипов)
  const result = enriched.map((c: any, idx: number) => ({
    ...c,
    is_top: idx < 10,
  }));

  return NextResponse.json(result);
}
