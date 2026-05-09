/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('loans') as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.lender_name?.trim())
      return NextResponse.json({ error: 'Кредитор обязателен' }, { status: 400 });
    if (!body.original_amount || parseFloat(body.original_amount) <= 0)
      return NextResponse.json({ error: 'Укажите исходную сумму' }, { status: 400 });
    if (!body.started_at)
      return NextResponse.json({ error: 'Укажите дату начала' }, { status: 400 });

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('loans') as any)
      .insert({
        lender_name: body.lender_name.trim(),
        loan_type: body.loan_type || 'credit',
        purpose: body.purpose?.trim() || null,
        original_amount: body.original_amount,
        remaining_amount: body.remaining_amount || body.original_amount,
        annual_rate: body.annual_rate || null,
        monthly_payment: body.monthly_payment || null,
        started_at: body.started_at,
        ends_at: body.ends_at || null,
        next_payment_date: body.next_payment_date || null,
        notes: body.notes?.trim() || null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
