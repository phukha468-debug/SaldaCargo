/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_ORGANIZATION_ID,
  verifyCronAuthorization,
  notifyCronFailure,
} from '@saldacargo/shared';
import {
  getIntegrationConfig,
  type MaxBotIntegrationCredentials,
} from '@saldacargo/domain-service';

const MAX_BOT_API = 'https://botapi.max.ru';

async function sendMaxMessage(token: string, maxUserId: string, text: string): Promise<void> {
  if (!token || !maxUserId) return;

  try {
    await fetch(`${MAX_BOT_API}/messages?user_id=${maxUserId}`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.error(`[MAX_BOT] Failed to send alert to ${maxUserId}:`, e);
  }
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
  const authHeader = req.headers.get('authorization');
  const cronAuth = verifyCronAuthorization(authHeader);
  if (!cronAuth.ok) {
    return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });
  }

  try {
    const supabase = createAdminClient();
    const { data: orgs } = await (supabase.from('organizations') as any)
      .select('id, name, slug')
      .eq('is_active', true);

    const activeOrgs: Array<{ id: string; name: string; slug: string }> =
      Array.isArray(orgs) && orgs.length > 0
        ? orgs
        : [{ id: DEFAULT_ORGANIZATION_ID, name: 'ТК501', slug: 'tk501' }];

    let totalSent = 0;
    const summary: Array<{ organizationId: string; sent: number; totalAlerts: number }> = [];

    for (const org of activeOrgs) {
      const maxBot = await getIntegrationConfig<MaxBotIntegrationCredentials>(
        supabase,
        org.id,
        'max_bot',
      );
      if (!maxBot.isEnabled || !maxBot.credentials.token) {
        continue;
      }

      const [alertsRes, { data: admins }] = await Promise.all([
        fetch(`${req.nextUrl.origin}/api/alerts?organization_id=${encodeURIComponent(org.id)}`, {
          headers: authHeader ? { Authorization: authHeader } : undefined,
          cache: 'no-store',
        }).then((r) => r.json()),
        (supabase.from('users') as any)
          .select('id, name, max_user_id')
          .eq('default_organization_id', org.id)
          .contains('roles', ['admin'])
          .eq('is_active', true)
          .not('max_user_id', 'is', null),
      ]);

      const { fleet = [], receivables = [], loans = [], total = 0 } = alertsRes;
      if (total === 0) {
        summary.push({ organizationId: org.id, sent: 0, totalAlerts: 0 });
        continue;
      }

      const sections = [
        `⚠️ ${org.name} — предупреждения на ${new Date().toLocaleDateString('ru-RU')}`,
        formatDocAlerts(fleet),
        formatReceivableAlerts(receivables),
        formatLoanAlerts(loans),
      ].filter(Boolean);

      const message = sections.join('\n\n');
      const recipients: string[] = ((admins as any[]) ?? [])
        .map((u: any) => u.max_user_id)
        .filter(Boolean);

      await Promise.allSettled(
        recipients.map((id) => sendMaxMessage(maxBot.credentials.token!, id, message)),
      );

      totalSent += recipients.length;
      summary.push({ organizationId: org.id, sent: recipients.length, totalAlerts: total });
    }

    return NextResponse.json({ sent: totalSent, organizations: summary });
  } catch (err: any) {
    await notifyCronFailure('alerts', err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
