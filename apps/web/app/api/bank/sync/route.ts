import { NextResponse } from 'next/server';
import { syncTBankBalance } from '@/lib/tbank';

/**
 * POST /api/bank/sync
 * Ручная или триггерная синхронизация баланса расчётного счёта из Т-Банка
 */
export async function POST() {
  const result = await syncTBankBalance();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, balance: result.balance });
}

export async function GET() {
  const result = await syncTBankBalance();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, balance: result.balance });
}
