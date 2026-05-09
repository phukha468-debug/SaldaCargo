/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const in7days = new Date();
    in7days.setDate(in7days.getDate() + 7);
    const todayStr = new Date().toISOString().slice(0, 10);
    const in7Str = in7days.toISOString().slice(0, 10);

    const { data, error } = await (supabase.from('loans') as any)
      .select('id, lender_name, next_payment_date, monthly_payment')
      .eq('is_active', true)
      .not('next_payment_date', 'is', null)
      .lte('next_payment_date', in7Str);

    if (error) return NextResponse.json({ count: 0, items: [] });

    const items = (data ?? []).map((l: any) => ({
      id: l.id,
      lender_name: l.lender_name,
      next_payment_date: l.next_payment_date,
      monthly_payment: l.monthly_payment,
      overdue: l.next_payment_date < todayStr,
    }));

    return NextResponse.json({ count: items.length, items });
  } catch {
    return NextResponse.json({ count: 0, items: [] });
  }
}
