/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface InventoryUpdateItem {
  id: string;
  actual_stock: number;
  purchase_price?: number;
  client_price?: number;
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const items: InventoryUpdateItem[] = body.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Список позиций пуст' }, { status: 400 });
    }

    const partIds = items.map((i) => i.id);

    // 1. Получаем все движения по этим деталям для вычисления текущего расчетного остатка
    const { data: movements, error: mvErr } = await (supabase.from('part_movements') as any)
      .select('part_id, direction, quantity')
      .in('part_id', partIds);

    if (mvErr) throw mvErr;

    const currentStockMap = new Map<string, number>();
    for (const m of movements || []) {
      const cur = currentStockMap.get(m.part_id) ?? 0;
      const qty = Number(m.quantity) || 0;
      currentStockMap.set(m.part_id, cur + (m.direction === 'in' ? qty : -qty));
    }

    // Дефолтный ID сотрудника (Шахмаев А.О или первый доступный)
    const { data: profiles } = await (supabase.from('profiles') as any).select('id').limit(1);
    const actorId = profiles?.[0]?.id || 'e9a1c980-eb1e-5c87-9f6d-c7f67eb28a1d';

    const movementsToInsert: any[] = [];
    const partsToUpdate: Array<{ id: string; purchase_price?: number; client_price?: number }> = [];

    for (const item of items) {
      const currentStock = Math.max(0, currentStockMap.get(item.id) ?? 0);
      const actualStock = Math.max(0, Number(item.actual_stock) || 0);
      const diff = actualStock - currentStock;

      if (diff > 0) {
        // Оприходование обнаруженного излишка
        movementsToInsert.push({
          part_id: item.id,
          direction: 'in',
          quantity: diff,
          unit_price: item.purchase_price !== undefined ? Number(item.purchase_price) : 0,
          notes: 'Инвентаризация: оприходование излишка',
          created_by: actorId,
        });
      } else if (diff < 0) {
        // Списание недостачи
        movementsToInsert.push({
          part_id: item.id,
          direction: 'out',
          quantity: Math.abs(diff),
          notes: 'Инвентаризация: списание недостачи',
          created_by: actorId,
        });
      }

      if (item.purchase_price !== undefined || item.client_price !== undefined) {
        partsToUpdate.push({
          id: item.id,
          ...(item.purchase_price !== undefined
            ? { purchase_price: Number(item.purchase_price) }
            : {}),
          ...(item.client_price !== undefined ? { client_price: Number(item.client_price) } : {}),
        });
      }
    }

    // Вставляем движения
    if (movementsToInsert.length > 0) {
      const { error: insErr } = await (supabase.from('part_movements') as any).insert(
        movementsToInsert,
      );
      if (insErr) throw insErr;
    }

    // Обновляем цены в карточках деталей
    for (const upd of partsToUpdate) {
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (upd.purchase_price !== undefined) updatePayload.purchase_price = upd.purchase_price;
      if (upd.client_price !== undefined) updatePayload.client_price = upd.client_price;

      await (supabase.from('parts') as any).update(updatePayload).eq('id', upd.id);
    }

    return NextResponse.json({
      success: true,
      adjustedCount: movementsToInsert.length,
      updatedPricesCount: partsToUpdate.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
