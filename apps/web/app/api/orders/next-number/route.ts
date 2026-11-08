/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export function parseOrderNumber(raw: string | number | null | undefined): number | null {
  if (!raw) return null;
  const str = String(raw).trim();
  // Очищаем префиксы "№ ", "ПЛ-26/", "Заявка № "
  const clean = str
    .replace(/^№\s*/, '')
    .replace(/^Заявка\s*№?\s*/i, '')
    .replace(/^ПЛ-\d+\//, '');
  // Если номер составной с годом, например 793/2026, берем первую часть
  const partBeforeSlash = (clean.split('/')[0] || '').trim();
  const num = parseInt(partBeforeSlash, 10);
  if (!isNaN(num) && num > 0 && num < 100000) {
    return num;
  }
  return null;
}

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Получаем максимальный номер рейса из таблицы trips
    const { data: maxTrip, error: tripErr } = await (supabase.from('trips') as any)
      .select('trip_number')
      .order('trip_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tripErr) {
      console.warn('Ошибка получения max trip_number:', tripErr.message);
    }

    const currentMaxTrip = maxTrip?.trip_number || 0;

    // 2. Получаем последние заявки из таблицы orders
    const { data: recentOrders, error: orderErr } = await (supabase.from('orders') as any)
      .select('base_doc_number, internal_order_number, order_number')
      .order('created_at', { ascending: false })
      .limit(50);

    if (orderErr) {
      console.warn('Ошибка получения recent orders:', orderErr.message);
    }

    let maxOrderNum = 0;
    for (const o of recentOrders || []) {
      const num1 = parseOrderNumber(o.base_doc_number);
      if (num1 && num1 > maxOrderNum) maxOrderNum = num1;
      const num2 = parseOrderNumber(o.internal_order_number);
      if (num2 && num2 > maxOrderNum) maxOrderNum = num2;
    }

    // Следующий номер рейса / заявки строго по очереди
    const nextNumber = Math.max(currentMaxTrip, maxOrderNum) + 1;

    return NextResponse.json({
      nextNumber,
      nextTripNumber: nextNumber,
      formatted: String(nextNumber),
      currentMaxTrip,
      maxOrderNum,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
