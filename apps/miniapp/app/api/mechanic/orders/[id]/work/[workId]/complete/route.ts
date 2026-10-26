/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { id: orderId, workId } = await params;
  const { actual_minutes } = await request.json();

  if (typeof actual_minutes !== 'number') {
    return NextResponse.json({ error: 'actual_minutes is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

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

    const updatePayload: Record<string, unknown> = {
      status: 'completed',
      actual_minutes,
    };
    if (actual_minutes > 0) {
      updatePayload.price_client = ((actual_minutes / 60) * hourlyRate).toFixed(2);
    }

    const { data, error } = await (supabase.from('service_order_works') as any)
      .update(updatePayload)
      .eq('id', workId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
