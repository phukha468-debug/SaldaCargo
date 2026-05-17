/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/mechanics — список механиков */
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('users') as any)
    .select('id, name, mechanic_salary_pct')
    .contains('roles', ['mechanic'])
    .eq('is_active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
