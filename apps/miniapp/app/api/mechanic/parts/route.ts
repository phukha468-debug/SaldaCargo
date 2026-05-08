/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  try {
    const supabase = createAdminClient();
    let query = supabase
      .from('parts')
      .select('id, name, article, unit, min_stock, is_active')
      .eq('is_active', true);

    if (search) {
      query = query.or(`name.ilike.%${search}%,article.ilike.%${search}%`);
    }

    const { data, error } = await query.limit(50);
    if (error) throw error;

    const parts = (data || []) as any[];

    // Считаем остаток через SUM(in) - SUM(out) из part_movements
    const { data: movements } = await (supabase as any)
      .from('part_movements')
      .select('part_id, direction, quantity')
      .in(
        'part_id',
        parts.map((p) => p.id),
      );

    const stockMap = new Map<string, number>();
    for (const m of movements ?? []) {
      const cur = stockMap.get(m.part_id) ?? 0;
      stockMap.set(
        m.part_id,
        cur + (m.direction === 'in' ? Number(m.quantity) : -Number(m.quantity)),
      );
    }

    const partsWithStock = parts.map((p) => ({
      ...p,
      stock: Math.max(0, stockMap.get(p.id) ?? 0),
    }));

    return NextResponse.json(partsWithStock);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
