/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('work_catalog') as any)
    .select('id, name, category, norm_minutes, default_price_client')
    .eq('is_active', true)
    .order('category')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
