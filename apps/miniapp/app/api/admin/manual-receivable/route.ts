/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** POST /api/admin/manual-receivable — добавить ручную запись дебиторки */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { counterparty_id, amount, description, date } = body;

  if (!counterparty_id)
    return NextResponse.json({ error: 'counterparty_id обязателен' }, { status: 400 });
  if (!amount || parseFloat(amount) <= 0)
    return NextResponse.json({ error: 'Сумма должна быть больше нуля' }, { status: 400 });

  const supabase = createAdminClient();

  const { data, error } = await (supabase as any)
    .from('manual_receivables')
    .insert({
      counterparty_id,
      amount: parseFloat(amount).toFixed(2),
      description: description?.trim() || null,
      date: date ?? new Date().toISOString().split('T')[0],
      settled: false,
      created_by: adminId,
    })
    .select('id, amount, date, description, counterparty:counterparties(id, name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
