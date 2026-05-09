/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    const update: Record<string, any> = {};
    if (body.lender_name !== undefined) update.lender_name = body.lender_name.trim();
    if (body.loan_type !== undefined) update.loan_type = body.loan_type;
    if (body.purpose !== undefined) update.purpose = body.purpose?.trim() || null;
    if (body.original_amount !== undefined) update.original_amount = body.original_amount;
    if (body.remaining_amount !== undefined) update.remaining_amount = body.remaining_amount;
    if (body.annual_rate !== undefined) update.annual_rate = body.annual_rate || null;
    if (body.monthly_payment !== undefined) update.monthly_payment = body.monthly_payment || null;
    if (body.started_at !== undefined) update.started_at = body.started_at;
    if (body.ends_at !== undefined) update.ends_at = body.ends_at || null;
    if (body.notes !== undefined) update.notes = body.notes?.trim() || null;
    if (body.next_payment_date !== undefined)
      update.next_payment_date = body.next_payment_date || null;
    if (body.is_active !== undefined) update.is_active = body.is_active;

    const { data, error } = await (supabase.from('loans') as any)
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
