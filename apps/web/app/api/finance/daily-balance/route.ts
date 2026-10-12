/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { syncTBankBalance } from '@/lib/tbank';
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

    // 1. Fetch live T-Bank balance if today
    let apiBalance: number | null = null;
    let isApiSynced = false;
    let tbankAccountNum = '';
    const isToday = date === new Date().toISOString().slice(0, 10);

    if (isToday) {
      try {
        const syncPromise = syncTBankBalance();
        const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'TBank timeout' }), 2500),
        );
        const syncResult = (await Promise.race([syncPromise, timeoutPromise])) as any;
        if (syncResult?.success && typeof syncResult.balance === 'number') {
          apiBalance = syncResult.balance;
          isApiSynced = true;
          tbankAccountNum = syncResult.accountNumber || '';
        }
      } catch (e) {
        console.error('TBank auto-sync error in daily-balance:', e);
      }
    }

    // 2. Fetch all transactions for this day
    const txSelect =
      'id, amount, direction, description, created_at, from_wallet_id, to_wallet_id, category_id, counterparty_id, related_user_id, ' +
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
      // Transactions of the day
      (supabase.from('transactions') as any)
        .select(txSelect)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .or('from_wallet_id.not.is.null,to_wallet_id.not.is.null')
        .or('description.is.null,description.neq.Корректировка остатка')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .order('created_at', { ascending: false }),

      // Trip orders settled on this day (Bank income)
      (supabase.from('trip_orders') as any)
        .select(
          'id, amount, created_at, payment_method, description, counterparty:counterparties(id, name), trip:trips!inner(trip_number, driver:users!trips_driver_id_fkey(name))',
        )
        .in('payment_method', ['bank_invoice', 'qr'])
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd),

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
      }
    }

    const eveningBankCalc = morningBank + bankDayIn - bankDayOut;
    const eveningCashCalc = morningCash + cashDayIn - cashDayOut;
    const eveningFuelCalc = morningFuel + fuelDayIn - fuelDayOut;

    const actualEveningBank = isToday && apiBalance !== null ? apiBalance : eveningBankCalc;

    return NextResponse.json({
      date,
      is_today: isToday,
      wallets: {
        bank: {
          id: BANK_ID,
          name: 'Р/С Банк',
          account_number: tbankAccountNum,
          api_synced: isApiSynced,
          morning: morningBank,
          inflow: bankDayIn,
          outflow: bankDayOut,
          evening: actualEveningBank,
        },
        cash: {
          id: CASH_ID,
          name: 'Сейф (Наличные)',
          morning: morningCash,
          inflow: cashDayIn,
          outflow: cashDayOut,
          evening: eveningCashCalc,
        },
        fuel_card: {
          id: FUEL_CARD_ID,
          name: 'Топливная карта',
          morning: morningFuel,
          inflow: fuelDayIn,
          outflow: fuelDayOut,
          evening: eveningFuelCalc,
        },
      },
      audit: auditRow || null,
      transactions: dayTxs ?? [],
      trip_orders: dayTripOrders ?? [],
      cash_collections: dayCollections ?? [],
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

    // Optional Telegram notification if bot token is present
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChatId) {
      try {
        const sign = discrepancy >= 0 ? '+' : '';
        const statusEmoji = status === 'confirmed' ? '✅' : '⚠️ РАСХОЖДЕНИЕ!';
        const msg =
          `🔒 *СУТОЧНЫЙ АУДИТ КАССЫ — ${date}*\n` +
          `Статус: ${statusEmoji}\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `💼 *Сейф (факт):* ${actual.toLocaleString('ru-RU')} ₽\n` +
          `📋 *Сейф (по учету):* ${expected.toLocaleString('ru-RU')} ₽\n` +
          `⚖️ *Расхождение:* ${sign}${discrepancy.toLocaleString('ru-RU')} ₽\n` +
          `🏦 *Р/С Банк:* ${parseFloat(bank_balance ?? '0').toLocaleString('ru-RU')} ₽\n` +
          `⛽ *Топливная карта:* ${parseFloat(fuel_card_balance ?? '0').toLocaleString('ru-RU')} ₽\n` +
          `👤 Проверил: ${audited_by || 'Директор'}\n` +
          (notes ? `💬 Примечание: ${notes}` : '');

        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: 'Markdown' }),
        });
      } catch (tgErr) {
        console.error('Failed to send Telegram audit notification:', tgErr);
      }
    }

    return NextResponse.json({ ok: true, audit: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
