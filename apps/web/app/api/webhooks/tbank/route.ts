/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_ORGANIZATION_ID, getMaxBotEnv } from '@saldacargo/shared';
import {
  BANK_DEBIT_CONTROL_START_ISO,
  getBankOpAmount,
  getBankOpEffectiveDate,
  isBankCommissionOp,
  type TBankOperation,
} from '@saldacargo/domain-service';
import { invalidateDailyBalanceCache } from '../../finance/daily-balance/route';

const MAX_BOT_API = 'https://botapi.max.ru';
const DEFAULT_DIRECTOR_MAX_IDS = ['140695058', '56628256', '76489387'];

function resolveDirectorMaxIds(): string[] {
  const raw = process.env.DIRECTOR_MAX_USER_IDS || process.env.DIRECTOR_MAX_USER_ID;
  if (!raw) return DEFAULT_DIRECTOR_MAX_IDS;
  const parsed = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return parsed.length > 0 ? Array.from(new Set(parsed)) : DEFAULT_DIRECTOR_MAX_IDS;
}

function extractOperationsFromWebhookPayload(payload: any): TBankOperation[] {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.operations)) return payload.operations;
  if (payload.operation && typeof payload.operation === 'object') return [payload.operation];
  if (payload.data && typeof payload.data === 'object') {
    if (Array.isArray(payload.data.operations)) return payload.data.operations;
    if (payload.data.operationId) return [payload.data];
  }
  if (payload.operationId) return [payload];
  return [];
}

function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const shifted = new Date(d.getTime() + 5 * 3600 * 1000);
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = shifted.getUTCFullYear();
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const min = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

/**
 * POST /api/webhooks/tbank
 * Вебхук Т-Бизнес Open API (событие `oper-feed-operation`).
 * При поступлении списания с Р/С мгновенно отправляет директору в MAX уведомление
 * о необходимости привязать сумму к расходной позиции.
 */
export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.TBANK_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const payload = await request.json().catch(() => null);
    if (!payload) {
      return NextResponse.json({ ok: true, ignored: 'empty_payload' });
    }

    const ops = extractOperationsFromWebhookPayload(payload);
    if (ops.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    const supabase = createAdminClient();
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const maxToken = getMaxBotEnv()?.token;
    const directorMaxIds = resolveDirectorMaxIds();

    let notified = 0;

    for (const op of ops) {
      if (op.typeOfOperation !== 'Debit') continue;
      if (isBankCommissionOp(op)) continue;

      const amount = getBankOpAmount(op);
      if (amount <= 0) continue;

      const opId = String(op.operationId || '').trim();
      if (!opId) continue;

      // Проверяем, не привязана ли уже операция
      const [{ data: existingTx }, { data: existingLink }, { data: existingNotifs }] =
        await Promise.all([
          (supabase.from('transactions') as any)
            .select('id')
            .eq('organization_id', organizationId)
            .eq('idempotency_key', opId)
            .maybeSingle(),
          (supabase.from('bank_debit_links') as any)
            .select('id')
            .eq('organization_id', organizationId)
            .eq('bank_operation_id', opId)
            .limit(1)
            .maybeSingle(),
          (supabase.from('bank_debit_notifications') as any)
            .select('recipient_max_id')
            .eq('organization_id', organizationId)
            .eq('bank_operation_id', opId)
            .in('recipient_max_id', directorMaxIds),
        ]);

      if (existingTx || existingLink) continue;

      const alreadySent = new Set(
        ((existingNotifs ?? []) as Array<{ recipient_max_id: string }>).map(
          (row) => row.recipient_max_id,
        ),
      );
      const pendingRecipients = directorMaxIds.filter((id) => !alreadySent.has(id));
      if (pendingRecipients.length === 0) continue;

      const opDate = getBankOpEffectiveDate(op);
      const controlStartMs = new Date(BANK_DEBIT_CONTROL_START_ISO).getTime();
      const opDateMs = new Date(opDate).getTime();
      if (!Number.isNaN(opDateMs) && opDateMs < controlStartMs) continue;
      const receiver = op.receiver?.name || op.counterParty?.name || 'Получатель не указан';
      const desc = (op.description || op.payPurpose || 'Списание с расчётного счёта')
        .replace(/\s+/g, ' ')
        .trim();

      const amountFormatted = amount.toLocaleString('ru-RU', {
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      });

      const botUsername = (
        process.env.NEXT_PUBLIC_MAX_BOT_USERNAME || 'id660704814106_bot'
      ).replace(/^@/, '');
      const miniappDeepLink = `https://max.ru/${botUsername}?startapp=unmatched_debits`;

      const text =
        `💳 Списание с Р/С Т-Банк — требуется привязка\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Сумма: ${amountFormatted} ₽\n` +
        `Дата: ${formatLocalDateTime(opDate)}\n` +
        `Получатель: ${receiver}\n` +
        `Назначение: ${desc}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Привяжите списание к расходной позиции в мини-приложении (или разбейте по статьям), чтобы сумма не потерялась и не задвоилась:\n` +
        `📱 ${miniappDeepLink}`;

      const attachments = [
        {
          type: 'inline_keyboard',
          payload: {
            buttons: [
              [
                {
                  type: 'open_app',
                  text: '🔗 Привязать расход',
                  web_app: botUsername,
                  payload: 'unmatched_debits',
                },
              ],
            ],
          },
        },
      ];

      if (maxToken) {
        await Promise.allSettled(
          pendingRecipients.map(async (recipientId) => {
            const maxRes = await fetch(
              `${MAX_BOT_API}/messages?user_id=${encodeURIComponent(recipientId)}`,
              {
                method: 'POST',
                headers: {
                  Authorization: maxToken,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text, attachments }),
              },
            );

            if (maxRes.ok) {
              await (supabase.from('bank_debit_notifications') as any).upsert(
                {
                  organization_id: organizationId,
                  bank_operation_id: opId,
                  recipient_max_id: recipientId,
                  amount: amount.toFixed(2),
                },
                { onConflict: 'organization_id,bank_operation_id,recipient_max_id' },
              );
              notified++;
            } else {
              console.error(
                `MAX webhook notification failed for ${recipientId}:`,
                maxRes.status,
                await maxRes.text(),
              );
            }
          }),
        );
      }
    }

    invalidateDailyBalanceCache();
    return NextResponse.json({ ok: true, received: ops.length, notified });
  } catch (err: any) {
    console.error('Error in POST /api/webhooks/tbank:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'tbank-webhook' });
}
