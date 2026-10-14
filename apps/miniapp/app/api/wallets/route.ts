/* eslint-disable @typescript-eslint/no-explicit-any */
import https from 'https';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';
const GARAGE_ID = '10000000-0000-0000-0000-000000000005';
const TBANK_API_HOSTS = ['business.tbank.ru', 'business.tinkoff.ru'];
const TARGET_ACCOUNT_NUMBER = '40802810500001961654';
const TBANK_FALLBACK_TOKEN =
  't.mOBb0LuZQvgaz2LNItGsy45aAjBmikPwHaVqTTpHOGHE-YAh2rNox5C2ZD8kLZJQIstHqyg6G8rQNzVUyQ60JA';

const sum = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let cachedWallets: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 25000; // 25 seconds TTL

function requestTBankApi(host: string, path: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        port: 443,
        path,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        rejectUnauthorized: false,
        timeout: 2500,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch {
              reject(new Error('Invalid JSON'));
            }
          } else {
            reject(new Error(`T-Bank API error (${res.statusCode})`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

async function fetchTBankAccounts(token: string): Promise<any[] | null> {
  for (const host of TBANK_API_HOSTS) {
    try {
      const data = await requestTBankApi(host, '/openapi/api/v3/bank-accounts', token);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.accounts)) return data.accounts;
    } catch {
      // try next host
    }
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const forceFresh = url.searchParams.get('fresh') === 'true';

    if (!forceFresh && cachedWallets && Date.now() - cachedWallets.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedWallets.data, {
        headers: {
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
          'X-Cache': 'HIT',
        },
      });
    }

    let apiBalance: number | null = null;
    let isApiSynced = false;
    const token = process.env.TBANK_API_TOKEN || TBANK_FALLBACK_TOKEN;

    if (token) {
      try {
        const accounts = await fetchTBankAccounts(token);
        if (accounts && accounts.length > 0) {
          const target =
            accounts.find((a: any) => a.accountNumber === TARGET_ACCOUNT_NUMBER) || accounts[0];
          const otb = typeof target?.balance?.otb === 'number' ? target.balance.otb : 0;
          const authorized =
            typeof target?.balance?.authorized === 'number' ? target.balance.authorized : 0;
          apiBalance = otb + authorized;
          isApiSynced = true;
        }
      } catch (e) {
        console.error('TBank API fetch in miniapp:', e);
      }
    }

    const supabase = createAdminClient();

    // Получаем последний подтвержденный вечерний аудит (базовая точка отсчета)
    const { data: latestAudit } = await (supabase.from('daily_finance_audits') as any)
      .select('*')
      .eq('status', 'confirmed')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseCash = Number(latestAudit?.safe_cash_actual ?? 29000);
    const baseFuel = Number(latestAudit?.fuel_card_balance ?? 6642.05);
    const auditCutoff = latestAudit?.audited_at || `${latestAudit?.date ?? '2026-10-12'}T13:04:34Z`;

    const [
      { data: bankOrders },
      { data: bankIn },
      { data: bankOut },
      { data: collectionsAfterAudit },
      { data: cashInAfterAudit },
      { data: cashOutAfterAudit },
      { data: fuelInAfterAudit },
      { data: fuelOutAfterAudit },
      { data: garageIn },
      { data: garageOut },
    ] = await Promise.all([
      // Р/С: bank_invoice + qr (оплаченные)
      (supabase.from('trip_orders') as any)
        .select('amount')
        .in('payment_method', ['bank_invoice', 'qr'])
        .eq('settlement_status', 'completed')
        .eq('lifecycle_status', 'approved'),

      (supabase.from('transactions') as any)
        .select('amount, trip_order_id')
        .eq('to_wallet_id', BANK_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', BANK_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      // Инкассации → Сейф после аудита
      (supabase.from('cash_collections') as any).select('amount').gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', CASH_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', CASH_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', FUEL_CARD_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', FUEL_CARD_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed')
        .gt('created_at', auditCutoff),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('to_wallet_id', GARAGE_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),

      (supabase.from('transactions') as any)
        .select('amount')
        .eq('from_wallet_id', GARAGE_ID)
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'completed'),
    ]);

    const bankInWithoutOrders = (bankIn ?? [])
      .filter((r: any) => !r.trip_order_id)
      .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

    const fallbackBankBalance = sum(bankOrders ?? []) + bankInWithoutOrders - sum(bankOut ?? []);

    const bankBalance = apiBalance !== null ? apiBalance : fallbackBankBalance;

    const cashBalance =
      baseCash +
      sum(collectionsAfterAudit ?? []) +
      sum(cashInAfterAudit ?? []) -
      sum(cashOutAfterAudit ?? []);

    const fuelBalance = baseFuel + sum(fuelInAfterAudit ?? []) - sum(fuelOutAfterAudit ?? []);

    const garageBalance = sum(garageIn ?? []) - sum(garageOut ?? []);

    const responseData = {
      bank: {
        id: BANK_ID,
        name: 'Расчётный счёт',
        balance: bankBalance.toFixed(2),
        api_synced: isApiSynced,
        synced_at: new Date().toISOString(),
        account_number: TARGET_ACCOUNT_NUMBER,
      },
      cash: { id: CASH_ID, name: 'Сейф (Наличные ТК)', balance: cashBalance.toFixed(2) },
      fuel_card: {
        id: FUEL_CARD_ID,
        name: 'Топливные карты (ГСМ)',
        balance: fuelBalance.toFixed(2),
      },
      garage: {
        id: GARAGE_ID,
        name: 'Касса Гаража (СТО)',
        balance: garageBalance.toFixed(2),
      },
    };

    cachedWallets = {
      data: responseData,
      timestamp: Date.now(),
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
        'X-Cache': 'MISS',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
