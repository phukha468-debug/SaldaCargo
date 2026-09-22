/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const counterpartyId = url.searchParams.get('counterparty_id') || undefined;
    const q = url.searchParams.get('q')?.trim().toLowerCase() || '';
    const fromDate = url.searchParams.get('from') || undefined;
    const toDate = url.searchParams.get('to') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '300', 10);

    const supabase = createAdminClient();

    let ordersQuery = (supabase.from('trip_orders') as any)
      .select(
        `id, amount, payment_method, created_at, description,
         invoice_number, invoice_date, invoice_status, invoice_paid_at, counterparty_id,
         counterparty:counterparties(id, name, is_legal_entity, email, phone),
         trip:trips(id, trip_number, started_at, driver:users!trips_driver_id_fkey(name), asset:assets(short_name, reg_number))`,
      )
      .eq('settlement_status', 'completed')
      .neq('lifecycle_status', 'cancelled')
      .or('payment_method.in.(debt_cash,bank_invoice),counterparty_id.not.is.null');

    if (counterpartyId && counterpartyId !== 'all') {
      ordersQuery = ordersQuery.eq('counterparty_id', counterpartyId);
    }

    let manualsQuery = (supabase.from('manual_receivables') as any)
      .select(
        `id, amount, date, description, settled, settled_at, created_at, counterparty_id,
         counterparty:counterparties(id, name, is_legal_entity, email, phone)`,
      )
      .eq('settled', true);

    if (counterpartyId && counterpartyId !== 'all') {
      manualsQuery = manualsQuery.eq('counterparty_id', counterpartyId);
    }

    const [{ data: orders, error: ordersErr }, { data: manuals, error: manualsErr }] =
      await Promise.all([
        ordersQuery.order('created_at', { ascending: false }),
        manualsQuery.order('created_at', { ascending: false }),
      ]);

    if (ordersErr) {
      return NextResponse.json({ error: ordersErr.message }, { status: 500 });
    }
    if (manualsErr) {
      return NextResponse.json({ error: manualsErr.message }, { status: 500 });
    }

    const tripItems = (orders ?? []).map((o: any) => ({
      id: o.id,
      type: 'trip_order' as const,
      amount: o.amount,
      payment_method: o.payment_method,
      created_at: o.created_at,
      description: o.description,
      invoice_number: o.invoice_number,
      invoice_date: o.invoice_date,
      invoice_status: o.invoice_status || 'paid',
      invoice_paid_at: o.invoice_paid_at,
      effective_date: o.invoice_paid_at || o.invoice_date || o.created_at,
      counterparty_id: o.counterparty_id,
      counterparty: o.counterparty,
      trip: o.trip,
    }));

    const manualItems = (manuals ?? []).map((m: any) => ({
      id: m.id,
      type: 'manual' as const,
      amount: m.amount,
      payment_method: 'debt_cash',
      created_at: m.created_at || m.date,
      description: m.description || 'Ручной долг',
      invoice_number: null,
      invoice_date: m.date,
      invoice_status: 'paid',
      invoice_paid_at: m.settled_at,
      effective_date: m.settled_at || m.date || m.created_at,
      counterparty_id: m.counterparty_id,
      counterparty: m.counterparty,
      trip: null,
    }));

    let allItems = [...tripItems, ...manualItems].sort((a, b) => {
      const da = new Date(a.effective_date).getTime();
      const db = new Date(b.effective_date).getTime();
      return db - da;
    });

    if (fromDate) {
      allItems = allItems.filter((item) => {
        const itemD = item.effective_date ? String(item.effective_date).slice(0, 10) : '';
        return !itemD || itemD >= fromDate;
      });
    }

    if (toDate) {
      allItems = allItems.filter((item) => {
        const itemD = item.effective_date ? String(item.effective_date).slice(0, 10) : '';
        return !itemD || itemD <= toDate;
      });
    }

    if (q) {
      allItems = allItems.filter((item) => {
        const cpName = item.counterparty?.name?.toLowerCase() || '';
        const invNum = item.invoice_number?.toLowerCase() || '';
        const desc = item.description?.toLowerCase() || '';
        const tripNum = item.trip?.trip_number ? String(item.trip.trip_number) : '';
        const driverName = item.trip?.driver?.name?.toLowerCase() || '';
        const regNum = item.trip?.asset?.reg_number?.toLowerCase() || '';
        return (
          cpName.includes(q) ||
          invNum.includes(q) ||
          desc.includes(q) ||
          tripNum.includes(q) ||
          driverName.includes(q) ||
          regNum.includes(q)
        );
      });
    }

    const totalCount = allItems.length;
    const totalAmount = allItems.reduce((acc, it) => acc + parseFloat(it.amount || '0'), 0);

    return NextResponse.json({
      orders: allItems.slice(0, limit),
      summary: {
        total_count: totalCount,
        total_amount: totalAmount.toFixed(2),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
