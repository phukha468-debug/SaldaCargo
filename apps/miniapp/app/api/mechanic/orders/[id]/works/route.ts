/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { getVerifiedMiniappSession, getVerifiedMiniappUserId } from '@/lib/auth/server';
import { DEFAULT_ORGANIZATION_ID } from '@saldacargo/shared';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const body = await request.json();
  const supabase = createAdminClient();

  const session = await getVerifiedMiniappSession();
  const userId = session?.uid || body.mechanic_id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: order }, { data: sto }] = await Promise.all([
    (supabase.from('service_orders') as any)
      .select('id, machine_type, organization_id')
      .eq('id', orderId)
      .maybeSingle(),
    (supabase.from('sto_settings') as any)
      .select('hourly_rate, hourly_rate_own')
      .limit(1)
      .maybeSingle(),
  ]);

  const organizationId = order?.organization_id || session?.oid || DEFAULT_ORGANIZATION_ID;
  const isOwn = order?.machine_type === 'own';
  const rateClient = parseFloat(sto?.hourly_rate ?? '2000') || 2000;
  const rateOwn = parseFloat(sto?.hourly_rate_own ?? '1600') || 1600;
  const hourlyRate = isOwn ? rateOwn : rateClient;

  // Механики в MiniApp вводят только перечень работ; время выставляет директор/приёмщик (по умолчанию 0)
  const minutes = Math.max(
    0,
    Math.round(Number(body.minutes ?? body.actual_minutes ?? body.norm_minutes ?? 0) || 0),
  );

  const priceClient = minutes > 0 ? ((minutes / 60) * hourlyRate).toFixed(2) : '0.00';
  const markCompleted = body.completed !== false;

  const cleanCategory = body.category?.trim() || null;
  const cleanNotes = cleanCategory ? `[category:${cleanCategory}]` : null;
  let workDateIso = new Date().toISOString();
  if (body.work_date) {
    const d = new Date(body.work_date);
    if (!isNaN(d.getTime())) workDateIso = d.toISOString();
  } else if (body.created_at) {
    const d = new Date(body.created_at);
    if (!isNaN(d.getTime())) workDateIso = d.toISOString();
  }

  const { data, error } = await (supabase.from('service_order_works') as any)
    .insert({
      organization_id: organizationId,
      service_order_id: orderId,
      work_catalog_id: body.work_catalog_id ?? null,
      custom_work_name: body.custom_work_name?.trim() ?? null,
      custom_work_description: cleanCategory,
      notes: cleanNotes,
      created_at: workDateIso,
      norm_minutes: minutes,
      actual_minutes: minutes,
      price_client: priceClient,
      quantity: 1,
      status: markCompleted ? 'completed' : 'pending',
      mechanic_id: body.mechanic_id || userId,
      second_mechanic_id: body.second_mechanic_id || null,
    })
    .select(
      'id, custom_work_name, custom_work_description, notes, created_at, status, norm_minutes, actual_minutes, price_client, quantity, work_catalog:work_catalog(id, name, norm_minutes)',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const workId = searchParams.get('work_id');
  if (!workId) {
    return NextResponse.json({ error: 'work_id required' }, { status: 400 });
  }

  const userId = await getVerifiedMiniappUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  await (supabase.from('work_time_logs') as any).delete().eq('service_order_work_id', workId);
  const { error } = await (supabase.from('service_order_works') as any).delete().eq('id', workId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
