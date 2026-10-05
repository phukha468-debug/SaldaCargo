/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

function getLocalFilePath(filename: string): string {
  const inAppsWeb = path.join(process.cwd(), 'apps', 'web', 'data', filename);
  if (fs.existsSync(inAppsWeb)) return inAppsWeb;
  const inCwd = path.join(process.cwd(), 'data', filename);
  if (fs.existsSync(inCwd)) return inCwd;
  return inAppsWeb;
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Ignore error in serverless read-only environments
  }
}

export type ObligationItem = {
  id: string;
  title: string;
  category:
    | 'rent'
    | 'fuel'
    | 'comms'
    | 'salary'
    | 'court_order'
    | 'leasing_loan'
    | 'tax'
    | 'insurance'
    | 'other';
  amount: number;
  due_day: number;
  frequency: 'monthly' | 'weekly' | 'quarterly' | 'one_time';
  preferred_wallet_id?: string;
  recipient?: string;
  notes?: string;
  is_active: boolean;
  is_loan?: boolean;
  loan_id?: string;
  is_salary_rule?: boolean;
  payment_type?: 'fixed' | 'variable';
  target_period?: string;
};

export type CalendarStatus = 'paid' | 'due_today' | 'planned' | 'overdue';

export type CalendarResponseItem = ObligationItem & {
  status: CalendarStatus;
  due_date: string; // YYYY-MM-DD
  days_left: number;
  paid_amount?: number;
  paid_at?: string;
  paid_wallet?: string;
};

