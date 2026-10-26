/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() || '';
  const brand = searchParams.get('brand') || 'all'; // 'all' | 'gazelle' | 'valday' | 'canter' | 'consumables'

  try {
    const supabase = createAdminClient();
    let query = (supabase.from('parts') as any)
      .select(
        'id, article, name, category, unit, min_stock, purchase_price, client_price, is_active, created_at, updated_at',
      )
      .eq('is_active', true);

    if (brand && brand !== 'all') {
      query = query.eq('category', brand);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,article.ilike.%${search}%`);
    }

    query = query.order('name', { ascending: true });

    const { data: parts, error } = await query;
    if (error) throw error;

    const partsList = (parts || []) as any[];
    if (partsList.length === 0) {
      return NextResponse.json({
        parts: [],
        totals: { totalPositions: 0, totalStockVal: 0, totalClientVal: 0, lowStockCount: 0 },
      });
    }

    // Движения со склада для расчёта остатка
    const { data: movements, error: mvErr } = await (supabase.from('part_movements') as any)
      .select('part_id, direction, quantity, unit_price')
      .in(
        'part_id',
        partsList.map((p) => p.id),
      );

    if (mvErr) throw mvErr;

    const stockMap = new Map<string, number>();
    for (const m of movements || []) {
      const cur = stockMap.get(m.part_id) ?? 0;
      const qty = Number(m.quantity) || 0;
      stockMap.set(m.part_id, cur + (m.direction === 'in' ? qty : -qty));
    }

    let totalStockVal = 0;
    let totalClientVal = 0;
    let lowStockCount = 0;

    const enrichedParts = partsList.map((p) => {
      const stock = Math.max(0, stockMap.get(p.id) ?? 0);
      const purchasePrice = Number(p.purchase_price) || 0;
      const clientPrice = Number(p.client_price) || Math.round(purchasePrice * 1.3);
      const isLow = stock <= (Number(p.min_stock) || 0);

      totalStockVal += stock * purchasePrice;
      totalClientVal += stock * clientPrice;
      if (isLow && stock > 0) lowStockCount++;

      return {
        ...p,
        stock,
        purchase_price: purchasePrice,
        client_price: clientPrice,
        is_low: isLow,
        stock_total_cost: stock * purchasePrice,
        stock_total_client: stock * clientPrice,
      };
    });

    return NextResponse.json({
      parts: enrichedParts,
      totals: {
        totalPositions: enrichedParts.length,
        totalStockVal,
        totalClientVal,
        lowStockCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Создание новой запчасти в номенклатуре + приход остатка ──
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const {
      name,
      article,
      brand = 'gazelle',
      unit = 'шт',
      purchase_price = 0,
      client_price,
      initial_stock = 0,
      min_stock = 1,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Укажите название запчасти' }, { status: 400 });
    }

    const pPrice = Math.max(0, parseFloat(String(purchase_price)) || 0);
    const cPrice =
      client_price !== undefined && client_price !== null && String(client_price).trim() !== ''
        ? Math.max(0, parseFloat(String(client_price)) || 0)
        : Math.round(pPrice * 1.3);

    // 1. Создаём запись в parts
    const { data: newPart, error: partErr } = await (supabase.from('parts') as any)
      .insert({
        name: name.trim(),
        article: article?.trim() || null,
        category: brand,
        unit: (unit || 'шт').trim(),
        purchase_price: pPrice,
        client_price: cPrice,
        min_stock: parseFloat(String(min_stock)) || 0,
        is_active: true,
      })
      .select()
      .single();

    if (partErr) throw partErr;

    // 2. Если указан стартовый остаток, записываем его в part_movements
    const initStock = parseFloat(String(initial_stock)) || 0;
    if (initStock > 0) {
      // Ищем любого админа для authoring
      const { data: adminUser } = await (supabase.from('users') as any)
        .select('id')
        .contains('roles', ['admin'])
        .limit(1)
        .single();

      const createdBy = adminUser?.id || 'e9a1c980-eb1e-5c87-9f6d-c7f67eb28a1d';

      await (supabase.from('part_movements') as any).insert({
        part_id: newPart.id,
        direction: 'in',
        quantity: initStock,
        unit_price: pPrice,
        notes: 'Начальный остаток при инвентаризации склада',
        created_by: createdBy,
      });
    }

    return NextResponse.json(newPart, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
