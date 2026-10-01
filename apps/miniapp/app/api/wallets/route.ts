/* eslint-disable @typescript-eslint/no-explicit-any */
import https from 'https';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const TBANK_API_HOSTS = ['business.tbank.ru', 'business.tinkoff.ru'];
const TARGET_ACCOUNT_NUMBER = '40802810500001961654';
const TBANK_FALLBACK_TOKEN =
  't.mOBb0LuZQvgaz2LNItGsy45aAjBmikPwHaVqTTpHOGHE-YAh2rNox5C2ZD8kLZJQIstHqyg6G8rQNzVUyQ60JA';

const sum = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

const sumWhere = (rows: any[], key: string, val: string, excludeOrderTx = false) =>
  (rows ?? [])
    .filter((r: any) => r[key] === val && (!excludeOrderTx || !r.trip_order_id))
    .reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

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
        timeout: 8000,
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

export async function GET() {
  try {
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

    const [{ data: bankOrders }, { data: collections }, { data: txIn }, { data: txOut }] =
      await Promise.all([
        // Р/С: bank_invoice + qr (оплаченные)
        (supabase.from('trip_orders') as any)
          .select('amount')
          .in('payment_method', ['bank_invoice', 'qr'])
          .eq('settlement_status', 'completed')
          .eq('lifecycle_status', 'approved'),

        // Инкассации → Сейф
        (supabase.from('cash_collections') as any).select('amount'),

        // Входящие транзакции на кошельки (переводы, прямые доходы)
        (supabase.from('transactions') as any)
          .select('amount, to_wallet_id, trip_order_id')
          .in('to_wallet_id', [BANK_ID, CASH_ID])
          .eq('lifecycle_status', 'approved')
          .eq('settlement_status', 'completed'),

        // Исходящие транзакции из кошельков
        (supabase.from('transactions') as any)
          .select('amount, from_wallet_id')
          .in('from_wallet_id', [BANK_ID, CASH_ID])
          .eq('lifecycle_status', 'approved')
          .eq('settlement_status', 'completed'),
      ]);

    const collectionsTotal = sum(collections ?? []);

    const fallbackBankBalance =
      sum(bankOrders ?? []) +
      sumWhere(txIn ?? [], 'to_wallet_id', BANK_ID, true) -
      sumWhere(txOut ?? [], 'from_wallet_id', BANK_ID);

    const bankBalance = apiBalance !== null ? apiBalance : fallbackBankBalance;

    const cashBalance =
      collectionsTotal +
      sumWhere(txIn ?? [], 'to_wallet_id', CASH_ID) -
      sumWhere(txOut ?? [], 'from_wallet_id', CASH_ID);

    return NextResponse.json({
      bank: {
        id: BANK_ID,
        name: 'Расчётный счёт',
        balance: bankBalance.toFixed(2),
        api_synced: isApiSynced,
      },
      cash: { id: CASH_ID, name: 'Сейф (Наличные)', balance: cashBalance.toFixed(2) },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
