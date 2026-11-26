/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { syncInvoiceToOrder } from '@/lib/orderTripSync';
import { NextResponse } from 'next/server';

export async function PATCH(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    const body = await req.json();
    const { invoice_number, invoice_date } = body;

    if (!invoice_number) {
      return NextResponse.json({ error: 'Номер счёта/акта обязателен' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: currentOrder } = await (supabase.from('trip_orders') as any)
      .select(
        'trip_id, counterparty_id, organization_id, settlement_status, invoice_status, created_at, trip:trips(started_at)',
      )
      .eq('id', orderId)
      .single();

    const isPaid =
      currentOrder?.settlement_status === 'completed' || currentOrder?.invoice_status === 'paid';
    const newStatus = isPaid ? 'paid' : 'issued';

    const tripDate = currentOrder?.trip?.started_at
      ? String(currentOrder.trip.started_at).slice(0, 10)
      : currentOrder?.created_at
        ? String(currentOrder.created_at).slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    const finalInvoiceNumber = String(invoice_number).trim();
    const finalInvoiceDate = invoice_date || tripDate;

    const { data, error } = await (supabase.from('trip_orders') as any)
      .update({
        invoice_number: finalInvoiceNumber,
        invoice_date: finalInvoiceDate,
        invoice_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('id, invoice_number, invoice_date, invoice_status')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Синхронизируем номер и дату счёта обратно в таблицу orders («Сбор документов»)
    await syncInvoiceToOrder(supabase, orderId, {
      invoice_number: finalInvoiceNumber,
      invoice_date: finalInvoiceDate,
      trip_id: currentOrder?.trip_id ?? null,
      counterparty_id: currentOrder?.counterparty_id ?? null,
      organization_id: currentOrder?.organization_id ?? null,
    });

    return NextResponse.json({ ok: true, order: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
