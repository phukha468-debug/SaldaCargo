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

    // В MVP остаток считаем как заглушку или через movements
    // Для простоты добавим случайный остаток если в таблице нет поля stock
    const partsWithStock = parts.map((p) => ({
      ...p,
      stock: Math.floor(Math.random() * 10), // TODO: Реальный расчет из movements
    }));

    return NextResponse.json(partsWithStock);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
