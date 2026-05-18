/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/garage/fault-catalog/:id */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if ('name' in body) updates.name = body.name;
  if ('category' in body) updates.category = body.category;
  if ('is_active' in body) updates.is_active = body.is_active;

  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('fault_catalog') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
