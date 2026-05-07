/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/driver/counterparties — список клиентов для водителя */
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await (supabase
    .from('counterparties')
    .select('id, name')
    .eq('is_active', true)
    .order('name') as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
