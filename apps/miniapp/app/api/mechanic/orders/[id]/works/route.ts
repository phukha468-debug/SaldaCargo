/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const body = await request.json();
  const supabase = createAdminClient();

  let normMinutes = body.norm_minutes ?? 60;
  if (body.work_catalog_id) {
    const { data: cat } = await (supabase.from('work_catalog') as any)
      .select('norm_minutes')
      .eq('id', body.work_catalog_id)
      .single();
    if (cat) normMinutes = cat.norm_minutes;
  }

  const { data, error } = await (supabase.from('service_order_works') as any)
    .insert({
      service_order_id: orderId,
      work_catalog_id: body.work_catalog_id ?? null,
      custom_work_name: body.custom_work_name ?? null,
      norm_minutes: normMinutes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
