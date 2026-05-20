/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/garage/orders/[id]/works — добавить работу в наряд (admin) */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const body = await request.json();
  const { work_catalog_id, custom_work_name, actual_minutes, price_client } = body as {
    work_catalog_id?: string;
    custom_work_name?: string;
    actual_minutes?: number;
    price_client?: string;
  };

  if (!work_catalog_id && !custom_work_name?.trim()) {
    return NextResponse.json({ error: 'Укажите вид работы' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch order to determine status and machine_type
  const { data: order, error: orderErr } = await (supabase.from('service_orders') as any)
    .select('id, lifecycle_status, machine_type')
    .eq('id', orderId)
    .single();
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  let normMinutes = 60;
  const isOwn = order.machine_type === 'own';

  if (work_catalog_id) {
    const { data: cat } = await (supabase.from('work_catalog') as any)
      .select('norm_minutes, norm_minutes_valdai')
      .eq('id', work_catalog_id)
      .single();
    if (cat) {
      normMinutes =
        isOwn && cat.norm_minutes_valdai ? cat.norm_minutes_valdai : (cat.norm_minutes ?? 60);
    }
  }

  // Price = norm_hours × hourly_rate; explicit price_client in body overrides
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
    clientPrice = ((normMinutes / 60) * rate).toFixed(2);
  }

  // For approved orders mark work as completed immediately
  const isApproved = order.lifecycle_status === 'approved';
  const workActualMinutes = actual_minutes ?? (isApproved ? normMinutes : null);

  const { data, error } = await (supabase.from('service_order_works') as any)
    .insert({
      service_order_id: orderId,
      work_catalog_id: work_catalog_id ?? null,
      custom_work_name: custom_work_name?.trim() ?? null,
      norm_minutes: normMinutes,
      actual_minutes: workActualMinutes,
      price_client: clientPrice,
      status: isApproved ? 'completed' : 'pending',
    })
    .select(
      'id, status, norm_minutes, actual_minutes, price_client, custom_work_name, work_catalog:work_catalog(id, name)',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
