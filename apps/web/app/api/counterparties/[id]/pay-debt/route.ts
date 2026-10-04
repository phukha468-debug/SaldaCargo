/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const CAT_FUEL = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
const CAT_PARTS = '9d18370d-3228-4f2a-8530-52b168cfa8d7';
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

/** POST /api/counterparties/[id]/pay-debt — быстрая выплата долга поставщику */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      amount: number | string;
      wallet_id: string; // банк или касса
      description?: string;
    };

    const numAmount = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;
    if (!numAmount || numAmount <= 0) {
      return NextResponse.json({ error: 'Сумма выплаты должна быть больше 0' }, { status: 400 });
    }
    if (!body.wallet_id) {
      return NextResponse.json(
        { error: 'Выберите счёт списания (Банк или Касса)' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Получаем данные контрагента
    const { data: cp, error: cpErr } = await (supabase.from('counterparties') as any)
      .select('id, name, type, payable_amount')
      .eq('id', id)
      .single();

    if (cpErr || !cp) {
      return NextResponse.json({ error: 'Контрагент не найден' }, { status: 404 });
    }

    // Определяем категорию расхода
    let categoryId = CAT_PARTS;
    if (
      cp.name.toLowerCase().includes('гсм') ||
      cp.name.toLowerCase().includes('дерябин') ||
      cp.name.toLowerCase().includes('топлив')
    ) {
      categoryId = CAT_FUEL;
    }

    // Создаем транзакцию выплаты
    const desc = body.description?.trim() || `Оплата поставщику: ${cp.name}`;
    const { data: tx, error: txErr } = await (supabase.from('transactions') as any)
      .insert({
        direction: 'expense',
        amount: numAmount.toFixed(2),
        from_wallet_id: body.wallet_id,
        to_wallet_id: null,
        counterparty_id: id,
        category_id: categoryId,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        transaction_date: new Date().toISOString(),
        description: desc,
        idempotency_key: crypto.randomUUID(),
        created_by: SYSTEM_USER_ID,
      })
      .select()
      .single();

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 });
    }

    // Если у контрагента был ручной payable_amount, уменьшаем его
    const currentPayable = parseFloat(cp.payable_amount ?? '0');
    if (currentPayable > 0) {
      const nextPayable = Math.max(0, currentPayable - numAmount);
      await (supabase.from('counterparties') as any)
        .update({ payable_amount: nextPayable.toFixed(2) })
        .eq('id', id);
    }

    return NextResponse.json({ success: true, transaction: tx });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
