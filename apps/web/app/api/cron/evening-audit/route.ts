/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_ORGANIZATION_ID,
  hasModule,
  verifyCronAuthorization,
  notifyCronFailure,
} from '@saldacargo/shared';
import {
  getIntegrationConfig,
  type MaxBotIntegrationCredentials,
} from '@saldacargo/domain-service';

const MAX_BOT_API = 'https://botapi.max.ru';

export const dynamic = 'force-dynamic';

async function sendMaxMessage(token: string, maxUserId: string, text: string): Promise<boolean> {
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
 * о сверке суточного баланса, сейфа и банковской выписки (multi-tenant).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronAuth = verifyCronAuthorization(authHeader);
  if (!cronAuth.ok) {
    return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });
  }

  try {
    const supabase = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: orgs } = await (supabase.from('organizations') as any)
      .select('id, name, slug, enabled_modules')
      .eq('is_active', true);

    const activeOrgs: Array<{
      id: string;
      name: string;
      slug: string;
      enabled_modules?: string[];
    }> =
      Array.isArray(orgs) && orgs.length > 0
        ? orgs
        : [
            {
              id: DEFAULT_ORGANIZATION_ID,
              name: 'ТК501',
              slug: 'tk501',
              enabled_modules: ['finance'],
            },
          ];

    const orgResults: Array<{
      organizationId: string;
      skipped?: string;
      sentTo?: number;
    }> = [];

    for (const org of activeOrgs) {
      if (!hasModule(org.enabled_modules, 'finance')) {
        orgResults.push({ organizationId: org.id, skipped: 'module_disabled' });
        continue;
      }

      const maxBot = await getIntegrationConfig<MaxBotIntegrationCredentials>(
        supabase,
        org.id,
        'max_bot',
      );
      if (!maxBot.isEnabled || !maxBot.credentials.token) {
        orgResults.push({ organizationId: org.id, skipped: 'max_bot_disabled' });
        continue;
      }

      const { data: audit } = await (supabase.from('daily_finance_audits') as any)
        .select('status, audited_by, safe_cash_actual')
        .eq('organization_id', org.id)
        .eq('date', today)
        .maybeSingle();

      if (audit?.status === 'confirmed') {
        orgResults.push({ organizationId: org.id, skipped: 'already_confirmed' });
        continue;
      }

      const origin = req.nextUrl.origin;
      const balanceRes = await fetch(
        `${origin}/api/finance/daily-balance?date=${today}&organization_id=${encodeURIComponent(org.id)}`,
        {
          headers: authHeader ? { Authorization: authHeader } : undefined,
          cache: 'no-store',
        },
      )
        .then((r) => r.json())
        .catch(() => null);

      const safeExpected = balanceRes?.wallets?.cash?.evening ?? 0;
      const bankBalance = balanceRes?.wallets?.bank?.evening ?? 0;
      const fuelBalance = balanceRes?.wallets?.fuel_card?.evening ?? 0;

      const rub = (n: number) => n.toLocaleString('ru-RU') + ' ₽';

      const message =
        `⏰ 19:30 — КОНТРОЛЬ СУТОЧНОГО БАЛАНСА (${org.name})\n` +
        `Дата: ${today}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔒 Сейф (расчетная сумма): ${rub(safeExpected)}\n` +
        `🏦 Р/С Банк: ${rub(bankBalance)}\n` +
        `⛽ Топливная карта (ГСМ): ${rub(fuelBalance)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ Напоминание руководителю: пересчитайте фактическую сумму наличных в сейфе и подтвердите суточный аудит в разделе «Финансы» -> «Суточный контроль».`;

      const { data: users } = await (supabase
        .from('users')
        .select('id, name, max_user_id, roles')
        .eq('default_organization_id', org.id)
        .eq('is_active', true) as any);

      const recipients = (users ?? [])
        .filter(
          (u: any) =>
            u.max_user_id &&
            (u.roles?.includes('admin') ||
              u.roles?.includes('owner') ||
              u.roles?.includes('director') ||
              u.roles?.includes('dispatcher')),
        )
        .map((u: any) => String(u.max_user_id));

      const uniqueRecipients = Array.from(new Set(recipients)) as string[];

      await Promise.allSettled(
        uniqueRecipients.map((uid) => sendMaxMessage(maxBot.credentials.token!, uid, message)),
      );

      orgResults.push({ organizationId: org.id, sentTo: uniqueRecipients.length });
    }

    return NextResponse.json({
      ok: true,
      date: today,
      organizations: orgResults,
    });
  } catch (err: any) {
    await notifyCronFailure('evening-audit', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
