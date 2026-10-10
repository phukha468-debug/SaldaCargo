/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Автоматический Cron для официального трудоустройства (ТК РФ) и МАКС-бота.
 *
 * Расписание: каждое утро в 09:00 МСК (06:00 UTC) через Vercel Cron.
 *
 * Выполняет 2 автоматические задачи:
 * 1. 1-го числа каждого месяца в автоматическом режиме создаёт запись налога за
 *    официальное трудоустройство (10 000 ₽) в долг сотрудника (ADVANCE_CATEGORY_ID).
 *    Эта сумма автоматически вычитается из сдельных рейсов водителя при расчёте выплаты.
 *
 * 2. В назначенный день выплаты (например, 25-е или 10-е число месяца) автоматически
 *    отправляет напоминание в мессенджер МАКС директору и администраторам:
 *    - официальная ЗП (22 500 ₽) сотрудникам по ТК РФ;
 *    - удержание приставам (ФССП / алименты) согласно персональной процентовке (например, 34% или 50%);
 *    - остаток на карту водителю;
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
    const res = await fetch(`${MAX_BOT_API}/messages?user_id=${maxUserId}`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[MAX_BOT] Failed to send to ${maxUserId}: HTTP ${res.status} - ${errText}`);
    }
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
        asset:assets!fk_users_current_asset(id, short_name, reg_number)
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
    // ЗАДАЧА 1: 1-е число месяца — Автоматическое начисление долгов сотрудникам:
    // 1) Налог за официальное трудоустройство ТК РФ (10 000 ₽)
    // 2) Долги по исполнительным листам (алименты и ФССП) — вместо разделения по дням!
    // ──────────────────────────────────────────────────────────────────────────
    if (currentDay === 1 || searchParams.get('force_accrual') === 'true') {
      const MONTHLY_TAX_AMOUNT = 10000; // Каждый сотрудник с официальной ЗП платит 10 000 ₽ в счёт компании за налоги

      const { data: adminUser } = await (supabase as any)
        .from('users')
        .select('id')
        .or('roles.cs.{owner},roles.cs.{admin}')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      const adminCreatedBy = adminUser?.id ?? officialList[0]?.id;

      const taxAccruedLines: string[] = [];
      const courtAccruedLines: string[] = [];
      let totalTaxAccrued = 0;
      let totalCourtAccrued = 0;

      // 1.1 Начисление налога ТК РФ (10 000 ₽)
      for (const user of officialList) {
        // Проверяем, нет ли уже начисления налога за этот месяц
        const { data: existingTax } = await (supabase as any)
          .from('transactions')
          .select('id')
          .eq('category_id', ADVANCE_CATEGORY_ID)
          .eq('related_user_id', user.id)
          .ilike('description', `%Налог%${monthName} ${currentYear}%`)
          .limit(1);

        if (existingTax && existingTax.length > 0) {
          results.details.push(
            `Платёж за налоги для ${user.name} уже был создан ранее за ${monthName} ${currentYear}`,
          );
        } else {
          const description = `Налог за официальное трудоустройство (ТК РФ): ${user.name} — ${monthName} ${currentYear}`;
          const idempotencyKey = crypto.randomUUID();

          const { error: insErr } = await (supabase as any).from('transactions').insert({
            direction: 'expense',
            category_id: ADVANCE_CATEGORY_ID,
            amount: MONTHLY_TAX_AMOUNT.toFixed(2),
            description,
            lifecycle_status: 'approved',
            settlement_status: 'completed',
            related_user_id: user.id,
            from_wallet_id: null, // не списывает из кассы, формирует долг сотрудника перед компанией (вычитается из сдельных рейсов)
            transaction_date: new Date(currentYear, currentMonth, 1, 0, 1, 0).toISOString(),
            idempotency_key: idempotencyKey,
            created_by: adminCreatedBy,
          });

          if (insErr) {
            console.error(`Error inserting tax deduction for ${user.name}:`, insErr);
            results.details.push(`Ошибка начисления налога для ${user.name}: ${insErr.message}`);
          } else {
            results.accruals_created++;
            totalTaxAccrued += MONTHLY_TAX_AMOUNT;
            taxAccruedLines.push(
              `• 👤 ${user.name} — ${MONTHLY_TAX_AMOUNT.toLocaleString('ru-RU')} ₽`,
            );
            results.details.push(
              `Начислен налог ${MONTHLY_TAX_AMOUNT} ₽ в долг сотрудника: ${user.name}`,
            );
          }
        }
      }

      // 1.2 Начисление долга за алименты и долги ФССП (1-го числа каждого месяца всем сотрудникам с исп. листами)
      const courtList = officialList.filter((u) => u.has_court_orders);
      for (const user of courtList) {
        const salary = parseFloat(user.official_salary_amount ?? '22500') || 22500;
        const pct = Math.min(100, Math.max(0, parseFloat(user.court_order_pct ?? '50') || 50));
        const courtSum = Math.round(salary * (pct / 100));

        if (courtSum <= 0) continue;

        // Проверяем, не начислен ли уже долг по исполнительному листу / алиментам / ФССП за этот месяц
        const { data: existingCourt } = await (supabase as any)
          .from('transactions')
          .select('id, description')
          .eq('category_id', ADVANCE_CATEGORY_ID)
          .eq('related_user_id', user.id)
          .ilike('description', `%${monthName} ${currentYear}%`)
          .or(
            'description.ilike.%ФССП%,description.ilike.%алимент%,description.ilike.%пристав%,description.ilike.%Исполнительный лист%',
          )
          .limit(1);

        if (existingCourt && existingCourt.length > 0) {
          results.details.push(
            `Долг за алименты/ФССП для ${user.name} уже был начислен ранее за ${monthName} ${currentYear}`,
          );
          continue;
        }

        const noteSuffix = user.court_order_notes ? ` (${user.court_order_notes})` : '';
        const courtDescription = `Исполнительный лист (ФССП / алименты ${pct}%): ${user.name} — ${monthName} ${currentYear}${noteSuffix}`;
        const idempotencyKey = crypto.randomUUID();

        const { error: insCourtErr } = await (supabase as any).from('transactions').insert({
          direction: 'expense',
          category_id: ADVANCE_CATEGORY_ID,
          amount: courtSum.toFixed(2),
          description: courtDescription,
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          related_user_id: user.id,
          from_wallet_id: null,
          transaction_date: new Date(currentYear, currentMonth, 1, 0, 1, 0).toISOString(),
          idempotency_key: idempotencyKey,
          created_by: adminCreatedBy,
        });

        if (insCourtErr) {
          console.error(`Error inserting court order debt for ${user.name}:`, insCourtErr);
          results.details.push(
            `Ошибка начисления долга ФССП/алиментов для ${user.name}: ${insCourtErr.message}`,
          );
        } else {
          results.accruals_created++;
          totalCourtAccrued += courtSum;
          courtAccruedLines.push(
            `• 👤 ${user.name} (${pct}%) — ${courtSum.toLocaleString('ru-RU')} ₽${noteSuffix}`,
          );
          results.details.push(
            `Начислен долг за алименты/ФССП ${courtSum} ₽ (${pct}%) в долг сотрудника: ${user.name}`,
          );
        }
      }

      // Если был начислен хотя бы один долг — отправляем отчёт администраторам в МАКС
      if (taxAccruedLines.length > 0 || courtAccruedLines.length > 0) {
        const messageBlocks: string[] = [
          `📢 ЕЖЕМЕСЯЧНОЕ НАЧИСЛЕНИЕ ДОЛГОВ ПО СОТРУДНИКАМ (1-е ЧИСЛО)`,
          `Сегодня 1 ${monthName} — в долг сотрудников перед компанией начислены обязательные платежи:`,
        ];

        if (taxAccruedLines.length > 0) {
          messageBlocks.push(
            `🏛️ НАЛОГ ЗА ОФИЦИАЛЬНОЕ ТРУДОУСТРОЙСТВО (ТК РФ):\n` +
              taxAccruedLines.join('\n') +
              `\n📊 Всего налог: ${totalTaxAccrued.toLocaleString('ru-RU')} ₽`,
          );
        }

        if (courtAccruedLines.length > 0) {
          messageBlocks.push(
            `⚖️ ИСПОЛНИТЕЛЬНЫЕ ЛИСТЫ (АЛИМЕНТЫ / ФССП):\n` +
              courtAccruedLines.join('\n') +
              `\n📊 Всего удержания приставов: ${totalCourtAccrued.toLocaleString('ru-RU')} ₽`,
          );
        }

        const grandTotal = totalTaxAccrued + totalCourtAccrued;
        messageBlocks.push(
          `📈 ИТОГО НАЧИСЛЕНО ДОЛГА: ${grandTotal.toLocaleString('ru-RU')} ₽\n` +
            `ℹ️ Все суммы зафиксированы в долг с 1-го числа месяца и будут автоматически вычитаться из сдельных выплат за рейсы (вместо разделения по дням).`,
        );
        messageBlocks.push(
          `\n🤖 Сформировано автоматически ботом ТК501 для директора и администратора`,
        );

        const accrualMsg = messageBlocks.join('\n\n');

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
          const sent = await sendMaxMessage(maxUserId, accrualMsg);
          if (sent) results.notifications_sent++;
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ЗАДАЧА 1.5: За 1 день до 1-го числа месяца — Напоминание о начислении долгов
    // ──────────────────────────────────────────────────────────────────────────
    const tomorrow = new Date(currentYear, currentMonth, currentDay + 1);
    const isDayBeforeAccrual = tomorrow.getDate() === 1;

    if (
      (isDayBeforeAccrual || searchParams.get('force_tax_prealert') === 'true') &&
      officialList.length > 0
    ) {
      const nextMonthName = MONTH_NAMES_RU[tomorrow.getMonth()] ?? 'месяца';
      const totalTax = officialList.length * 10000;
      const taxLines = officialList.map((u) => `• 👤 ${u.name} — 10 000 ₽`);

      const courtUsers = officialList.filter((u) => u.has_court_orders);
      let totalCourt = 0;
      const courtLines = courtUsers.map((u) => {
        const s = parseFloat(u.official_salary_amount ?? '22500') || 22500;
        const pct = parseFloat(u.court_order_pct ?? '50') || 50;
        const cSum = Math.round(s * (pct / 100));
        totalCourt += cSum;
        const note = u.court_order_notes ? ` (${u.court_order_notes})` : '';
        return `• 👤 ${u.name} (${pct}%) — ${cSum.toLocaleString('ru-RU')} ₽${note}`;
      });

      const preAlertParts: string[] = [
        `📢 НАПОМИНАНИЕ: ЗАВТРА 1 ${nextMonthName.toUpperCase()} — НАЧИСЛЕНИЕ ДОЛГОВ ПО СОТРУДНИКАМ`,
        `Завтра в 09:00 МСК в систему будет автоматически начислено в долг сотрудникам:`,
        `🏛️ НАЛОГ ТК РФ (10 000 ₽):\n${taxLines.join('\n')}\nВсего налог: ${totalTax.toLocaleString('ru-RU')} ₽`,
      ];

      if (courtLines.length > 0) {
        preAlertParts.push(
          `⚖️ АЛИМЕНТЫ И ДОЛГИ ФССП:\n${courtLines.join('\n')}\nВсего по исп. листам: ${totalCourt.toLocaleString('ru-RU')} ₽`,
        );
      }

      const grandTotalPreAlert = totalTax + totalCourt;
      preAlertParts.push(
        `📊 Всего к начислению: ${grandTotalPreAlert.toLocaleString('ru-RU')} ₽\n` +
          `ℹ️ Начисление сформирует долг сотрудников перед компанией с 1-го числа месяца и будет автоматически вычитаться из сдельной оплаты за рейсы (вместо разделения по дням).\n` +
          `\n🤖 Сформировано автоматически ботом ТК501 для директора и администратора`,
      );

      const preAlertMsg = preAlertParts.join('\n\n');

      const { data: admins } = await (supabase as any)
        .from('users')
        .select('id, name, max_user_id')
        .or('roles.cs.{admin},roles.cs.{owner}')
        .eq('is_active', true)
        .not('max_user_id', 'is', null);

      const recipients: string[] = ((admins as any[]) ?? [])
        .map((a) => a.max_user_id)
        .filter(Boolean);

      let sentCount = 0;
      for (const maxUserId of recipients) {
        const sent = await sendMaxMessage(maxUserId, preAlertMsg);
        if (sent) sentCount++;
      }
      results.notifications_sent += sentCount;
      results.details.push(
        `Отправлено напоминаний за 1 день до начисления долга: ${sentCount} из ${recipients.length}`,
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ЗАДАЧА 2: День выплаты или за 1 день до выплаты — Напоминание в МАКС
    // ──────────────────────────────────────────────────────────────────────────
    const isPayDay = officialList.some((u) => (u.official_salary_day ?? 25) === currentDay);
    const isDayBeforePayDay = officialList.some(
      (u) => (u.official_salary_day ?? 25) === currentDay + 1,
    );

    if (isPayDay || isDayBeforePayDay || searchParams.get('force_notify') === 'true') {
      // Отбираем сотрудников, у которых день выплаты сегодня или завтра
      const dueUsers = officialList.filter(
        (u) =>
          (u.official_salary_day ?? 25) === currentDay ||
          (u.official_salary_day ?? 25) === currentDay + 1 ||
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
          const s = parseFloat(u.official_salary_amount ?? '22500') || 22500;
          totalSalary += s;
          if (u.has_court_orders) {
            const pct = parseFloat(u.court_order_pct ?? '50') || 50;
            const courtSum = Math.round(s * (pct / 100));
            const driverSum = Math.max(0, s - courtSum);
            totalCourtPay += courtSum;
            totalDriversPay += driverSum;
          } else {
            totalDriversPay += s;
          }
        }

        const isAdvanceNotice = isDayBeforePayDay && !isPayDay;
        const targetPayDay = dueUsers[0]?.official_salary_day ?? 25;

        // Формируем аккуратное сообщение в МАКС
        const messageParts: string[] = [];

        if (isAdvanceNotice) {
          messageParts.push(
            `📢 НАПОМИНАНИЕ: ЗАВТРА ${targetPayDay} ${(monthName ?? '').toUpperCase()} — ВЫПЛАТА ОФИЦИАЛЬНОЙ ЧАСТИ ЗП (ТК РФ)`,
          );
          messageParts.push(
            `Завтра день выплаты официальной части ЗП сотрудникам ТК501. Подготовьте переводы.`,
          );
        } else {
          messageParts.push(`📢 НАПОМИНАНИЕ: ВЫПЛАТА ОФИЦИАЛЬНОЙ ЧАСТИ ЗП (ТК РФ)`);
          messageParts.push(
            `Сегодня ${currentDay} ${monthName ?? ''} — день выплаты официальной части ЗП сотрудникам ТК501.`,
          );
        }

        messageParts.push(
          `📊 СВОДНЫЙ РАСЧЁТ:\n` +
            `• Всего официальная часть: ${totalSalary.toLocaleString('ru-RU')} ₽\n` +
            `• ➜ Водителям на карты: ${totalDriversPay.toLocaleString('ru-RU')} ₽\n` +
            `• ➜ Приставам (ФССП / Алименты): ${totalCourtPay.toLocaleString('ru-RU')} ₽\n\n` +
            `ℹ️ Долг сотрудников перед компанией (налог 10 000 ₽ + алименты/ФССП) уже начислен 1-го числа в системе и удерживается из сдельной оплаты за рейсы (без разделения по дням).`,
        );

        // 1. Компактный красный блок предупреждения ФССП
        if (courtUsers.length > 0) {
          const courtLines = courtUsers.map((u) => {
            const s = parseFloat(u.official_salary_amount ?? '22500') || 22500;
            const pct = parseFloat(u.court_order_pct ?? '50') || 50;
            const driverPct = 100 - pct;
            const courtSum = Math.round(s * (pct / 100));
            const driverSum = Math.max(0, s - courtSum);
            const note = u.court_order_notes ? `\n   📌 ${u.court_order_notes}` : '';
            return (
              `👤 ${u.name}\n` +
              `   Официальная ЗП: ${s.toLocaleString('ru-RU')} ₽\n` +
              `   ├ 🏛️ Приставам (${pct}%): ${courtSum.toLocaleString('ru-RU')} ₽\n` +
              `   └ 💳 Водителю на карту (${driverPct}%): ${driverSum.toLocaleString('ru-RU')} ₽${note}`
            );
          });

          messageParts.push(
            `🚨 ВНИМАНИЕ! ИСПОЛНИТЕЛЬНЫЙ ЛИСТ (ФССП / АЛИМЕНТЫ):\n` +
              courtLines.join('\n\n') +
              `\n⚠️ НЕ ПЕРЕВОДИТЬ ВОДИТЕЛЮ 100%! Обязательно перечислить указанный % в РОСП!`,
          );
        }

        // 2. Подробный блок остальных водителей
        if (regularUsers.length > 0) {
          const regularLines = regularUsers.map((u) => {
            const s = parseFloat(u.official_salary_amount ?? '22500') || 22500;
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
