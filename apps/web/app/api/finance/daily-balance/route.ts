/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { syncTBankBalance, fetchTBankStatement, TBankOperation } from '@/lib/tbank';
import { NextResponse } from 'next/server';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;

    const supabase = createAdminClient();

    // 1. Fetch live T-Bank balance and bank statement operations
    let apiBalance: number | null = null;
    let isApiSynced = false;
    let tbankAccountNum = '';
    let bankStatementOps: TBankOperation[] = [];
    const isToday = date === new Date().toISOString().slice(0, 10);

    const fromIso = `${date}T00:00:00Z`;
    const toIso = `${date}T23:59:59Z`;

    try {
      const syncPromise = isToday ? syncTBankBalance() : Promise.resolve(null);
      const statementPromise = fetchTBankStatement(fromIso, toIso);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));

      const [syncResult, statementResult] = await Promise.all([
        Promise.race([syncPromise, timeoutPromise]) as any,
        Promise.race([statementPromise, timeoutPromise]) as any,
      ]);

      if (syncResult?.success && typeof syncResult.balance === 'number') {
        apiBalance = syncResult.balance;
        isApiSynced = true;
        tbankAccountNum = syncResult.accountNumber || '';
      }

      if (Array.isArray(statementResult)) {
        bankStatementOps = statementResult;
      }
    } catch (e) {
      console.error('TBank auto-sync/statement error in daily-balance:', e);
    }

    // 2. Fetch all transactions for this day
    const txSelect =
      'id, amount, direction, description, created_at, transaction_date, from_wallet_id, to_wallet_id, category_id, counterparty_id, related_user_id, trip_order_id, trip_id, idempotency_key, ' +
      'category:transaction_categories(id, name, code), ' +
      'counterparty:counterparties(id, name), ' +
      'related_user:users!transactions_related_user_id_fkey(id, name)';

    const [
      { data: dayTxs },
      { data: dayTripOrders },
      { data: dayCollections },
      { data: auditRow },
      { data: categoriesList },
    ] = await Promise.all([
      // Transactions of the day (по transaction_date, либо по created_at если transaction_date не задан)
      (supabase.from('transactions') as any)
        .select(txSelect)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .or('from_wallet_id.not.is.null,to_wallet_id.not.is.null')
        .or('description.is.null,description.neq.Корректировка остатка')
        .or(
          `and(transaction_date.gte.${dayStart},transaction_date.lte.${dayEnd}),and(transaction_date.is.null,created_at.gte.${dayStart},created_at.lte.${dayEnd})`,
        )
        .order('created_at', { ascending: false }),

      // All Trip orders of this day with Bank/QR payment
      (supabase.from('trip_orders') as any)
        .select(
          'id, amount, created_at, payment_method, description, settlement_status, lifecycle_status, counterparty:counterparties(id, name), trip:trips!inner(id, trip_number, driver_id, driver:users!trips_driver_id_fkey(id, name))',
        )
        .in('payment_method', ['bank_invoice', 'qr'])
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .order('created_at', { ascending: false }),

      // Cash collections settled on this day (Safe income)
      (supabase.from('cash_collections') as any)
        .select('id, amount, created_at, note, driver:users!cash_collections_driver_id_fkey(name)')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd),

      // Audit status for this date
      (supabase.from('daily_finance_audits') as any).select('*').eq('date', date).maybeSingle(),

      // Available categories for editing
      (supabase.from('transaction_categories') as any)
        .select('id, name, code')
        .order('name', { ascending: true }),
    ]);

    // 3. Historical totals up to dayStart (to compute morning opening balance)
    // and up to dayEnd (to compute evening closing balance)
    const [
      { data: priorBankOrders },
      { data: priorCollections },
      { data: priorBankIn },
      { data: priorBankOut },
      { data: priorCashIn },
      { data: priorCashOut },
      { data: priorFuelIn },
      { data: priorFuelOut },
    ] = await Promise.all([
      (supabase.from('trip_orders') as any)
        .select('amount')
        .in('payment_method', ['bank_invoice', 'qr'])
        .eq('settlement_status', 'completed')
        .eq('lifecycle_status', 'approved')
        .lt('created_at', dayStart),

      (supabase.from('cash_collections') as any).select('amount').lt('created_at', dayStart),

      (supabase.from('transactions') as any)
        .select('amount, trip_order_id')
        .eq('to_wallet_id', BANK_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .lt('created_at', dayStart),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', BANK_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .lt('created_at', dayStart),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', CASH_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .lt('created_at', dayStart),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', CASH_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .lt('created_at', dayStart),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', FUEL_CARD_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .lt('created_at', dayStart),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', FUEL_CARD_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .lt('created_at', dayStart),
    ]);

    const sumArr = (arr: any[]) => (arr ?? []).reduce((s, r) => s + parseFloat(r.amount ?? '0'), 0);

    const priorBankInClean = (priorBankIn ?? [])
      .filter((r: any) => !r.trip_order_id)
      .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

    const morningBank =
      sumArr(priorBankOrders ?? []) + priorBankInClean - sumArr(priorBankOut ?? []);
    const morningCash =
      sumArr(priorCollections ?? []) + sumArr(priorCashIn ?? []) - sumArr(priorCashOut ?? []);
    const morningFuel = sumArr(priorFuelIn ?? []) - sumArr(priorFuelOut ?? []);

    // 4. Compute day's movements per wallet
    // From day trip orders
    let bankDayIn = (dayTripOrders ?? []).reduce(
      (s: number, o: any) => s + parseFloat(o.amount ?? '0'),
      0,
    );
    let bankDayOut = 0;

    let cashDayIn = (dayCollections ?? []).reduce(
      (s: number, c: any) => s + parseFloat(c.amount ?? '0'),
      0,
    );
    let cashDayOut = 0;

    let fuelDayIn = 0;
    let fuelDayOut = 0;

    for (const tx of (dayTxs ?? []) as any[]) {
      const amt = parseFloat(tx.amount ?? '0');
      if (tx.direction === 'income') {
        if (tx.to_wallet_id === BANK_ID) bankDayIn += amt;
        else if (tx.to_wallet_id === CASH_ID) cashDayIn += amt;
        else if (tx.to_wallet_id === FUEL_CARD_ID) fuelDayIn += amt;
      } else if (tx.direction === 'expense') {
        if (tx.from_wallet_id === BANK_ID) bankDayOut += amt;
        else if (tx.from_wallet_id === CASH_ID) cashDayOut += amt;
        else if (tx.from_wallet_id === FUEL_CARD_ID) fuelDayOut += amt;
      } else if (tx.direction === 'transfer') {
        if (tx.from_wallet_id === BANK_ID) bankDayOut += amt;
        else if (tx.from_wallet_id === CASH_ID) cashDayOut += amt;
        else if (tx.from_wallet_id === FUEL_CARD_ID) fuelDayOut += amt;

        if (tx.to_wallet_id === BANK_ID) bankDayIn += amt;
        else if (tx.to_wallet_id === CASH_ID) cashDayIn += amt;
        else if (tx.to_wallet_id === FUEL_CARD_ID) fuelDayIn += amt;
      }
    }

    // Если подключена и получена живая выписка Т-Банка через API — это 100% точный источник правды по Р/С
    if (bankStatementOps && bankStatementOps.length > 0) {
      const apiOpIn = bankStatementOps
        .filter((op: any) => op.typeOfOperation === 'Credit')
        .reduce((s: number, op: any) => s + (op.operationAmount || op.rubleAmount || 0), 0);
      const apiOpOut = bankStatementOps
        .filter((op: any) => op.typeOfOperation === 'Debit')
        .reduce((s: number, op: any) => s + (op.operationAmount || op.rubleAmount || 0), 0);

      bankDayIn = apiOpIn;
      bankDayOut = apiOpOut;
    }

    const eveningBankCalc = morningBank + bankDayIn - bankDayOut;
    const actualEveningBank = isToday && apiBalance !== null ? apiBalance : eveningBankCalc;
    // Для сегодняшнего дня при известном текущем балансе из API утро = вечер - приход + расход
    const actualMorningBank =
      isToday && apiBalance !== null ? actualEveningBank - bankDayIn + bankDayOut : morningBank;

    // Фактические остатки сейфа (29 000 ₽) и топливной карты (6 642,05 ₽),
    // зафиксированные директором, отсекающие старые виртуальные накопления из прошлых периодов
    const BASE_ACTUAL_CASH = 29000.0;
    const BASE_ACTUAL_FUEL = 6642.05;

    let actualEveningCash = morningCash + cashDayIn - cashDayOut;
    let actualMorningCash = morningCash;

    if (auditRow && auditRow.safe_cash_actual !== undefined && auditRow.safe_cash_actual !== null) {
      actualEveningCash = Number(auditRow.safe_cash_actual);
      actualMorningCash = actualEveningCash - cashDayIn + cashDayOut;
    } else if (isToday) {
      actualEveningCash = BASE_ACTUAL_CASH;
      actualMorningCash = actualEveningCash - cashDayIn + cashDayOut;
    }

    let actualEveningFuel = morningFuel + fuelDayIn - fuelDayOut;
    let actualMorningFuel = morningFuel;

    if (
      auditRow &&
      auditRow.fuel_card_balance !== undefined &&
      auditRow.fuel_card_balance !== null
    ) {
      actualEveningFuel = Number(auditRow.fuel_card_balance);
      actualMorningFuel = actualEveningFuel - fuelDayIn + fuelDayOut;
    } else if (isToday) {
      actualEveningFuel = BASE_ACTUAL_FUEL;
      actualMorningFuel = actualEveningFuel - fuelDayIn + fuelDayOut;
    }

    return NextResponse.json({
      date,
      is_today: isToday,
      wallets: {
        bank: {
          id: BANK_ID,
          name: 'Р/С Банк',
          account_number: tbankAccountNum,
          api_synced: isApiSynced,
          morning: actualMorningBank,
          inflow: bankDayIn,
          outflow: bankDayOut,
          evening: actualEveningBank,
        },
        cash: {
          id: CASH_ID,
          name: 'Сейф (Наличные)',
          morning: actualMorningCash,
          inflow: cashDayIn,
          outflow: cashDayOut,
          evening: actualEveningCash,
        },
        fuel_card: {
          id: FUEL_CARD_ID,
          name: 'Топливная карта',
          morning: actualMorningFuel,
          inflow: fuelDayIn,
          outflow: fuelDayOut,
          evening: actualEveningFuel,
        },
      },
      audit: auditRow || null,
      transactions: dayTxs ?? [],
      trip_orders: dayTripOrders ?? [],
      cash_collections: dayCollections ?? [],
      bank_operations: bankStatementOps,
      categories: categoriesList ?? [],
    });
  } catch (err: any) {
    console.error('Error in daily-balance route:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      date,
      safe_cash_actual,
      safe_cash_expected,
      bank_balance,
      fuel_card_balance,
      notes,
      audited_by,
    } = body;

    if (!date) return NextResponse.json({ error: 'Дата обязательна' }, { status: 400 });

    const supabase = createAdminClient();
    const actual = parseFloat(safe_cash_actual ?? '0');
    const expected = parseFloat(safe_cash_expected ?? '0');
    const discrepancy = actual - expected;
    const status = Math.abs(discrepancy) < 0.01 ? 'confirmed' : 'discrepancy';

    const payload = {
      id: date,
      date,
      audited_at: new Date().toISOString(),
      audited_by: audited_by || 'Директор',
      safe_cash_actual: actual,
      safe_cash_expected: expected,
      safe_discrepancy: discrepancy,
      bank_balance: parseFloat(bank_balance ?? '0'),
      fuel_card_balance: parseFloat(fuel_card_balance ?? '0'),
      status,
      notes: notes || '',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase.from('daily_finance_audits') as any)
      .upsert(payload, { onConflict: 'date' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 2. Отправка отчёта руководителю в мессенджер MAX
    const maxToken =
      process.env.MAX_BOT_TOKEN ||
      'f9LHodD0cOKEmAc4Iy6Hq4JXmmVPVRpQ7vULw35IPAeFKQZMIpb1fSAwl5wl_mY1GcLcovMyJXcGngyIqypb';

    const sign = discrepancy >= 0 ? '+' : '';
    const statusEmoji = status === 'confirmed' ? '✅' : '⚠️ РАСХОЖДЕНИЕ!';
    const msg =
      `🔒 СУТОЧНЫЙ АУДИТ КАССЫ — ${date}\n` +
      `Статус: ${statusEmoji}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💼 Сейф (факт): ${actual.toLocaleString('ru-RU')} ₽\n` +
      `📋 Сейф (по учету): ${expected.toLocaleString('ru-RU')} ₽\n` +
      `⚖️ Расхождение: ${sign}${discrepancy.toLocaleString('ru-RU')} ₽\n` +
      `🏦 Р/С Банк: ${parseFloat(bank_balance ?? '0').toLocaleString('ru-RU')} ₽\n` +
      `⛽ Топливная карта: ${parseFloat(fuel_card_balance ?? '0').toLocaleString('ru-RU')} ₽\n` +
      `👤 Проверил: ${audited_by || 'Директор'}\n` +
      (notes ? `💬 Примечание: ${notes}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔗 https://salda-cargo.ru/finance?tab=daily`;

    if (maxToken) {
      try {
        const { data: adminUsers } = await (supabase
          .from('users')
          .select('id, name, max_user_id, roles') as any);

        const recipients = (adminUsers ?? [])
          .filter(
            (u: any) =>
              u.max_user_id &&
              (u.roles?.includes('admin') ||
                u.roles?.includes('owner') ||
                u.roles?.includes('director') ||
                u.roles?.includes('dispatcher')),
          )
          .map((u: any) => u.max_user_id);

        const uniqueRecipients = Array.from(new Set([...recipients, '56628256', '76489387']));

        await Promise.allSettled(
          uniqueRecipients.map(async (userId) => {
            try {
              await fetch(`https://botapi.max.ru/messages?user_id=${userId}`, {
                method: 'POST',
                headers: {
                  Authorization: maxToken,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: msg }),
              });
            } catch (e) {
              console.error(`Failed to send MAX audit notification to ${userId}:`, e);
            }
          }),
        );
      } catch (maxErr) {
        console.error('MAX Bot audit notification error:', maxErr);
      }
    }

    return NextResponse.json({ ok: true, audit: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
