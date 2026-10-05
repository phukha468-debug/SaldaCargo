/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const OBLIGATIONS_FILE = path.join(process.cwd(), 'data', 'payment_obligations.json');
const SETTLEMENTS_FILE = path.join(process.cwd(), 'data', 'payment_settlements.json');

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const CASH_ID = '10000000-0000-0000-0000-000000000002';
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

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
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e);
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

    // 1. Получаем балансы кошельков, активные кредиты и живой долг по зарплате
    const [{ data: walletsRes }, { data: loansRes }, { data: salaryPendingRes }] =
      await Promise.all([
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

    // 2. Читаем сохраненные обязательства и факты оплат
    const storedObligations = readJsonFile<ObligationItem[]>(OBLIGATIONS_FILE, []);
    const settlementsMap = readJsonFile<
      Record<
        string,
        Record<
          string,
          {
            paid_amount?: number;
            paid_at?: string;
            wallet_id?: string;
            deleted?: boolean;
            custom_title?: string;
            custom_due_day?: number;
            custom_recipient?: string;
            custom_notes?: string;
            custom_amount?: number;
          }
        >
      >
    >(SETTLEMENTS_FILE, {});
    const monthSettlements = settlementsMap[period] || {};

    // 3. Добавляем активные лизинги и кредиты из таблицы loans
    const loanObligations: ObligationItem[] = (loansRes ?? [])
      .map((l: any) => {
        let dueDay = 15;
        if (l.next_payment_date) {
          dueDay = new Date(l.next_payment_date).getDate();
        } else if (l.started_at) {
          dueDay = new Date(l.started_at).getDate();
        }

        const isLeasing = l.loan_type === 'leasing';
        return {
          id: `loan-${l.id}`,
          title: isLeasing
            ? `Лизинг: ${l.lender_name}`
            : `Кредит: ${l.lender_name} (${l.purpose || 'платеж'})`,
          category: 'leasing_loan',
          amount: parseFloat(l.monthly_payment ?? '0') || 0,
          due_day: dueDay,
          frequency: 'monthly',
          preferred_wallet_id: BANK_ID,
          recipient: l.lender_name,
          notes: `Остаток долга: ${parseFloat(l.remaining_amount ?? '0').toLocaleString('ru-RU')} ₽${l.annual_rate ? `, ставка ${l.annual_rate}%` : ''}`,
          is_active: true,
          is_loan: true,
          loan_id: l.id,
        };
      })
      .filter((l: ObligationItem) => l.amount > 0);

    // 3.1. Правило: каждую пятницу выплата Зарплаты (сумма подтягивается из раздела Персонал)
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const fridayObligations: ObligationItem[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dObj = new Date(currentYear, currentMonth - 1, day);
      if (dObj.getDay() === 5) {
        // 5 — пятница
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const fridayId = `salary-friday-${dateStr}`;

        // Проверяем, не удалил ли пользователь это событие
        if (monthSettlements[fridayId]?.deleted) {
          continue;
        }

        const customTitle =
          monthSettlements[fridayId]?.custom_title || 'Выплата зарплаты (Пятница)';
        const customDueDay = monthSettlements[fridayId]?.custom_due_day || day;
        const customRecipient =
          monthSettlements[fridayId]?.custom_recipient ||
          'Штат сотрудников (водители, механики, грузчики)';
        const customNotes = monthSettlements[fridayId]?.custom_notes;

        const settledInfo = monthSettlements[fridayId];
        const isSettled = Boolean(
          settledInfo && typeof settledInfo.paid_amount === 'number' && settledInfo.paid_amount > 0,
        );
        const amount =
          isSettled && settledInfo && typeof settledInfo.paid_amount === 'number'
            ? settledInfo.paid_amount
            : (monthSettlements[fridayId]?.custom_amount ??
              (liveSalaryDebt > 0 ? liveSalaryDebt : 120000));

        fridayObligations.push({
          id: fridayId,
          title: customTitle,
          category: 'salary',
          amount,
          due_day: customDueDay,
          frequency: 'weekly',
          preferred_wallet_id: BANK_ID,
          recipient: customRecipient,
          notes:
            customNotes ||
            `Еженедельная выплата ЗП по пятницам (долг из раздела «Персонал»: ${liveSalaryDebt.toLocaleString('ru-RU')} ₽)`,
          is_active: true,
          is_salary_rule: true,
        });
      }
    }

    // Объединяем регулярные обязательства, лизинги и пятничные выплаты ЗП
    const allObligations: ObligationItem[] = [
      ...storedObligations.filter((o) => o.is_active),
      ...loanObligations,
      ...fridayObligations,
    ];

    // 4. Формируем позиции календаря с расчетом дней и статусов
    const todayZeroTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const calendarItems: CalendarResponseItem[] = allObligations.map((obl) => {
      // Дата платежа в данном месяце
      const day = Math.min(Math.max(1, obl.due_day), 31);
      const dueDateObj = new Date(currentYear, currentMonth - 1, day);
      const dueDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const diffDays = Math.round((dueDateObj.getTime() - todayZeroTime) / (1000 * 60 * 60 * 24));

      // Проверяем, оплачено ли
      const paidInfo = monthSettlements[obl.id];
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

    // 5. Расчет финансовой потребности и прогноза кассового разрыва
    let dueNext7Days = 0;
    let totalMonthObligations = 0;
    let paidThisMonth = 0;
    let remainingThisMonth = 0;

    for (const item of calendarItems) {
      totalMonthObligations += item.amount;
      if (item.status === 'paid') {
        paidThisMonth += item.amount;
      } else {
        remainingThisMonth += item.amount;
        if (item.days_left >= 0 && item.days_left <= 7) {
          dueNext7Days += item.amount;
        } else if (item.status === 'overdue') {
          dueNext7Days += item.amount; // просроченные также требуют оплаты срочно
        }
      }
    }

    // Прогноз разрыва
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
        dueNext7Days,
        cashReserve7Days, // > 0: профицит, < 0: кассовый разрыв
        cashReserveMonth,
        hasGap7Days: cashReserve7Days < 0,
        gapAmount7Days: Math.max(0, -cashReserve7Days),
        hasGapMonth: cashReserveMonth < 0,
        gapAmountMonth: Math.max(0, -cashReserveMonth),
      },
      items: calendarItems,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** POST /api/payment-calendar — управление календарем: отметка об оплате или добавление обязательства */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'mark_paid';

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

      // 1. Сохраняем отметку об оплате в settlements
      const settlementsMap = readJsonFile<Record<string, Record<string, any>>>(
        SETTLEMENTS_FILE,
        {},
      );
      if (!settlementsMap[period]) settlementsMap[period] = {};

      settlementsMap[period][obligation_id] = {
        paid_amount: payAmount,
        paid_at: new Date().toISOString(),
        wallet_id: chosenWallet,
      };

      writeJsonFile(SETTLEMENTS_FILE, settlementsMap);

      // 2. Создаем транзакцию расхода в Supabase, если указан create_tx
      if (body.create_tx !== false && payAmount > 0) {
        const supabase = createAdminClient();
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
      const { title, category, amount, due_day, preferred_wallet_id, recipient, notes } = body;
      if (!title?.trim() || !amount) {
        return NextResponse.json({ error: 'Название и сумма обязательны' }, { status: 400 });
      }

      const stored = readJsonFile<ObligationItem[]>(OBLIGATIONS_FILE, []);
      const newObl: ObligationItem = {
        id: `obl-${Date.now()}`,
        title: title.trim(),
        category: category || 'other',
        amount: parseFloat(amount),
        due_day: parseInt(due_day) || 1,
        frequency: body.frequency || 'monthly',
        preferred_wallet_id: preferred_wallet_id || BANK_ID,
        recipient: recipient?.trim() || '',
        notes: notes?.trim() || '',
        is_active: true,
      };

      stored.push(newObl);
      writeJsonFile(OBLIGATIONS_FILE, stored);

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
      } = body;
      if (!id) {
        return NextResponse.json({ error: 'ID обязательства обязателен' }, { status: 400 });
      }

      const parsedAmount = parseFloat(amount || '0');
      const parsedDueDay = parseInt(due_day) || 1;

      // 1. Если это обязательство из payment_obligations.json
      const stored = readJsonFile<ObligationItem[]>(OBLIGATIONS_FILE, []);
      const idx = stored.findIndex((o) => o.id === id);

      if (idx !== -1 && stored[idx]) {
        const current = stored[idx]!;
        const updatedItem: ObligationItem = {
          ...current,
          title: title !== undefined ? title.trim() : current.title,
          category: category !== undefined ? category : current.category,
          amount: !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : current.amount,
          due_day: parsedDueDay,
          preferred_wallet_id: preferred_wallet_id || current.preferred_wallet_id,
          recipient: recipient !== undefined ? recipient.trim() : current.recipient,
          notes: notes !== undefined ? notes.trim() : current.notes,
        };
        stored[idx] = updatedItem;
        writeJsonFile(OBLIGATIONS_FILE, stored);
        return NextResponse.json({ success: true, obligation: updatedItem });
      }

      // 2. Если это лизинг или кредит (loan-...)
      if (id.startsWith('loan-')) {
        const loanId = id.replace('loan-', '');
        const supabase = createAdminClient();
        const updateData: Record<string, any> = {};
        if (title) updateData.purpose = title.trim();
        if (!isNaN(parsedAmount) && parsedAmount > 0)
          updateData.monthly_payment = parsedAmount.toFixed(2);

        await (supabase.from('loans') as any).update(updateData).eq('id', loanId);
        return NextResponse.json({ success: true, message: 'Кредит/лизинг обновлён' });
      }

      // 3. Если это пятничное авто-событие (salary-friday-...)
      if (id.startsWith('salary-friday-')) {
        const settlementsMap = readJsonFile<Record<string, Record<string, any>>>(
          SETTLEMENTS_FILE,
          {},
        );
        const parts = id.replace('salary-friday-', '').split('-');
        const activePeriod =
          period ||
          (parts.length >= 2 ? `${parts[0]}-${parts[1]}` : new Date().toISOString().slice(0, 7));
        if (!settlementsMap[activePeriod]) settlementsMap[activePeriod] = {};
        settlementsMap[activePeriod][id] = {
          ...settlementsMap[activePeriod][id],
          custom_title: title?.trim(),
          custom_amount: parsedAmount,
          custom_due_day: parsedDueDay,
          custom_recipient: recipient?.trim(),
          custom_notes: notes?.trim(),
          updated_at: new Date().toISOString(),
        };
        writeJsonFile(SETTLEMENTS_FILE, settlementsMap);
        return NextResponse.json({ success: true, message: 'Событие обновлено' });
      }

      return NextResponse.json({ error: 'Событие не найдено' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** DELETE /api/payment-calendar — удаление обязательства */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });

    if (id.startsWith('loan-')) {
      const loanId = id.replace('loan-', '');
      const supabase = createAdminClient();
      await (supabase.from('loans') as any).update({ is_active: false }).eq('id', loanId);
    } else if (id.startsWith('salary-friday-')) {
      const settlementsMap = readJsonFile<Record<string, Record<string, any>>>(
        SETTLEMENTS_FILE,
        {},
      );
      const parts = id.replace('salary-friday-', '').split('-');
      const period =
        parts.length >= 2 ? `${parts[0]}-${parts[1]}` : new Date().toISOString().slice(0, 7);
      if (!settlementsMap[period]) settlementsMap[period] = {};
      settlementsMap[period][id] = { deleted: true, deleted_at: new Date().toISOString() };
      writeJsonFile(SETTLEMENTS_FILE, settlementsMap);
    } else {
      const stored = readJsonFile<ObligationItem[]>(OBLIGATIONS_FILE, []);
      const next = stored.filter((o) => o.id !== id);
      writeJsonFile(OBLIGATIONS_FILE, next);
    }

    return NextResponse.json({ success: true, message: 'Обязательство удалено' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
