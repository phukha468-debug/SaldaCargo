/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
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
      .select('settlement_status, invoice_status')
      .eq('id', orderId)
      .single();

    const isPaid =
      currentOrder?.settlement_status === 'completed' || currentOrder?.invoice_status === 'paid';
    const newStatus = isPaid ? 'paid' : 'issued';

    const { data, error } = await (supabase.from('trip_orders') as any)
      .update({
        invoice_number: String(invoice_number).trim(),
        invoice_date: invoice_date || new Date().toISOString().slice(0, 10),
        invoice_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('id, invoice_number, invoice_date, invoice_status')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, order: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
