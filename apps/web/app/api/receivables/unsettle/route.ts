/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';

function walletForDebt(isLegalEntity: boolean): string {
  return isLegalEntity ? BANK_ID : CASH_ID;
}

/**
 * POST /api/receivables/unsettle
 * Возврат счёта/заказа из архива обратно в активную дебиторку
 * с запуском обратного финансового механизма (списание денег со счёта компании).
 *
 * Body: { orderId: string, type?: 'trip_order' | 'manual', from_wallet_id?: string }
 */
export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const cookieStore = await cookies();
    let adminId = cookieStore.get('salda_user_id')?.value ?? null;

    if (!adminId) {
      const { data: adminUser } = await (supabase as any)
        .from('users')
        .select('id')
        .contains('roles', ['admin'])
        .limit(1)
        .maybeSingle();
      adminId = adminUser?.id ?? 'e9a1c980-eb1e-5c87-9f6d-c7f67eb28a1d';
    }

    const body = await req.json().catch(() => ({}));
    const { orderId, type = 'trip_order', from_wallet_id } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId обязателен' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    if (type === 'manual') {
      const { data: manual, error: fetchErr } = await (supabase as any)
        .from('manual_receivables')
        .select(
          'id, amount, counterparty_id, settled, counterparty:counterparties(name, is_legal_entity)',
        )
        .eq('id', orderId)
        .single();

      if (fetchErr || !manual) {
        return NextResponse.json({ error: 'Запись долга не найдена' }, { status: 404 });
      }

      if (!manual.settled) {
        return NextResponse.json({ error: 'Запись не находится в архиве' }, { status: 400 });
      }

      const isLegal = manual.counterparty?.is_legal_entity ?? false;
      const walletId = from_wallet_id || walletForDebt(isLegal);
      const cpName = manual.counterparty?.name ?? 'Контрагент';
      const amount = parseFloat(manual.amount).toFixed(2);

      // 1. Возвращаем долг в статус непогашенного
      const { error: updateErr } = await (supabase as any)
        .from('manual_receivables')
        .update({
          settled: false,
          settled_at: null,
        })
        .eq('id', orderId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // 2. Обратный финансовый механизм: расходная транзакция для списания денег с нашего счёта
      const meta = JSON.stringify({
        type: 'receivables_unsettle',
        manual_id: orderId,
        amount,
      });

      const { error: txErr } = await (supabase.from('transactions') as any).insert({
        direction: 'expense',
        category_id: TRIP_REVENUE_CATEGORY,
        amount,
        counterparty_id: manual.counterparty_id ?? null,
        from_wallet_id: walletId,
        description: `Возврат из архива в долг: ${cpName}`,
        photo_url: meta,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        created_by: adminId,
        idempotency_key: crypto.randomUUID(),
      });

      if (txErr) {
        return NextResponse.json({ error: txErr.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: 'Долг возвращён из архива в дебиторку, средства списаны со счёта',
      });
    }

    // Для trip_order
    const { data: order, error: fetchErr } = await (supabase as any)
      .from('trip_orders')
      .select(
        'id, amount, counterparty_id, invoice_number, payment_method, settlement_status, counterparty:counterparties(name, is_legal_entity), trip:trips(trip_number)',
      )
      .eq('id', orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
    }

    if (order.settlement_status !== 'completed') {
      return NextResponse.json(
        { error: 'Заказ не находится в архиве (уже открыт)' },
        { status: 400 },
      );
    }

    const isLegal = order.counterparty?.is_legal_entity ?? false;
    const walletId = from_wallet_id || walletForDebt(isLegal);
    const cpName = order.counterparty?.name ?? 'Контрагент';
    const amount = parseFloat(order.amount).toFixed(2);
    const tripNum = order.trip?.trip_number ? ` (Рейс №${order.trip.trip_number})` : '';
    const invoiceNum = order.invoice_number ? ` [Счёт №${order.invoice_number}]` : '';

    // 1. Возвращаем заказ в статус pending
    const { error: updateErr } = await (supabase as any)
      .from('trip_orders')
      .update({
        settlement_status: 'pending',
        invoice_paid_at: null,
        invoice_status: order.invoice_number ? 'issued' : 'unbilled',
        updated_at: nowIso,
      })
      .eq('id', orderId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 2. Обратный финансовый механизм: списание денег с нашего счёта
    const meta = JSON.stringify({
      type: 'receivables_unsettle',
      order_id: orderId,
      amount,
    });

    const { error: txErr } = await (supabase.from('transactions') as any).insert({
      direction: 'expense',
      category_id: TRIP_REVENUE_CATEGORY,
      amount,
      counterparty_id: order.counterparty_id ?? null,
      trip_order_id: orderId,
      from_wallet_id: walletId,
      description: `Возврат из архива в долг: ${cpName}${tripNum}${invoiceNum}`,
      photo_url: meta,
      lifecycle_status: 'approved',
      settlement_status: 'completed',
      created_by: adminId,
      idempotency_key: crypto.randomUUID(),
    });

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Заказ возвращён из архива в дебиторку, средства списаны со счёта',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
