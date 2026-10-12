/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

const MAX_BOT_API = 'https://botapi.max.ru';
const DEFAULT_MAX_TOKEN =
  'f9LHodD0cOKEmAc4Iy6Hq4JXmmVPVRpQ7vULw35IPAeFKQZMIpb1fSAwl5wl_mY1GcLcovMyJXcGngyIqypb';

export const dynamic = 'force-dynamic';

async function sendMaxMessage(maxUserId: string, text: string): Promise<boolean> {
  const token = process.env.MAX_BOT_TOKEN || DEFAULT_MAX_TOKEN;
  if (!token || !maxUserId) return false;

  try {
    const res = await fetch(`${MAX_BOT_API}/messages?user_id=${maxUserId}`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch (e) {
    console.error(`[MAX_BOT] Failed to send evening audit reminder to ${maxUserId}:`, e);
    return false;
  }
}

/**
 * GET /api/cron/evening-audit — Ежедневное напоминание в 19:30 директору в мессенджер MAX
 * о сверке суточного баланса, сейфа и банковской выписки.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    // Проверяем, был ли уже выполнен аудит за сегодня
    const { data: audit } = await (supabase.from('daily_finance_audits') as any)
      .select('status, audited_by, safe_cash_actual')
      .eq('date', today)
      .maybeSingle();

    if (audit?.status === 'confirmed') {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: `Аудит за ${today} уже подтверждён (${audit.audited_by})`,
      });
    }

    // Получаем текущие расчетные балансы дня
    const origin = req.nextUrl.origin;
    const balanceRes = await fetch(`${origin}/api/finance/daily-balance?date=${today}`, {
      cache: 'no-store',
    })
      .then((r) => r.json())
      .catch(() => null);

    const safeExpected = balanceRes?.wallets?.cash?.evening ?? 0;
    const bankBalance = balanceRes?.wallets?.bank?.evening ?? 0;
    const fuelBalance = balanceRes?.wallets?.fuel_card?.evening ?? 0;

    const rub = (n: number) => n.toLocaleString('ru-RU') + ' ₽';

    const message =
      `⏰ 19:30 — КОНТРОЛЬ СУТОЧНОГО БАЛАНСА И КАССЫ\n` +
      `Дата: ${today}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔒 Сейф (расчетная сумма): ${rub(safeExpected)}\n` +
      `🏦 Р/С Банк (по API Т-Банка): ${rub(bankBalance)}\n` +
      `⛽ Топливная карта (ГСМ): ${rub(fuelBalance)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ Напоминание руководителю: пожалуйста, пересчитайте фактическую сумму наличных в сейфе и подтвердите правильность заполнения таблицы в разделе «Финансы» -> «Суточный контроль».\n\n` +
      `🔗 https://salda-cargo.ru/finance?tab=daily`;

    // Находим получателей (администраторы, владельцы и директор)
    const { data: users } = await (supabase
      .from('users')
      .select('id, name, max_user_id, roles') as any);

    const recipients = (users ?? [])
      .filter(
        (u: any) =>
          u.max_user_id &&
          (u.roles?.includes('admin') ||
            u.roles?.includes('owner') ||
            u.roles?.includes('director') ||
            u.roles?.includes('dispatcher')),
      )
      .map((u: any) => u.max_user_id);

    // Добавляем ID руководителя из настроек по умолчанию
    const uniqueRecipients = Array.from(new Set([...recipients, '56628256', '76489387']));

    const results = await Promise.allSettled(
      uniqueRecipients.map((uid) => sendMaxMessage(uid, message)),
    );

    return NextResponse.json({
      ok: true,
      date: today,
      sent_to: uniqueRecipients.length,
      results,
    });
  } catch (err: any) {
    console.error('Error in evening-audit cron:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