/** GET /api/payment-calendar — получение календаря обязательных платежей и прогноза кассового разрыва */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const period =
      searchParams.get('period') ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [yearStr, monthStr] = period.split('-');
    const currentYear = parseInt(yearStr || `${now.getFullYear()}`);
    const currentMonth = parseInt(monthStr || `${now.getMonth() + 1}`);

    const supabase = createAdminClient();

    const SALARY_CATEGORY_IDS = [
      'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // PAYROLL_DRIVER
      '18792fa8-fda8-472d-8e04-e19d2c6c053c', // PAYROLL_LOADER
      '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // PAYROLL_MECHANIC
    ];

    // 1. Параллельно получаем балансы, кредиты, долг по ЗП, обязательства и переопределения из Supabase
    const [
      { data: walletsRes },
      { data: loansRes },
      { data: salaryPendingRes },
      { data: dbObligations, error: dbOblErr },
      { data: dbOverrides, error: dbOvrErr },
    ] = await Promise.all([
      (supabase.from('wallets') as any).select('id, name, balance'),
      (supabase.from('loans') as any).select('*').eq('is_active', true),
      (supabase.from('transactions') as any)
        .select('amount, description')
        .eq('direction', 'expense')
        .eq('lifecycle_status', 'approved')
        .eq('settlement_status', 'pending')
        .in('category_id', SALARY_CATEGORY_IDS)
        .not('related_user_id', 'is', null)
        .is('from_wallet_id', null),
      (supabase.from('payment_calendar_obligations') as any).select('*').eq('is_active', true),
      (supabase.from('payment_calendar_overrides') as any).select('*').eq('period', period),
    ]);

    const liveSalaryDebt = (salaryPendingRes ?? []).reduce((sum: number, tx: any) => {
      if (tx.description && tx.description.startsWith('Выплата зарплаты')) return sum;
      return sum + (parseFloat(tx.amount ?? '0') || 0);
    }, 0);

    const bankWallet = (walletsRes ?? []).find((w: any) => w.id === BANK_ID);
    const cashWallet = (walletsRes ?? []).find((w: any) => w.id === CASH_ID);
    const bankBalance = parseFloat(bankWallet?.balance ?? '0');
    const cashBalance = parseFloat(cashWallet?.balance ?? '0');
    const totalCash = bankBalance + cashBalance;

    // Считываем локальные файлы как резервный источник
    const localOblPath = getLocalFilePath('payment_obligations.json');
    const localSetPath = getLocalFilePath('payment_settlements.json');
    const fallbackObligations = readJsonFile<ObligationItem[]>(localOblPath, []);
    const localSettlements = readJsonFile<Record<string, Record<string, any>>>(localSetPath, {});
    const localMonthSettlements = localSettlements[period] || {};

    // Собираем карту переопределений для текущего месяца (Supabase приоритет, fallback из локального JSON)
    const monthOverrides: Record<string, any> = { ...localMonthSettlements };
    if (!dbOvrErr && Array.isArray(dbOverrides)) {
      for (const ov of dbOverrides) {
        monthOverrides[ov.obligation_id] = {
          ...monthOverrides[ov.obligation_id],
          ...ov,
        };
      }
    }

    // 2. Формируем список базовых обязательств (из Supabase, либо fallback из файла)
    let baseObligations: ObligationItem[] = [];
    if (!dbOblErr && Array.isArray(dbObligations) && dbObligations.length > 0) {
      baseObligations = dbObligations.map((o: any) => ({
        id: o.id,
        title: o.title,
        category: o.category,
        amount: parseFloat(o.amount ?? '0'),
        due_day: o.due_day,
        frequency: o.frequency,
        payment_type: o.payment_type || 'fixed',
        target_period: o.target_period || undefined,
        preferred_wallet_id: o.preferred_wallet_id || BANK_ID,
        recipient: o.recipient || '',
        notes: o.notes || '',
        is_active: o.is_active,
      }));
    } else {
      baseObligations = fallbackObligations;
    }

    // 3. Добавляем активные лизинги и кредиты из таблицы loans с учетом переопределений
    const loanObligations: ObligationItem[] = [];
    for (const l of loansRes ?? []) {
      const loanItemId = `loan-${l.id}`;
      const override = monthOverrides[loanItemId];
      if (override?.deleted) continue; // удалено пользователем

      let defaultDay = 15;
      if (l.next_payment_date) {
        defaultDay = new Date(l.next_payment_date).getDate();
      } else if (l.started_at) {
        defaultDay = new Date(l.started_at).getDate();
      }

      const isLeasing = l.loan_type === 'leasing';
      const defaultTitle = isLeasing
        ? `Лизинг: ${l.lender_name}`
        : `Кредит: ${l.lender_name} (${l.purpose || 'платеж'})`;

      const amount =
        typeof override?.custom_amount === 'number' && override.custom_amount > 0
          ? override.custom_amount
          : parseFloat(l.monthly_payment ?? '0') || 0;

      if (amount <= 0 && !override?.custom_amount) continue;

      loanObligations.push({
        id: loanItemId,
        title: override?.custom_title || defaultTitle,
        category: override?.custom_category || 'leasing_loan',
        amount,
        due_day: override?.custom_due_day || defaultDay,
        frequency: 'monthly',
        payment_type: override?.payment_type || 'fixed',
        preferred_wallet_id: override?.custom_wallet_id || BANK_ID,
        recipient: override?.custom_recipient || l.lender_name,
        notes:
          override?.custom_notes ||
          `Остаток долга: ${parseFloat(l.remaining_amount ?? '0').toLocaleString('ru-RU')} ₽${l.annual_rate ? `, ставка ${l.annual_rate}%` : ''}`,
        is_active: true,
        is_loan: true,
        loan_id: l.id,
      });
    }

    // 4. Правило: каждую пятницу выплата Зарплаты (сумма подтягивается из раздела Персонал)
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const fridayObligations: ObligationItem[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dObj = new Date(currentYear, currentMonth - 1, day);
      if (dObj.getDay() === 5) {
        // 5 — пятница
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const fridayId = `salary-friday-${dateStr}`;
        const override = monthOverrides[fridayId];

        // Проверяем, не удалил ли пользователь это событие
        if (override?.deleted) {
          continue;
        }

        const isSettled = Boolean(
          override && typeof override.paid_amount === 'number' && override.paid_amount > 0,
        );

        const defaultAmount = liveSalaryDebt > 0 ? liveSalaryDebt : 120000;
        const amount = isSettled
          ? override.paid_amount
          : typeof override?.custom_amount === 'number' && override.custom_amount > 0
            ? override.custom_amount
            : defaultAmount;

        fridayObligations.push({
          id: fridayId,
          title: override?.custom_title || 'Выплата зарплаты (Пятница)',
          category: override?.custom_category || 'salary',
          amount,
          due_day: override?.custom_due_day || day,
          frequency: 'weekly',
          payment_type: override?.payment_type || 'fixed',
          preferred_wallet_id: override?.custom_wallet_id || BANK_ID,
          recipient:
            override?.custom_recipient || 'Штат сотрудников (водители, механики, грузчики)',
          notes:
            override?.custom_notes ||
            `Еженедельная выплата ЗП по пятницам (долг из раздела «Персонал»: ${liveSalaryDebt.toLocaleString('ru-RU')} ₽)`,
          is_active: true,
          is_salary_rule: true,
        });
      }
    }

    // 5. Фильтруем и дополняем базовые обязательства переопределениями
    const filteredStoredObligations: ObligationItem[] = baseObligations
      .filter((o) => {
        const override = monthOverrides[o.id];
        if (override?.deleted) return false;
        if (!o.is_active) return false;

        const effectiveType = override?.payment_type || o.payment_type || 'fixed';
        if (effectiveType === 'variable' && o.target_period) {
          return o.target_period === period;
        }
        return true;
      })
      .map((o) => {
        const override = monthOverrides[o.id];
        return {
          ...o,
          title: override?.custom_title || o.title,
          category: override?.custom_category || o.category,
          amount:
            typeof override?.custom_amount === 'number' && override.custom_amount > 0
              ? override.custom_amount
              : o.amount,
          due_day: override?.custom_due_day || o.due_day,
          recipient:
            override?.custom_recipient !== undefined ? override.custom_recipient : o.recipient,
          notes: override?.custom_notes !== undefined ? override.custom_notes : o.notes,
          preferred_wallet_id: override?.custom_wallet_id || o.preferred_wallet_id,
          payment_type: override?.payment_type || o.payment_type || 'fixed',
        };
      });

    // Объединяем регулярные обязательства, лизинги и пятничные выплаты ЗП
    const allObligations: ObligationItem[] = [
      ...filteredStoredObligations,
      ...loanObligations,
      ...fridayObligations,
    ];

    // 6. Формируем позиции календаря с расчетом дней и статусов
    const todayZeroTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const calendarItems: CalendarResponseItem[] = allObligations.map((obl) => {
      const day = Math.min(Math.max(1, obl.due_day), 31);
      const dueDateObj = new Date(currentYear, currentMonth - 1, day);
      const dueDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const diffDays = Math.round((dueDateObj.getTime() - todayZeroTime) / (1000 * 60 * 60 * 24));

      // Проверяем, оплачено ли
      const paidInfo = monthOverrides[obl.id];
      const isPaid = Boolean(
        paidInfo && typeof paidInfo.paid_amount === 'number' && paidInfo.paid_amount >= obl.amount,
      );

      let status: CalendarStatus = 'planned';
      if (isPaid) {
        status = 'paid';
      } else if (diffDays < 0) {
        status = 'overdue';
      } else if (diffDays === 0) {
        status = 'due_today';
      } else {
        status = 'planned';
      }

      return {
        ...obl,
        status,
        due_date: dueDateStr,
        days_left: diffDays,
        paid_amount: paidInfo?.paid_amount,
        paid_at: paidInfo?.paid_at,
        paid_wallet: paidInfo?.wallet_id,
      };
    });

    // Сортировка по дню месяца
    calendarItems.sort((a, b) => a.due_day - b.due_day);

    // 7. Расчет финансовой потребности и прогноза кассового разрыва
    let dueNext7Days = 0;
    let totalMonthObligations = 0;
    let paidThisMonth = 0;
    let remainingThisMonth = 0;
    let fixedTotalMonth = 0;
    let variableTotalMonth = 0;
    let fixedRemainingMonth = 0;
    let variableRemainingMonth = 0;

    for (const item of calendarItems) {
      totalMonthObligations += item.amount;
      if (item.payment_type === 'variable') {
        variableTotalMonth += item.amount;
        if (item.status !== 'paid') variableRemainingMonth += item.amount;
      } else {
        fixedTotalMonth += item.amount;
        if (item.status !== 'paid') fixedRemainingMonth += item.amount;
      }

      if (item.status === 'paid') {
        paidThisMonth += item.amount;
      } else {
        remainingThisMonth += item.amount;
        if (item.days_left >= 0 && item.days_left <= 7) {
          dueNext7Days += item.amount;
        } else if (item.status === 'overdue') {
          dueNext7Days += item.amount;
        }
      }
    }

    const cashReserve7Days = totalCash - dueNext7Days;
    const cashReserveMonth = totalCash - remainingThisMonth;

    return NextResponse.json({
      period,
      balances: {
        total: totalCash,
        bank: bankBalance,
        cash: cashBalance,
      },
      summary: {
        totalMonthObligations,
        paidThisMonth,
        remainingThisMonth,
        fixedTotalMonth,
        variableTotalMonth,
        fixedRemainingMonth,
        variableRemainingMonth,
        dueNext7Days,
        cashReserve7Days,
        cashReserveMonth,
        hasGap7Days: cashReserve7Days < 0,
        gapAmount7Days: Math.max(0, -cashReserve7Days),
        hasGapMonth: cashReserveMonth < 0,
        gapAmountMonth: Math.max(0, -cashReserveMonth),
      },
      items: calendarItems,
    });
  } catch (err: any) {
    console.error('Error in GET /api/payment-calendar:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** POST /api/payment-calendar — отметка об оплате, добавление или редактирование обязательства */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'mark_paid';
    const supabase = createAdminClient();

    if (action === 'mark_paid') {
      const { obligation_id, period, wallet_id, amount } = body;
      if (!obligation_id || !period) {
        return NextResponse.json(
          { error: 'Не указан ID обязательства или период' },
          { status: 400 },
        );
      }

      const payAmount = parseFloat(amount || '0');
      const chosenWallet = wallet_id || BANK_ID;
      const overrideId = `${period}:${obligation_id}`;

      // 1. Сохраняем отметку в Supabase
      await (supabase.from('payment_calendar_overrides') as any).upsert({
        id: overrideId,
        period,
        obligation_id,
        paid_amount: payAmount,
        paid_at: new Date().toISOString(),
        wallet_id: chosenWallet,
        updated_at: new Date().toISOString(),
      });

      // 2. Локальный JSON резерв
      const localSetPath = getLocalFilePath('payment_settlements.json');
      const settlementsMap = readJsonFile<Record<string, Record<string, any>>>(localSetPath, {});
      if (!settlementsMap[period]) settlementsMap[period] = {};
      settlementsMap[period][obligation_id] = {
        paid_amount: payAmount,
        paid_at: new Date().toISOString(),
        wallet_id: chosenWallet,
      };
      writeJsonFile(localSetPath, settlementsMap);

      // 3. Создаем расходную транзакцию
      if (body.create_tx !== false && payAmount > 0) {
        const desc = body.title
          ? `Оплата по календарю: ${body.title}`
          : 'Плановый платеж по календарю';

        await (supabase.from('transactions') as any).insert({
          direction: 'expense',
          amount: payAmount.toFixed(2),
          from_wallet_id: chosenWallet,
          to_wallet_id: null,
          category_id: '00000000-0000-0000-0000-000000000010', // OTHER_EXPENSE
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          transaction_date: new Date().toISOString(),
          description: desc,
          idempotency_key: crypto.randomUUID(),
          created_by: SYSTEM_USER_ID,
        });
      }

      return NextResponse.json({ success: true, message: 'Платеж отмечен как выполненный' });
    }

    if (action === 'create_obligation') {
      const {
        title,
        category,
        amount,
        due_day,
        preferred_wallet_id,
        recipient,
        notes,
        payment_type,
        target_period,
        period,
      } = body;
      if (!title?.trim() || !amount) {
        return NextResponse.json({ error: 'Название и сумма обязательны' }, { status: 400 });
      }

      const pType: 'fixed' | 'variable' = payment_type === 'variable' ? 'variable' : 'fixed';
      const newObl: ObligationItem = {
        id: `obl-${Date.now()}`,
        title: title.trim(),
        category: category || 'other',
        amount: parseFloat(amount),
        due_day: parseInt(due_day) || 1,
        frequency: pType === 'variable' ? 'one_time' : body.frequency || 'monthly',
        payment_type: pType,
        target_period:
          pType === 'variable'
            ? target_period || period || new Date().toISOString().slice(0, 7)
            : undefined,
        preferred_wallet_id: preferred_wallet_id || BANK_ID,
        recipient: recipient?.trim() || '',
        notes: notes?.trim() || '',
        is_active: true,
      };

      // Сохраняем в Supabase
      const { error: insErr } = await (supabase.from('payment_calendar_obligations') as any).insert(
        newObl,
      );
      if (insErr) {
        console.error('Error inserting into payment_calendar_obligations:', insErr);
      }

      // Сохраняем локально в JSON
      const localOblPath = getLocalFilePath('payment_obligations.json');
      const stored = readJsonFile<ObligationItem[]>(localOblPath, []);
      stored.push(newObl);
      writeJsonFile(localOblPath, stored);

      return NextResponse.json({ success: true, obligation: newObl });
    }

    if (action === 'update_obligation') {
      const {
        id,
        title,
        category,
        amount,
        due_day,
        preferred_wallet_id,
        recipient,
        notes,
        period,
        payment_type,
        target_period,
      } = body;
      if (!id) {
        return NextResponse.json({ error: 'ID обязательства обязателен' }, { status: 400 });
      }

      const parsedAmount = parseFloat(amount || '0');
      const parsedDueDay = parseInt(due_day) || 1;
      const activePeriod = period || new Date().toISOString().slice(0, 7);
      const overrideId = `${activePeriod}:${id}`;

      // 1. Сохраняем универсальный override в Supabase (действует на любой тип обязательства)
      await (supabase.from('payment_calendar_overrides') as any).upsert({
        id: overrideId,
        period: activePeriod,
        obligation_id: id,
        custom_title: title !== undefined ? title.trim() : undefined,
        custom_amount: !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined,
        custom_due_day: parsedDueDay,
        custom_recipient: recipient !== undefined ? recipient.trim() : undefined,
        custom_notes: notes !== undefined ? notes.trim() : undefined,
        custom_category: category,
        custom_wallet_id: preferred_wallet_id,
        payment_type: payment_type || 'fixed',
        updated_at: new Date().toISOString(),
      });

      // 2. Если это лизинг или кредит (loan-...)
      if (id.startsWith('loan-')) {
        const loanId = id.replace('loan-', '');
        const updateData: Record<string, any> = {};
        if (title) updateData.purpose = title.trim();
        if (recipient) updateData.lender_name = recipient.trim();
        if (notes) updateData.notes = notes.trim();
        if (!isNaN(parsedAmount) && parsedAmount > 0) {
          updateData.monthly_payment = parsedAmount.toFixed(2);
        }
        await (supabase.from('loans') as any).update(updateData).eq('id', loanId);
      } else if (!id.startsWith('salary-friday-')) {
        // 3. Базовое обязательство (payment_calendar_obligations)
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (title !== undefined) updateData.title = title.trim();
        if (category !== undefined) updateData.category = category;
        if (!isNaN(parsedAmount) && parsedAmount > 0) updateData.amount = parsedAmount;
        if (parsedDueDay) updateData.due_day = parsedDueDay;
        if (preferred_wallet_id) updateData.preferred_wallet_id = preferred_wallet_id;
        if (recipient !== undefined) updateData.recipient = recipient.trim();
        if (notes !== undefined) updateData.notes = notes.trim();
        if (payment_type !== undefined) updateData.payment_type = payment_type;
        if (target_period !== undefined) updateData.target_period = target_period;

        await (supabase.from('payment_calendar_obligations') as any)
          .update(updateData)
          .eq('id', id);

        // Обновляем локальный JSON файл
        const localOblPath = getLocalFilePath('payment_obligations.json');
        const stored = readJsonFile<ObligationItem[]>(localOblPath, []);
        const idx = stored.findIndex((o) => o.id === id);
        if (idx !== -1 && stored[idx]) {
          stored[idx] = {
            ...stored[idx]!,
            ...updateData,
          };
          writeJsonFile(localOblPath, stored);
        }
      }

      // Сохраняем локальный settlements JSON
      const localSetPath = getLocalFilePath('payment_settlements.json');
      const settlementsMap = readJsonFile<Record<string, Record<string, any>>>(localSetPath, {});
      if (!settlementsMap[activePeriod]) settlementsMap[activePeriod] = {};
      settlementsMap[activePeriod][id] = {
        ...settlementsMap[activePeriod][id],
        custom_title: title?.trim(),
        custom_amount: parsedAmount,
        custom_due_day: parsedDueDay,
        custom_recipient: recipient?.trim(),
        custom_notes: notes?.trim(),
        custom_category: category,
        custom_wallet_id: preferred_wallet_id,
        payment_type,
        updated_at: new Date().toISOString(),
      };
      writeJsonFile(localSetPath, settlementsMap);

      return NextResponse.json({ success: true, message: 'Событие успешно сохранено' });
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in POST /api/payment-calendar:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** DELETE /api/payment-calendar — удаление обязательства */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const period = searchParams.get('period') || new Date().toISOString().slice(0, 7);
    if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });

    const supabase = createAdminClient();
    const overrideId = `${period}:${id}`;

    // Фиксируем флаг deleted в overrides
    await (supabase.from('payment_calendar_overrides') as any).upsert({
      id: overrideId,
      period,
      obligation_id: id,
      deleted: true,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (id.startsWith('loan-')) {
      const loanId = id.replace('loan-', '');
      await (supabase.from('loans') as any).update({ is_active: false }).eq('id', loanId);
    } else if (!id.startsWith('salary-friday-')) {
      await (supabase.from('payment_calendar_obligations') as any)
        .update({ is_active: false })
        .eq('id', id);

      // Локальный JSON
      const localOblPath = getLocalFilePath('payment_obligations.json');
      const stored = readJsonFile<ObligationItem[]>(localOblPath, []);
      const next = stored.filter((o) => o.id !== id);
      writeJsonFile(localOblPath, next);
    }

    // Локальный settlements JSON
    const localSetPath = getLocalFilePath('payment_settlements.json');
    const settlementsMap = readJsonFile<Record<string, Record<string, any>>>(localSetPath, {});
    if (!settlementsMap[period]) settlementsMap[period] = {};
    settlementsMap[period][id] = { deleted: true, deleted_at: new Date().toISOString() };
    writeJsonFile(localSetPath, settlementsMap);

    return NextResponse.json({ success: true, message: 'Обязательство удалено' });
  } catch (err: any) {
    console.error('Error in DELETE /api/payment-calendar:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
