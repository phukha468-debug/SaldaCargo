/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/garage/work-catalog/:id */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const allowed = [
    'code',
    'name',
    'category',
    'norm_minutes',
    'norm_minutes_valdai',
    'default_price_client',
    'default_price_client_valdai',
    'internal_cost_rate',
    'is_active',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body)
      updates[key] =
        typeof body[key] === 'number' && key.includes('price') ? body[key].toString() : body[key];
  }

  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('work_catalog') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
