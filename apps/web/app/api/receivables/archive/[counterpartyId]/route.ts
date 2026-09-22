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

    const [{ data: orders, error: ordersErr }, { data: manuals, error: manualsErr }] =
      await Promise.all([
        (supabase.from('trip_orders') as any)
          .select(
            `id, amount, payment_method, created_at, description,
             invoice_number, invoice_date, invoice_status, invoice_paid_at,
             trip:trips(trip_number, started_at, driver:users!trips_driver_id_fkey(name), asset:assets(short_name, reg_number))`,
          )
          .eq('counterparty_id', counterpartyId)
          .eq('settlement_status', 'completed')
          .neq('lifecycle_status', 'cancelled')
          .order('created_at', { ascending: false }),

        (supabase.from('manual_receivables') as any)
          .select('id, amount, date, description, settled, settled_at, created_at')
          .eq('counterparty_id', counterpartyId)
          .eq('settled', true)
          .order('date', { ascending: false }),
      ]);

    if (ordersErr) {
      return NextResponse.json({ error: ordersErr.message }, { status: 500 });
    }
    if (manualsErr) {
      return NextResponse.json({ error: manualsErr.message }, { status: 500 });
    }

    const tripItems = (orders ?? []).map((o: any) => ({
      ...o,
      type: 'trip_order' as const,
    }));

    const manualItems = (manuals ?? []).map((m: any) => ({
      id: m.id,
      amount: m.amount,
      payment_method: 'debt_cash',
      created_at: m.created_at || m.date,
      description: m.description || 'Ручной долг',
      invoice_number: null,
      invoice_date: m.date,
      invoice_status: 'paid',
      invoice_paid_at: m.settled_at,
      trip: null,
      type: 'manual' as const,
    }));

    const archive = [...tripItems, ...manualItems].sort((a, b) => {
      const da = new Date(a.invoice_paid_at || a.created_at).getTime();
      const db = new Date(b.invoice_paid_at || b.created_at).getTime();
      return db - da;
    });

    return NextResponse.json({ archive });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
