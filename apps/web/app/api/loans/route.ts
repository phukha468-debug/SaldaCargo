/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: loans, error } = await (supabase
      .from('loans')
      .select('*')
      .eq('is_active', true)
      .order('started_at', { ascending: true }) as any);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (loans as any[]) ?? [];

    const totalRemaining = rows
      .reduce((s: number, l: any) => s + parseFloat(l.remaining_amount ?? '0'), 0)
      .toFixed(2);

    const totalMonthly = rows
      .reduce((s: number, l: any) => s + parseFloat(l.monthly_payment ?? '0'), 0)
      .toFixed(2);

    return NextResponse.json({ loans: rows, totalRemaining, totalMonthly });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
