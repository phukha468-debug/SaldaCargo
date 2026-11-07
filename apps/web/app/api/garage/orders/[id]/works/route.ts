/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/garage/orders/[id]/works — добавить работу в наряд (admin) */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const body = await request.json();
  const {
    work_catalog_id,
    custom_work_name,
    actual_minutes,
    norm_minutes: bodyNormMinutes,
    price_client,
    quantity,
    work_date,
    created_at,
    category,
    mechanic_id,
    second_mechanic_id,
  } = body as {
    work_catalog_id?: string;
    custom_work_name?: string;
    actual_minutes?: number;
    norm_minutes?: number;
    price_client?: string;
    quantity?: number;
    work_date?: string;
    created_at?: string;
    category?: string;
    mechanic_id?: string;
    second_mechanic_id?: string;
  };

  if (!work_catalog_id && !custom_work_name?.trim()) {
    return NextResponse.json({ error: 'Укажите вид работы' }, { status: 400 });
  }

  const qty = Math.max(1, Math.round(quantity ?? 1));
  const supabase = createAdminClient();

  // Fetch order to determine status and machine_type
  const { data: order, error: orderErr } = await (supabase.from('service_orders') as any)
    .select('id, lifecycle_status, machine_type, assigned_mechanic_id')
    .eq('id', orderId)
    .single();
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  let normMinutes = bodyNormMinutes ?? 60;
  const isOwn = order.machine_type === 'own';

  let catalogDescription: string | null = null;
  if (work_catalog_id) {
    const { data: cat } = await (supabase.from('work_catalog') as any)
      .select('norm_minutes, norm_minutes_valdai, description')
      .eq('id', work_catalog_id)
      .single();
    if (cat) {
      normMinutes =
        isOwn && cat.norm_minutes_valdai ? cat.norm_minutes_valdai : (cat.norm_minutes ?? 60);
      catalogDescription = cat.description ?? null;
    }
  }

  // Price = norm_hours × quantity × hourly_rate; explicit price_client in body overrides
  let clientPrice: string;
  if (price_client) {
    clientPrice = price_client;
  } else {
    const { data: sto } = await (supabase.from('sto_settings') as any)
      .select('hourly_rate, hourly_rate_own')
      .limit(1)
      .single();
    const rate = parseFloat(
      isOwn ? (sto?.hourly_rate_own ?? '1600') : (sto?.hourly_rate ?? '2000'),
    );
    clientPrice = (((normMinutes * qty) / 60) * rate).toFixed(2);
  }

  // Определяем дату выполнения работы
  let workDateIso = new Date().toISOString();
  if (work_date) {
    const d = new Date(work_date);
    if (!isNaN(d.getTime())) {
      workDateIso = d.toISOString();
    }
  } else if (created_at) {
    const d = new Date(created_at);
    if (!isNaN(d.getTime())) {
      workDateIso = d.toISOString();
    }
  }

  const cleanCategory = category?.trim() || null;
  const cleanNotes = cleanCategory ? `[category:${cleanCategory}]` : null;

  // Works always start as pending — mechanic or admin marks them done separately
  const { data, error } = await (supabase.from('service_order_works') as any)
    .insert({
      service_order_id: orderId,
      work_catalog_id: work_catalog_id ?? null,
      custom_work_name: custom_work_name?.trim() ?? null,
      custom_work_description: cleanCategory,
      notes: cleanNotes,
      created_at: workDateIso,
      norm_minutes: normMinutes,
      actual_minutes: actual_minutes ?? null,
      price_client: clientPrice,
      quantity: qty,
      status: 'pending',
      work_description: catalogDescription,
      mechanic_id: mechanic_id ?? order.assigned_mechanic_id ?? null,
      second_mechanic_id: second_mechanic_id ?? null,
    })
    .select(
      'id, status, quantity, norm_minutes, actual_minutes, price_client, custom_work_name, custom_work_description, notes, created_at, mechanic_id, second_mechanic_id, work_catalog:work_catalog(id, name)',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
