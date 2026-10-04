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

    // 1. Получаем балансы кошельков
    const [{ data: walletsRes }, { data: loansRes }] = await Promise.all([
      (supabase.from('wallets') as any).select('id, name, balance'),
      (supabase.from('loans') as any).select('*').eq('is_active', true),
    ]);

    const bankWallet = (walletsRes ?? []).find((w: any) => w.id === BANK_ID);
    const cashWallet = (walletsRes ?? []).find((w: any) => w.id === CASH_ID);
    const bankBalance = parseFloat(bankWallet?.balance ?? '0');
    const cashBalance = parseFloat(cashWallet?.balance ?? '0');
    const totalCash = bankBalance + cashBalance;

    // 2. Читаем сохраненные обязательства и факты оплат
    const storedObligations = readJsonFile<ObligationItem[]>(OBLIGATIONS_FILE, []);
    const settlementsMap = readJsonFile<
      Record<string, Record<string, { paid_amount: number; paid_at: string; wallet_id: string }>>
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

    // Объединяем регулярные обязательства и лизинги
    const allObligations: ObligationItem[] = [
      ...storedObligations.filter((o) => o.is_active),
      ...loanObligations,
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
      const isPaid = Boolean(paidInfo && paidInfo.paid_amount >= obl.amount);

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

    const stored = readJsonFile<ObligationItem[]>(OBLIGATIONS_FILE, []);
    const next = stored.filter((o) => o.id !== id);
    writeJsonFile(OBLIGATIONS_FILE, next);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
