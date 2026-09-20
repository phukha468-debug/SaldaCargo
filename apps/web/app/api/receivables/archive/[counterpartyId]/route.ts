/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ counterpartyId: string }> },
) {
  try {
    const { counterpartyId } = await params;
    const supabase = createAdminClient();

    const { data, error } = await (supabase.from('trip_orders') as any)
      .select(
        `id, amount, payment_method, created_at, description,
         invoice_number, invoice_date, invoice_status, invoice_paid_at,
         trip:trips(trip_number, started_at, driver:users!trips_driver_id_fkey(name), asset:assets(short_name, reg_number))`,
      )
      .eq('counterparty_id', counterpartyId)
      .eq('settlement_status', 'completed')
      .neq('lifecycle_status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ archive: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
