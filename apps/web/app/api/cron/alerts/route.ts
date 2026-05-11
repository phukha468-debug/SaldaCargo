/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Ежедневная рассылка предупреждений в MAX.
 * Vercel Cron: каждый день в 09:00 МСК (06:00 UTC) — см. vercel.json.
 *
 * Для активации:
 * 1. Добавить в .env.local:
 *    MAX_BOT_TOKEN=<токен бота из https://dev.max.ru>
 *    CRON_SECRET=<любая случайная строка>
 * 2. Установить в Vercel Dashboard те же переменные.
 * 3. Раскомментировать проверку CRON_SECRET ниже (рекомендуется).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

const MAX_BOT_API = 'https://botapi.max.ru';

async function sendMaxMessage(maxUserId: string, text: string): Promise<void> {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) return;

  await fetch(`${MAX_BOT_API}/sendMessage?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: maxUserId, text }),
  });
}

function formatDocAlerts(fleet: any[]): string {
  if (!fleet.length) return '';
  const lines = fleet.map((a) => {
    const label = a.type === 'insurance' ? 'Страховка' : 'Техосмотр';
    const status = a.expires_at === null ? 'нет данных' : `истекает ${a.expires_at}`;
    return `  • ${a.asset_name} (${a.reg_number}) — ${label}: ${status}`;
  });
  return `🚨 ДОКУМЕНТЫ (${fleet.length}):\n${lines.join('\n')}`;
}

function formatReceivableAlerts(receivables: any[]): string {
  if (!receivables.length) return '';
  const lines = receivables.map(
    (r) =>
      `  • ${r.counterparty}: ${parseFloat(r.amount).toLocaleString('ru-RU')} ₽ (${r.days_overdue} дн.)`,
  );
  return `💰 ДЕБИТОРКА просрочена 14+ дней (${receivables.length}):\n${lines.join('\n')}`;
}

function formatLoanAlerts(loans: any[]): string {
  if (!loans.length) return '';
  const lines = loans.map((l) => {
    const prefix = l.overdue ? '🔴' : '🟡';
    return `  ${prefix} ${l.lender_name}: ${parseFloat(l.monthly_payment).toLocaleString('ru-RU')} ₽ → ${l.next_payment_date}`;
  });
  return `🏦 КРЕДИТЫ — ближайшие платежи:\n${lines.join('\n')}`;
}

export async function GET(req: NextRequest) {
  // Раскомментировать в продакшне для защиты endpoint'а:
  // const secret = req.headers.get('authorization');
  // if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const supabase = createAdminClient();

    // Получаем данные параллельно
    const [alertsRes, { data: admins }] = await Promise.all([
      fetch(`${req.nextUrl.origin}/api/alerts`).then((r) => r.json()),
      (supabase.from('users') as any)
        .select('id, name, max_user_id')
        .contains('roles', ['admin'])
        .eq('is_active', true)
        .not('max_user_id', 'is', null),
    ]);

    const { fleet = [], receivables = [], loans = [], total = 0 } = alertsRes;

    if (total === 0) {
      return NextResponse.json({ sent: 0, message: 'Нет активных предупреждений' });
    }

    // Формируем текст сообщения
    const sections = [
      `⚠️ SaldaCargo — предупреждения на ${new Date().toLocaleDateString('ru-RU')}`,
      formatDocAlerts(fleet),
      formatReceivableAlerts(receivables),
      formatLoanAlerts(loans),
    ].filter(Boolean);

    const message = sections.join('\n\n');

    // Отправляем всем активным админам и владельцам
    const recipients: string[] = ((admins as any[]) ?? [])
      .map((u: any) => u.max_user_id)
      .filter(Boolean);

    await Promise.allSettled(recipients.map((id) => sendMaxMessage(id, message)));

    return NextResponse.json({ sent: recipients.length, total_alerts: total });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
