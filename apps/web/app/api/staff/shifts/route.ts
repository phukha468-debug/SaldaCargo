/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateDeterministicUuid } from '@saldacargo/shared';

const PAYROLL_CATEGORY_ID = '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6'; // Категория начисления ЗП персонала / цеха

async function getAdminId(request: Request, supabase: any): Promise<string> {
  const authHeader = request.headers.get('Authorization');
  let adminId = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

  if (!adminId) {
    try {
      const cookieStore = await cookies();
      adminId = cookieStore.get('salda_auth_token')?.value ?? null;
    } catch {
      // ignore
    }
  }

  if (!adminId) {
    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id')
      .filter('roles', 'cs', '{"admin"}')
      .limit(1)
      .maybeSingle();
    adminId = adminUser?.id ?? null;
  }

  if (!adminId) {
    const { data: anyUser } = await (supabase.from('users') as any)
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    adminId = anyUser?.id ?? 'e9a1c980-eb1e-5c87-9f6d-c7f67eb28a1d';
  }

  return adminId || 'e9a1c980-eb1e-5c87-9f6d-c7f67eb28a1d';
}

function parseRateFromNotes(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const match = notes.match(/ставка[:\s]+(\d+)/i) || notes.match(/rate[:\s]+(\d+)/i);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return null;
}

function getDefaultRateForUser(user: { name?: string | null; notes?: string | null }): number {
  const fromNotes = parseRateFromNotes(user.notes);
  if (fromNotes) return fromNotes;

  const name = (user.name || '').toLowerCase();
  const notes = (user.notes || '').toLowerCase();

  if (name.includes('татьяна') || notes.includes('гараж')) {
    return 1000;
  }
  if (name.includes('ирина') || notes.includes('офис')) {
    return 250;
  }
  return 1000;
}

