/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const body = await request.json();
  const supabase = createAdminClient();

  const cookieStore = await cookies();
  const userId =
    cookieStore.get('salda_user_id')?.value ||
    request.headers.get('x-salda-user-id') ||
    body.mechanic_id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: order }, { data: sto }] = await Promise.all([
    (supabase.from('service_orders') as any)
      .select('id, machine_type')
      .eq('id', orderId)
      .maybeSingle(),
    (supabase.from('sto_settings') as any)
      .select('hourly_rate, hourly_rate_own')
      .limit(1)
      .maybeSingle(),
  ]);

  const isOwn = order?.machine_type === 'own';
  const rateClient = parseFloat(sto?.hourly_rate ?? '2000') || 2000;
  const rateOwn = parseFloat(sto?.hourly_rate_own ?? '1600') || 1600;
  const hourlyRate = isOwn ? rateOwn : rateClient;

  let minutes = Number(body.minutes ?? body.actual_minutes ?? body.norm_minutes ?? 0);
  if (body.work_catalog_id && (!minutes || minutes <= 0)) {
    const { data: cat } = await (supabase.from('work_catalog') as any)
      .select('norm_minutes, norm_minutes_valdai')
      .eq('id', body.work_catalog_id)
      .maybeSingle();
    if (cat) {
      minutes =
        isOwn && cat.norm_minutes_valdai ? cat.norm_minutes_valdai : (cat.norm_minutes ?? 60);
    }
  }
  if (!minutes || minutes <= 0) minutes = 60;

  const priceClient = ((minutes / 60) * hourlyRate).toFixed(2);
  const markCompleted = body.completed !== false;

  const { data, error } = await (supabase.from('service_order_works') as any)
    .insert({
      service_order_id: orderId,
      work_catalog_id: body.work_catalog_id ?? null,
      custom_work_name: body.custom_work_name?.trim() ?? null,
      norm_minutes: minutes,
      actual_minutes: minutes,
      price_client: priceClient,
      quantity: 1,
      status: markCompleted ? 'completed' : 'pending',
      mechanic_id: userId,
    })
    .select(
      'id, custom_work_name, status, norm_minutes, actual_minutes, price_client, quantity, work_catalog:work_catalog(id, name, norm_minutes)',
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

  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value || request.headers.get('x-salda-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  await (supabase.from('work_time_logs') as any).delete().eq('service_order_work_id', workId);
  const { error } = await (supabase.from('service_order_works') as any).delete().eq('id', workId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
