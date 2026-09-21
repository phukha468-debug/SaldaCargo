/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Автоматический Cron для официального трудоустройства (ТК РФ) и МАКС-бота.
 *
 * Расписание: каждое утро в 09:00 МСК (06:00 UTC) через Vercel Cron.
 *
 * Выполняет 2 автоматические задачи:
 * 1. 1-го числа каждого месяца в автоматическом режиме создаёт запись вычета по ТК РФ
 *    (10 000 ₽ или персональная сумма) в долг сотрудника (ADVANCE_CATEGORY_ID).
 *    Эта сумма автоматически вычитается из сдельных рейсов водителя при расчёте выплаты.
 *
 * 2. В назначенный день выплаты (по умолчанию 10-е число месяца) автоматически отправляет
 *    напоминание в мессенджер МАКС директору и администраторам:
 *    - компактный красный блок для водителей с исполнительными листами приставов (ФССП 50/50);
 *    - подробные карточки остальных водителей по ТК РФ (100% на карту с автомобилем);
 *    - сводный расчёт сумм.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

const MAX_BOT_API = 'https://botapi.max.ru';
const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';

const MONTH_NAMES_RU = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

async function sendMaxMessage(maxUserId: string, text: string): Promise<boolean> {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token || !maxUserId) return false;

  try {
    const res = await fetch(`${MAX_BOT_API}/sendMessage?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: maxUserId, text }),
    });
    return res.ok;
  } catch (e) {
    console.error(`[MAX_BOT] Failed to send message to ${maxUserId}:`, e);
    return false;
  }
}

export async function GET(req: NextRequest) {
  return handleOfficialPayrollCron(req);
}

export async function POST(req: NextRequest) {
  return handleOfficialPayrollCron(req);
}

async function handleOfficialPayrollCron(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);

    // Параметры принудительного вызова для тестирования (force_day=1 или force_day=10)
    const now = new Date();
    const currentDay = searchParams.has('force_day')
      ? parseInt(searchParams.get('force_day')!, 10)
      : now.getDate();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const monthName = MONTH_NAMES_RU[currentMonth];

    const results = {
      day: currentDay,
      month: monthName,
      year: currentYear,
      accruals_created: 0,
      notifications_sent: 0,
      details: [] as string[],
    };

    // 1. Получаем всех активных официально устроенных сотрудников (ТК РФ)
    const { data: officialUsers, error: usersErr } = await (supabase as any)
      .from('users')
      .select(
        `
        id, name, phone, roles, max_user_id, current_asset_id,
        is_officially_employed, official_salary_amount, official_salary_day,
        has_court_orders, court_order_pct, court_order_notes,
        asset:assets(id, short_name, reg_number)
      `,
      )
      .eq('is_active', true)
      .eq('is_officially_employed', true)
      .order('name');

    if (usersErr) {
      return NextResponse.json({ error: usersErr.message }, { status: 500 });
    }

    const officialList = (officialUsers as any[]) ?? [];

    // ──────────────────────────────────────────────────────────────────────────
    // ЗАДАЧА 1: 1-е число месяца — Автоматический вычет из сдельных рейсов
    // ──────────────────────────────────────────────────────────────────────────
    if (currentDay === 1 || searchParams.get('force_accrual') === 'true') {
      const monthStart = new Date(currentYear, currentMonth, 1).toISOString();
      const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();

      for (const user of officialList) {
        const amount = parseFloat(user.official_salary_amount ?? '10000');
        if (amount <= 0) continue;

        // Проверяем, нет ли уже вычета по ТК РФ за этот месяц
        const { data: existing } = await (supabase as any)
          .from('transactions')
          .select('id')
          .eq('category_id', ADVANCE_CATEGORY_ID)
          .eq('related_user_id', user.id)
          .gte('transaction_date', monthStart)
          .lte('transaction_date', monthEnd)
          .ilike('description', 'Вычет по ТК РФ%')
          .limit(1);

        if (existing && existing.length > 0) {
          results.details.push(
            `Вычет для ${user.name} уже был создан ранее за ${monthName} ${currentYear}`,
          );
          continue;
        }

        const description = `Вычет по ТК РФ: ${user.name} — ${monthName} ${currentYear}`;

        const { error: insErr } = await (supabase as any).from('transactions').insert({
          direction: 'expense',
          category_id: ADVANCE_CATEGORY_ID,
          amount: amount.toFixed(2),
          description,
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          related_user_id: user.id,
          from_wallet_id: null, // не списывает из кассы, формирует зачёт из сдельных рейсов
          transaction_date: new Date(currentYear, currentMonth, 1, 0, 1, 0).toISOString(),
        });

        if (insErr) {
          console.error(`Error inserting official deduction for ${user.name}:`, insErr);
          results.details.push(`Ошибка вычета для ${user.name}: ${insErr.message}`);
        } else {
          results.accruals_created++;
          results.details.push(`Создан вычет ${amount} ₽ для ${user.name}`);
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ЗАДАЧА 2: День выплаты (по умолчанию 10-е число) — Автонапоминание в МАКС
    // ──────────────────────────────────────────────────────────────────────────
    const isPayDay = officialList.some((u) => (u.official_salary_day ?? 10) === currentDay);

    if (isPayDay || searchParams.get('force_notify') === 'true') {
      // Отбираем сотрудников, у которых день выплаты совпадает с текущим
      const dueUsers = officialList.filter(
        (u) =>
          (u.official_salary_day ?? 10) === currentDay ||
          searchParams.get('force_notify') === 'true',
      );

      if (dueUsers.length > 0) {
        // Делим на водителей с ФССП и обычных
        const courtUsers = dueUsers.filter((u) => u.has_court_orders);
        const regularUsers = dueUsers.filter((u) => !u.has_court_orders);

        let totalSalary = 0;
        let totalDriversPay = 0;
        let totalCourtPay = 0;

        for (const u of dueUsers) {
          const s = parseFloat(u.official_salary_amount ?? '10000');
          totalSalary += s;
          if (u.has_court_orders) {
            const pct = parseFloat(u.court_order_pct ?? '50') / 100;
            const courtSum = Math.round(s * pct);
            const driverSum = s - courtSum;
            totalCourtPay += courtSum;
            totalDriversPay += driverSum;
          } else {
            totalDriversPay += s;
          }
        }

        // Формируем аккуратное сообщение в МАКС
        const messageParts: string[] = [];

        messageParts.push(`📢 НАПОМИНАНИЕ: ВЫПЛАТА ОФИЦИАЛЬНОЙ ЧАСТИ ЗП (ТК РФ)`);
        messageParts.push(
          `Сегодня ${currentDay} ${monthName} — день выплаты официальной части (вычет из рейсов) сотрудникам ТК501.`,
        );

        messageParts.push(
          `📊 СВОДНЫЙ РАСЧЁТ:\n` +
            `• Всего официальная часть: ${totalSalary.toLocaleString('ru-RU')} ₽\n` +
            `• ➜ Водителям на карты: ${totalDriversPay.toLocaleString('ru-RU')} ₽\n` +
            `• ➜ Приставам (ФССП): ${totalCourtPay.toLocaleString('ru-RU')} ₽`,
        );

        // 1. Компактный красный блок предупреждения ФССП (уменьшен на 1/3)
        if (courtUsers.length > 0) {
          const courtLines = courtUsers.map((u) => {
            const s = parseFloat(u.official_salary_amount ?? '10000');
            const pct = parseFloat(u.court_order_pct ?? '50') / 100;
            const courtSum = Math.round(s * pct);
            const driverSum = s - courtSum;
            const note = u.court_order_notes ? `\n   📌 ${u.court_order_notes}` : '';
            return (
              `👤 ${u.name}\n` +
              `   Сумма ТК РФ: ${s.toLocaleString('ru-RU')} ₽\n` +
              `   ├ 🏛️ Приставам (50%): ${courtSum.toLocaleString('ru-RU')} ₽\n` +
              `   └ 💳 Водителю на карту: ${driverSum.toLocaleString('ru-RU')} ₽${note}`
            );
          });

          messageParts.push(
            `🚨 ВНИМАНИЕ! ИСПОЛНИТЕЛЬНЫЙ ЛИСТ (ФССП 50%):\n` +
              courtLines.join('\n\n') +
              `\n⚠️ НЕ ПЕРЕВОДИТЬ ВОДИТЕЛЮ 100%! Обязательно перечислить 50% в РОСП!`,
          );
        }

        // 2. Подробный блок остальных водителей (+1/3 объема)
        if (regularUsers.length > 0) {
          const regularLines = regularUsers.map((u) => {
            const s = parseFloat(u.official_salary_amount ?? '10000');
            const car = u.asset
              ? `${u.asset.short_name} (${u.asset.reg_number})`
              : 'Авто не привязано';
            return (
              `• 👤 ${u.name} — ${s.toLocaleString('ru-RU')} ₽\n` +
              `  Машина: ${car}\n` +
              `  Перечисление: 100% на карту водителя`
            );
          });

          messageParts.push(
            `💳 Остальные водители по ТК РФ (без удержаний):\n` + regularLines.join('\n\n'),
          );
        }

        messageParts.push(
          `\n🤖 Сформировано автоматически ботом ТК501 для директора и администратора`,
        );

        const maxMessageText = messageParts.join('\n\n');

        // Получаем админов и владельцев с max_user_id
        const { data: admins } = await (supabase as any)
          .from('users')
          .select('id, name, max_user_id')
          .or('roles.cs.{admin},roles.cs.{owner}')
          .eq('is_active', true)
          .not('max_user_id', 'is', null);

        const recipients: string[] = ((admins as any[]) ?? [])
          .map((a) => a.max_user_id)
          .filter(Boolean);

        for (const maxUserId of recipients) {
          const sent = await sendMaxMessage(maxUserId, maxMessageText);
          if (sent) results.notifications_sent++;
        }

        results.details.push(
          `Отправлено уведомлений в МАКС: ${results.notifications_sent} из ${recipients.length}`,
        );
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error('Error in official payroll cron:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Внутренняя ошибка сервера' },
      { status: 500 },
    );
  }
}