/**
 * GET /api/staff/shifts?user_id=...&year=...&month=...
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const now = new Date();
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);

    if (!userId) {
      return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Загружаем пользователя
    const { data: user, error: userErr } = await (supabase.from('users') as any)
      .select('id, name, roles, notes, phone, is_active')
      .eq('id', userId)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });
    }

    const periodStr = `${year}-${String(month).padStart(2, '0')}`;
    const defaultRate = getDefaultRateForUser(user);

    // 2. Ищем существующую транзакцию начисления по табелю смен за этот месяц
    const { data: shiftTxs } = await (supabase.from('transactions') as any)
      .select(
        'id, amount, description, photo_url, lifecycle_status, settlement_status, created_at, from_wallet_id',
      )
      .eq('related_user_id', userId)
      .eq('direction', 'expense')
      .neq('lifecycle_status', 'cancelled')
      .order('created_at', { ascending: false });

    let existingTx: any = null;
    let selectedDates: string[] = [];
    let currentRate = defaultRate;
    let isSettled = false;

    if (shiftTxs && shiftTxs.length > 0) {
      for (const tx of shiftTxs) {
        if (tx.photo_url) {
          try {
            const meta = JSON.parse(tx.photo_url);
            if (meta?.type === 'staff_shifts' && meta?.period === periodStr) {
              existingTx = tx;
              if (Array.isArray(meta.dates)) {
                selectedDates = meta.dates;
              }
              if (typeof meta.rate === 'number' && meta.rate > 0) {
                currentRate = meta.rate;
              }
              isSettled = tx.settlement_status === 'completed' && Boolean(tx.from_wallet_id);
              break;
            }
          } catch {
            // non-json photo_url
          }
        }
      }

      // Если метаданных не было в photo_url, но есть транзакция по этому месяцу в описании
      if (!existingTx) {
        const fallback = shiftTxs.find(
          (t: any) =>
            (t.description || '').toLowerCase().includes(periodStr) ||
            (t.created_at || '').startsWith(periodStr),
        );
        if (fallback) {
          existingTx = fallback;
          isSettled =
            fallback.settlement_status === 'completed' && Boolean(fallback.from_wallet_id);
        }
      }
    }

    return NextResponse.json({
      user_id: user.id,
      user_name: user.name,
      roles: user.roles,
      notes: user.notes,
      year,
      month,
      period: periodStr,
      default_rate: defaultRate,
      current_rate: currentRate,
      selected_dates: selectedDates,
      shift_count: selectedDates.length,
      total_amount: selectedDates.length * currentRate,
      is_settled: isSettled,
      existing_transaction: existingTx
        ? {
            id: existingTx.id,
            amount: parseFloat(existingTx.amount || '0'),
            settlement_status: existingTx.settlement_status,
            lifecycle_status: existingTx.lifecycle_status,
            description: existingTx.description,
            created_at: existingTx.created_at,
          }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Ошибка сервера' }, { status: 500 });
  }
}

/**
 * POST /api/staff/shifts
 * Body: { user_id, year, month, selected_dates: string[], rate: number, save_default_rate?: boolean }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, year, month, selected_dates = [], rate, save_default_rate } = body;

    if (!user_id || !year || !month) {
      return NextResponse.json({ error: 'user_id, year и month обязательны' }, { status: 400 });
    }

    const numRate = parseFloat(String(rate || '0'));
    if (isNaN(numRate) || numRate <= 0) {
      return NextResponse.json({ error: 'Укажите корректную ставку больше нуля' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Проверяем сотрудника
    const { data: user, error: userErr } = await (supabase.from('users') as any)
      .select('id, name, roles, notes')
      .eq('id', user_id)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });
    }

    // Сохраняем ставку в заметки сотрудника, если запрошено или если её там ещё нет
    if (save_default_rate || !user.notes?.includes('ставка:')) {
      const cleanNotes = (user.notes || '').replace(/\s*\[ставка:[^\]]+\]/gi, '').trim();
      const newNotes = cleanNotes
        ? `${cleanNotes} [ставка: ${numRate} ₽]`
        : `[ставка: ${numRate} ₽]`;
      await (supabase.from('users') as any).update({ notes: newNotes }).eq('id', user_id);
    }

    const periodStr = `${year}-${String(month).padStart(2, '0')}`;
    const sortedDates = [...selected_dates].sort();
    const shiftCount = sortedDates.length;
    const totalAmount = shiftCount * numRate;

    const adminId = await getAdminId(request, supabase);

    // Ищем существующую транзакцию начисления за этот месяц
    const { data: userTxs } = await (supabase.from('transactions') as any)
      .select('*')
      .eq('related_user_id', user_id)
      .eq('direction', 'expense')
      .neq('lifecycle_status', 'cancelled')
      .order('created_at', { ascending: false });

    const idempotencyKey = generateDeterministicUuid(`shifts-${user_id}-${periodStr}`);

    let existingTx: any = null;
    if (userTxs && userTxs.length > 0) {
      for (const tx of userTxs) {
        if (tx.photo_url) {
          try {
            const meta = JSON.parse(tx.photo_url);
            if (meta?.type === 'staff_shifts' && meta?.period === periodStr) {
              existingTx = tx;
              break;
            }
          } catch {
            // ignore
          }
        }
        if (tx.idempotency_key === idempotencyKey) {
          existingTx = tx;
          break;
        }
      }
    }

    // Если уже выплачено (settlement_status === 'completed' && from_wallet_id !== null)
    if (existingTx && existingTx.settlement_status === 'completed' && existingTx.from_wallet_id) {
      return NextResponse.json(
        {
          error:
            'Начисление за этот месяц уже выплачено. Для изменения обратитесь к администратору или отмените выплату.',
        },
        { status: 400 },
      );
    }

    // Формируем понятный список дат для описания (например: 02.10, 06.10, 09.10)
    const formattedDatesList = sortedDates
      .map((dStr: string) => {
        const parts = dStr.split('-');
        return parts.length === 3 ? `${parts[2]}.${parts[1]}` : dStr;
      })
      .join(', ');

    const roleName = user.roles?.includes('cleaner')
      ? 'Уборка'
      : user.roles?.[0] === 'loader'
        ? 'Смены грузчика'
        : 'Смены';

    const description =
      shiftCount > 0
        ? `${roleName}: ${shiftCount} смен (${formattedDatesList}) · ставка ${numRate.toLocaleString('ru-RU')} ₽`
        : `Табель ${roleName}: 0 смен за ${periodStr}`;

    const metadata = {
      type: 'staff_shifts',
      year,
      month,
      period: periodStr,
      rate: numRate,
      shift_count: shiftCount,
      dates: sortedDates,
      updated_at: new Date().toISOString(),
    };

    let resultTxId = existingTx?.id || null;

    if (shiftCount === 0) {
      // Если смен 0, удаляем или аннулируем существующую pending транзакцию
      if (existingTx && existingTx.settlement_status === 'pending') {
        await (supabase.from('transactions') as any).delete().eq('id', existingTx.id);
        resultTxId = null;
      }
    } else {
      const idempotencyKey = generateDeterministicUuid(`shifts-${user_id}-${periodStr}`);
      const nowIso = new Date().toISOString();

      if (existingTx) {
        // Обновляем существующее начисление
        const { error: updErr } = await (supabase.from('transactions') as any)
          .update({
            amount: totalAmount.toFixed(2),
            description,
            photo_url: JSON.stringify(metadata),
            settlement_status: 'pending',
            lifecycle_status: 'approved',
            updated_at: nowIso,
          })
          .eq('id', existingTx.id);

        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        }
        resultTxId = existingTx.id;
      } else {
        // Создаём новое начисление (approved, pending, from_wallet_id = null)
        const lastDate = sortedDates[sortedDates.length - 1];
        const txDate = lastDate ? `${lastDate}T12:00:00.000Z` : nowIso;

        const { data: newTx, error: insErr } = await (supabase.from('transactions') as any)
          .insert({
            direction: 'expense',
            amount: totalAmount.toFixed(2),
            category_id: PAYROLL_CATEGORY_ID,
            lifecycle_status: 'approved',
            settlement_status: 'pending',
            from_wallet_id: null,
            to_wallet_id: null,
            related_user_id: user_id,
            transaction_date: txDate,
            created_at: nowIso,
            description,
            photo_url: JSON.stringify(metadata),
            idempotency_key: idempotencyKey,
            created_by: adminId,
          })
          .select('id')
          .single();

        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
        resultTxId = newTx?.id;
      }
    }

    return NextResponse.json({
      ok: true,
      transaction_id: resultTxId,
      shift_count: shiftCount,
      rate: numRate,
      total_amount: totalAmount,
      description,
      period: periodStr,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Ошибка сервера' }, { status: 500 });
  }
}
