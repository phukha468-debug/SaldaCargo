/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** DELETE /api/transactions/[id] — аннулировать транзакцию (soft-delete) */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason: string = (body.reason as string) || 'Аннулировано администратором';

  if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });

  const supabase = createAdminClient();

  // Проверяем, что транзакция существует и не аннулирована ранее
  const { data: existing, error: fetchErr } = await (supabase.from('transactions') as any)
    .select(
      'id, lifecycle_status, idempotency_key, category_id, direction, amount, description, trip_order_id, photo_url, counterparty_id, created_at',
    )
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Транзакция не найдена' }, { status: 404 });
  }
  if (existing.lifecycle_status === 'cancelled') {
    return NextResponse.json({ error: 'Транзакция уже аннулирована' }, { status: 409 });
  }

  const { error } = await (supabase.from('transactions') as any)
    .update({
      lifecycle_status: 'cancelled',
      cancelled_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const TRIP_REVENUE_CATEGORY = '74008cf7-0527-4e9f-afd2-d232b8f8125a';
  const LOAN_REPAYMENT_CATEGORY = '00000000-0000-0000-0000-000000000020';
  const WALLET_TRANSFER_CAT = 'b9946a5e-4a33-4ed9-a272-5dee12d4ca93';
  const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';
  const PAYROLL_CATEGORY_IDS = [
    'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
    '18792fa8-fda8-472d-8e04-e19d2c6c053c',
    '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
  ];

  // ============================================================
  // 1. ОТКАТ ДЕБИТОРКИ (Погашение задолженности клиентов)
  // ============================================================
  let rolledBackReceivables = false;

  // 1A. Откат по метаданным в photo_url (сохранённый список заказов)
  if (existing.photo_url) {
    try {
      const meta = JSON.parse(existing.photo_url);
      if (meta && meta.type === 'receivables_settlement' && Array.isArray(meta.orders)) {
        for (const item of meta.orders) {
          if (item.type === 'trip_order' && item.id) {
            if (item.is_partial) {
              const { data: ord } = await (supabase.from('trip_orders') as any)
                .select('id, amount')
                .eq('id', item.id)
                .single();
              if (ord) {
                const restoredAmount = (
                  parseFloat(ord.amount || '0') + parseFloat(item.amount || '0')
                ).toFixed(2);
                await (supabase.from('trip_orders') as any)
                  .update({
                    amount: restoredAmount,
                    settlement_status: 'pending',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', item.id);
              }
            } else {
              await (supabase.from('trip_orders') as any)
                .update({
                  settlement_status: 'pending',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', item.id);
            }
          } else if (item.type === 'manual' && item.id) {
            if (item.is_partial) {
              const { data: man } = await (supabase.from('manual_receivables') as any)
                .select('id, amount')
                .eq('id', item.id)
                .single();
              if (man) {
                const restoredAmount = (
                  parseFloat(man.amount || '0') + parseFloat(item.amount || '0')
                ).toFixed(2);
                await (supabase.from('manual_receivables') as any)
                  .update({
                    amount: restoredAmount,
                    settled: false,
                    settled_at: null,
                  })
                  .eq('id', item.id);
              }
            } else {
              await (supabase.from('manual_receivables') as any)
                .update({
                  settled: false,
                  settled_at: null,
                })
                .eq('id', item.id);
            }
          }
        }
        rolledBackReceivables = true;
      }
    } catch {
      // Игнорируем ошибку JSON парсинга
    }
  }

  // 1B. Откат одиночного заказа по direct trip_order_id
  if (!rolledBackReceivables && existing.trip_order_id) {
    const isPartial = existing.description?.includes('Частичное');
    if (isPartial) {
      const { data: ord } = await (supabase.from('trip_orders') as any)
        .select('id, amount')
        .eq('id', existing.trip_order_id)
        .single();
      if (ord) {
        const restoredAmount = (
          parseFloat(ord.amount || '0') + parseFloat(existing.amount || '0')
        ).toFixed(2);
        await (supabase.from('trip_orders') as any)
          .update({
            amount: restoredAmount,
            settlement_status: 'pending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.trip_order_id);
      }
    } else {
      await (supabase.from('trip_orders') as any)
        .update({
          settlement_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.trip_order_id);
    }
    rolledBackReceivables = true;
  }

  // 1C. Fallback для исторических записей без photo_url метаданных
  if (
    !rolledBackReceivables &&
    existing.category_id === TRIP_REVENUE_CATEGORY &&
    existing.direction === 'income' &&
    existing.description &&
    (existing.description.startsWith('Погашение') ||
      existing.description.startsWith('Частичное погашение'))
  ) {
    let cpId = existing.counterparty_id;
    if (!cpId) {
      const match = existing.description.match(
        /(?:Погашение задолженности|Погашение|Частичное погашение):\s*([^(\n]+?)(?:\s*\(\d+\s*записей\))?$/,
      );
      if (match && match[1]) {
        const name = match[1].trim();
        const { data: cp } = await (supabase.from('counterparties') as any)
          .select('id')
          .ilike('name', name)
          .limit(1)
          .maybeSingle();
        cpId = cp?.id;
      }
    }

    if (cpId && existing.created_at) {
      const txTime = new Date(existing.created_at).getTime();
      const minTime = new Date(txTime - 10 * 60 * 1000).toISOString();
      const maxTime = new Date(txTime + 10 * 60 * 1000).toISOString();

      const [{ data: manuals }, { data: tripOrders }] = await Promise.all([
        (supabase.from('manual_receivables') as any)
          .select('id, amount, settled_at')
          .eq('counterparty_id', cpId)
          .eq('settled', true)
          .gte('settled_at', minTime)
          .lte('settled_at', maxTime),
        (supabase.from('trip_orders') as any)
          .select('id, amount, updated_at')
          .eq('counterparty_id', cpId)
          .eq('settlement_status', 'completed')
          .gte('updated_at', minTime)
          .lte('updated_at', maxTime),
      ]);

      const foundOrders = [
        ...(manuals || []).map((m: any) => ({ ...m, type: 'manual' })),
        ...(tripOrders || []).map((t: any) => ({ ...t, type: 'trip_order' })),
      ];

      const sumFound = foundOrders.reduce((s, o) => s + parseFloat(o.amount || '0'), 0);
      const txAmount = parseFloat(existing.amount || '0');

      if (foundOrders.length > 0 && Math.abs(sumFound - txAmount) < 1.0) {
        const manualIds = foundOrders.filter((o) => o.type === 'manual').map((o) => o.id);
        const tripOrderIds = foundOrders.filter((o) => o.type === 'trip_order').map((o) => o.id);

        if (manualIds.length > 0) {
          await (supabase.from('manual_receivables') as any)
            .update({ settled: false, settled_at: null })
            .in('id', manualIds);
        }
        if (tripOrderIds.length > 0) {
          await (supabase.from('trip_orders') as any)
            .update({ settlement_status: 'pending', updated_at: new Date().toISOString() })
            .in('id', tripOrderIds);
        }
      }
    }
  }

  // ============================================================
  // 2. ОТКАТ ПЛАТЕЖЕЙ ПО КРЕДИТАМ / ЗАЙМАМ
  // ============================================================
  if (existing.category_id === LOAN_REPAYMENT_CATEGORY && existing.direction === 'expense') {
    const amt = parseFloat(existing.amount || '0');
    if (amt > 0) {
      const match = existing.description?.match(/Платёж по кредиту:\s*(.+)$/);
      let loanQuery = (supabase.from('loans') as any).select('id, remaining_amount, is_active');
      if (match && match[1]) {
        loanQuery = loanQuery.ilike('lender_name', match[1].trim()).limit(1);
      } else {
        loanQuery = loanQuery.order('updated_at', { ascending: false }).limit(1);
      }
      const { data: loan } = await loanQuery.maybeSingle();
      if (loan) {
        const newRemaining = (parseFloat(loan.remaining_amount || '0') + amt).toFixed(2);
        await (supabase.from('loans') as any)
          .update({
            remaining_amount: newRemaining,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', loan.id);
      }
    }
  }

  // ============================================================
  // 3. ОТКАТ ЗАРПЛАТ И АВАНСОВ
  // ============================================================
  if (
    existing.idempotency_key &&
    (existing.category_id === WALLET_TRANSFER_CAT || existing.category_id === ADVANCE_CATEGORY_ID)
  ) {
    const { data: batchTxs } = await (supabase.from('transactions') as any)
      .select('id, category_id')
      .eq('idempotency_key', existing.idempotency_key);

    if (batchTxs) {
      const payrollIds = batchTxs
        .filter((t: any) => PAYROLL_CATEGORY_IDS.includes(t.category_id))
        .map((t: any) => t.id);

      if (payrollIds.length > 0) {
        await (supabase.from('transactions') as any)
          .update({ settlement_status: 'pending', idempotency_key: null })
          .in('id', payrollIds);
      }

      const otherIds = batchTxs
        .filter((t: any) => t.id !== id && !PAYROLL_CATEGORY_IDS.includes(t.category_id))
        .map((t: any) => t.id);

      if (otherIds.length > 0) {
        await (supabase.from('transactions') as any)
          .update({
            lifecycle_status: 'cancelled',
            cancelled_reason: 'Аннулирована связанная транзакция выплаты',
            updated_at: new Date().toISOString(),
          })
          .in('id', otherIds);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
