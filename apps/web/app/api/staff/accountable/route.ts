/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CASH_METHODS = ['cash'];
const CASH_COLLECT_CAT = '72f677d4-84af-4d0d-a845-a1b63c7ae607';
const CASH_WALLET_ID = '10000000-0000-0000-0000-000000000002'; // Сейф

async function resolveAdminUserId(supabase: any): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get('salda_user_id')?.value;
  if (fromCookie) return fromCookie;

  const { data } = await (supabase.from('users') as any)
    .select('id')
    .or('roles.cs.{owner},roles.cs.{admin}')
    .limit(1)
    .single();

  return data?.id ?? '00000000-0000-0000-0000-000000000000';
}

/**
 * GET /api/staff/accountable
 * Получение сводки подотчётных средств у водителей:
 * - Активные зафиксированные переносы (holds)
 * - Расчётный остаток наличных по рейсам (uncollected cash)
 * - История последних инкассаций
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const [
      { data: drivers, error: dErr },
      { data: assets, error: aErr },
      { data: trips, error: tErr },
      { data: collections, error: cErr },
      { data: activeHolds, error: hErr },
      { data: recentCollections, error: rcErr },
    ] = await Promise.all([
      (supabase.from('users') as any)
        .select('id, name, phone, current_asset_id')
        .contains('roles', ['driver'])
        .eq('is_active', true)
        .order('name'),

      (supabase.from('assets') as any).select('id, short_name, reg_number'),

      (supabase.from('trips') as any)
        .select(
          'driver_id, trip_orders(amount, payment_method, lifecycle_status, settlement_status), trip_expenses(amount, payment_method)',
        )
        .neq('lifecycle_status', 'cancelled'),

      (supabase.from('cash_collections') as any).select('driver_id, amount'),

      (supabase.from('transactions') as any)
        .select(
          'id, amount, description, created_at, transaction_date, related_user_id, driver:users!transactions_related_user_id_fkey(id, name, phone)',
        )
        .eq('category_id', CASH_COLLECT_CAT)
        .eq('settlement_status', 'pending')
        .neq('lifecycle_status', 'cancelled')
        .order('created_at', { ascending: false }),

      (supabase.from('cash_collections') as any)
        .select(
          'id, amount, note, created_at, driver:users!cash_collections_driver_id_fkey(id, name), collector:users!cash_collections_collected_by_fkey(name)',
        )
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });
    if (aErr) console.error('Assets fetch error:', aErr);
    if (tErr) console.error('Trips fetch error:', tErr);
    if (cErr) console.error('Collections fetch error:', cErr);
    if (hErr) console.error('Active holds fetch error:', hErr);
    if (rcErr) console.error('Recent collections fetch error:', rcErr);

    const assetsMap = new Map<string, string>();
    (assets ?? []).forEach((a: any) => {
      assetsMap.set(a.id, a.short_name || a.reg_number);
    });

    const holdsList = (activeHolds ?? []).map((h: any) => ({
      id: h.id,
      driver_id: h.related_user_id,
      driver_name: h.driver?.name ?? 'Водитель',
      driver_phone: h.driver?.phone ?? '',
      amount: parseFloat(h.amount ?? '0'),
      note: (h.description || '').replace(/^\[CARRYOVER\]\s*/, ''),
      created_at: h.created_at,
      transaction_date: h.transaction_date,
    }));

    const driverStats = (drivers ?? []).map((d: any) => {
      const dTrips = (trips ?? []).filter((t: any) => t.driver_id === d.id);
      const cashIn = dTrips
        .flatMap((t: any) => (t.trip_orders as any[]) ?? [])
        .filter(
          (o: any) =>
            CASH_METHODS.includes(o.payment_method) &&
            o.lifecycle_status !== 'cancelled' &&
            o.settlement_status === 'completed',
        )
        .reduce((s: number, o: any) => s + parseFloat(o.amount ?? '0'), 0);

      const cashSpent = dTrips
        .flatMap((t: any) => (t.trip_expenses as any[]) ?? [])
        .filter((e: any) => CASH_METHODS.includes(e.payment_method))
        .reduce((s: number, e: any) => s + parseFloat(e.amount ?? '0'), 0);

      const cashCollected = (collections ?? [])
        .filter((c: any) => c.driver_id === d.id)
        .reduce((s: number, c: any) => s + parseFloat(c.amount ?? '0'), 0);

      const dHolds = holdsList.filter((h: any) => h.driver_id === d.id);
      const holdAmount = dHolds.reduce((s: number, h: any) => s + h.amount, 0);
      const calcBalance = Math.max(0, cashIn - cashSpent - cashCollected);

      return {
        id: d.id,
        name: d.name,
        phone: d.phone,
        asset: d.current_asset_id ? (assetsMap.get(d.current_asset_id) ?? null) : null,
        cash_in: cashIn,
        cash_spent: cashSpent,
        cash_collected: cashCollected,
        calc_balance: calcBalance,
        hold_amount: holdAmount,
        total_on_hands: holdAmount > 0 ? holdAmount : calcBalance,
        holds: dHolds,
      };
    });

    const totalHoldAmount = holdsList.reduce((s: number, h: any) => s + h.amount, 0);
    const totalCalcCash = driverStats.reduce((s: number, d: any) => s + d.calc_balance, 0);
    const driversWithHolds = driverStats.filter((d: any) => d.hold_amount > 0);
    const driversWithFunds = driverStats.filter(
      (d: any) => d.hold_amount > 0 || d.calc_balance > 0,
    );

    return NextResponse.json({
      summary: {
        total_hold_amount: totalHoldAmount,
        total_calc_cash: totalCalcCash,
        total_active_holds_count: holdsList.length,
        drivers_with_holds_count: driversWithHolds.length,
        drivers_with_funds_count: driversWithFunds.length,
      },
      holds: holdsList,
      drivers: driverStats,
      recent_collections: (recentCollections ?? []).map((c: any) => ({
        id: c.id,
        amount: parseFloat(c.amount ?? '0'),
        note: c.note,
        created_at: c.created_at,
        driver_id: c.driver?.id,
        driver_name: c.driver?.name ?? 'Водитель',
        collector_name: c.collector?.name ?? 'Администратор',
      })),
    });
  } catch (err: any) {
    console.error('Error in GET /api/staff/accountable:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/**
 * POST /api/staff/accountable
 * Действия с подотчётом:
 * - 'collect_hold': принять зафиксированный перенос (полностью или частично)
 * - 'collect_cash': принять произвольные наличные у водителя в кассу
 * - 'create_hold': зафиксировать перенос подотчёта на руках
 */
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const adminId = await resolveAdminUserId(supabase);

    const body = await request.json();
    const action = body.action || 'collect_hold';
    const targetWalletId = body.wallet_id || CASH_WALLET_ID;

    // 1. Принять зафиксированный перенос подотчёта (Hold)
    if (action === 'collect_hold') {
      const { hold_id, collected_amount, note } = body;
      if (!hold_id) {
        return NextResponse.json({ error: 'hold_id обязателен' }, { status: 400 });
      }

      const { data: holdTx, error: fetchErr } = await (supabase.from('transactions') as any)
        .select('*')
        .eq('id', hold_id)
        .single();

      if (fetchErr || !holdTx) {
        return NextResponse.json({ error: 'Запись переноса не найдена' }, { status: 404 });
      }

      const fullAmount = parseFloat(holdTx.amount);
      const collectAmount = collected_amount ? parseFloat(String(collected_amount)) : fullAmount;

      if (isNaN(collectAmount) || collectAmount <= 0) {
        return NextResponse.json({ error: 'Некорректная сумма приёма' }, { status: 400 });
      }

      const noteText =
        note?.trim() ||
        `Инкассация переноса от ${new Date(holdTx.created_at).toLocaleDateString('ru-RU')}`;

      // Создаём запись в cash_collections
      await (supabase.from('cash_collections') as any).insert({
        driver_id: holdTx.related_user_id,
        amount: collectAmount.toFixed(2),
        collected_by: adminId,
        note: noteText,
      });

      if (collectAmount >= fullAmount) {
        // Полная сдача: переводим транзакцию в completed и фиксируем кошелёк
        await (supabase.from('transactions') as any)
          .update({
            settlement_status: 'completed',
            to_wallet_id: targetWalletId,
            updated_at: new Date().toISOString(),
            description: `${holdTx.description} [Сдано в кассу ${new Date().toLocaleDateString('ru-RU')}]`,
          })
          .eq('id', holdTx.id);
      } else {
        // Частичная сдача
        const remaining = fullAmount - collectAmount;
        await (supabase.from('transactions') as any)
          .update({
            amount: remaining.toFixed(2),
            updated_at: new Date().toISOString(),
            description: `${holdTx.description} [Частично сдано: ${collectAmount.toLocaleString('ru-RU')} ₽]`,
          })
          .eq('id', holdTx.id);

        // Транзакция на сданную часть
        await (supabase.from('transactions') as any).insert({
          direction: 'transfer',
          amount: collectAmount.toFixed(2),
          category_id: CASH_COLLECT_CAT,
          from_wallet_id: holdTx.from_wallet_id,
          to_wallet_id: targetWalletId,
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          related_user_id: holdTx.related_user_id,
          description: `Инкассация части переноса: ${collectAmount.toLocaleString('ru-RU')} ₽`,
          created_by: adminId,
          idempotency_key: crypto.randomUUID(),
          transaction_date: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        ok: true,
        message: `Принято ${collectAmount.toLocaleString('ru-RU')} ₽ в кассу`,
      });
    }

    // 2. Принять произвольные наличные у водителя (инкассация расчётного остатка)
    if (action === 'collect_cash') {
      const { driver_id, amount, note } = body;
      const numAmount = parseFloat(String(amount ?? '0'));
      if (!driver_id || isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json(
          { error: 'Укажите водителя и сумму больше нуля' },
          { status: 400 },
        );
      }

      const noteText = note?.trim() || 'Инкассация наличных у водителя';

      // 1. Создаём запись в cash_collections
      const { error: collErr } = await (supabase.from('cash_collections') as any).insert({
        driver_id,
        amount: numAmount.toFixed(2),
        collected_by: adminId,
        note: noteText,
      });

      if (collErr) {
        return NextResponse.json({ error: collErr.message }, { status: 500 });
      }

      // 2. Ищем кошелёк водителя
      const { data: driverWallet } = await (supabase.from('wallets') as any)
        .select('id')
        .eq('owner_user_id', driver_id)
        .eq('type', 'driver_accountable')
        .limit(1)
        .maybeSingle();

      // 3. Создаём транзакцию перевода в кассу/сейф
      await (supabase.from('transactions') as any).insert({
        direction: 'transfer',
        amount: numAmount.toFixed(2),
        category_id: CASH_COLLECT_CAT,
        from_wallet_id: driverWallet?.id ?? null,
        to_wallet_id: targetWalletId,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        related_user_id: driver_id,
        description: noteText,
        created_by: adminId,
        idempotency_key: crypto.randomUUID(),
        transaction_date: new Date().toISOString(),
      });

      return NextResponse.json({
        ok: true,
        message: `Инкассировано ${numAmount.toLocaleString('ru-RU')} ₽`,
      });
    }

    // 3. Зафиксировать перенос подотчёта (Hold)
    if (action === 'create_hold') {
      const { driver_id, amount, note } = body;
      const numAmount = parseFloat(String(amount ?? '0'));
      if (!driver_id || isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json(
          { error: 'Укажите водителя и сумму больше нуля' },
          { status: 400 },
        );
      }

      const { data: driverWallet } = await (supabase.from('wallets') as any)
        .select('id')
        .eq('owner_user_id', driver_id)
        .eq('type', 'driver_accountable')
        .limit(1)
        .maybeSingle();

      const noteText = note?.trim() || 'Остаток на руках, перенос на следующий день';
      const description = `[CARRYOVER] ${noteText}`;

      const { data: createdTx, error: txErr } = await (supabase.from('transactions') as any)
        .insert({
          direction: 'transfer',
          amount: numAmount.toFixed(2),
          category_id: CASH_COLLECT_CAT,
          from_wallet_id: driverWallet?.id ?? null,
          to_wallet_id: targetWalletId,
          lifecycle_status: 'approved',
          settlement_status: 'pending',
          related_user_id: driver_id,
          description,
          created_by: adminId,
          idempotency_key: crypto.randomUUID(),
          transaction_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (txErr) {
        return NextResponse.json({ error: txErr.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        hold: {
          id: createdTx.id,
          driver_id,
          amount: numAmount.toFixed(2),
          note: noteText,
          created_at: createdTx.created_at,
        },
      });
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in POST /api/staff/accountable:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
