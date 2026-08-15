/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('assets')
      .select('id, short_name, reg_number, odometer_current, status, assigned_driver_id')
      .not('status', 'in', '("sold","written_off")')
      .order('short_name');

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка' }, { status: 500 });
  }
}
