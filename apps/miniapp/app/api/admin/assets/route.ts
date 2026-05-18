/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('assets') as any)
    .select('id, short_name, reg_number')
    .eq('is_active', true)
    .order('short_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
