/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CASH_COLLECT_CAT = '72f677d4-84af-4d0d-a845-a1b63c7ae607';
const CASH_WALLET_ID = '10000000-0000-0000-0000-000000000002';

/**
 * GET /api/admin/driver-cash-holds
 * Список активных зафиксированных переносов подотчёта по водителям
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    // Загружаем незавершённые переносы подотчёта (settlement_status = pending)
    const { data: holds, error } = await (supabase.from('transactions') as any)
      .select(
        `
        id,
        amount,
        description,
        transaction_date,
        created_at,
        created_by,
        related_user_id,
        trip_id,
        trip:trips(id, trip_number, started_at, ended_at, asset:assets(short_name, reg_number)),
        driver:users!transactions_related_user_id_fkey(id, name, phone)
      `,
      )
      .eq('category_id', CASH_COLLECT_CAT)
      .eq('settlement_status', 'pending')
      .neq('lifecycle_status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (holds ?? []).map((h: any) => {
      let cleanNote = h.description || '';
      if (cleanNote.startsWith('[CARRYOVER] ')) {
        cleanNote = cleanNote.substring('[CARRYOVER] '.length);
      }
      const matchTrip = cleanNote.match(/Рейс\s*№?\s*(\d+)/i);
      const parsedTripNum = h.trip?.trip_number ?? (matchTrip ? parseInt(matchTrip[1], 10) : null);

      return {
        id: h.id,
        driver_id: h.related_user_id,
        driver_name: h.driver?.name ?? 'Неизвестный водитель',
        driver_phone: h.driver?.phone ?? '',
        amount: parseFloat(h.amount ?? '0').toFixed(2),
        note: cleanNote,
        created_at: h.created_at,
        transaction_date: h.transaction_date,
        trip_id: h.trip?.id ?? h.trip_id ?? null,
        trip_number: parsedTripNum,
        trip_date: h.trip?.started_at ?? h.transaction_date ?? h.created_at,
        asset_name: h.trip?.asset?.short_name || h.trip?.asset?.reg_number || null,
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/**
 * POST /api/admin/driver-cash-holds
 * Зафиксировать остаток подотчёта на руках у водителя (перенос на следующий день)
 * Body: { driver_id: string, amount: string | number, note?: string }
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const adminId =
      cookieStore.get('salda_user_id')?.value || request.headers.get('x-salda-user-id');

    const supabase = createAdminClient();

    let resolvedAdminId = adminId;
    if (!resolvedAdminId) {
      const { data: fallbackAdmin } = await (supabase.from('users') as any)
        .select('id')
        .or('roles.cs.{admin},roles.cs.{owner}')
        .limit(1)
        .single();
      resolvedAdminId = fallbackAdmin?.id;
    }

    if (!resolvedAdminId) {
      return NextResponse.json({ error: 'Не удалось определить администратора' }, { status: 401 });
    }

    const body = (await request.json()) as {
      driver_id: string;
      amount: string | number;
      note?: string;
    };

    const numAmount = parseFloat(String(body.amount ?? '0'));
    if (!body.driver_id || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'Укажите водителя и корректную сумму больше нуля' },
        { status: 400 },
      );
    }

    // Ищем кошелёк подотчёта водителя
    const { data: driverWallet } = await (supabase.from('wallets') as any)
      .select('id')
      .eq('owner_user_id', body.driver_id)
      .eq('type', 'driver_accountable')
      .limit(1)
      .maybeSingle();

    const noteText = body.note?.trim() || 'Остаток на руках, перенос на следующий день';
    const description = `[CARRYOVER] ${noteText}`;

    // Создаём транзакцию со статусом pending (перенос зафиксирован, но деньги еще не сданы)
    const { data: createdTx, error: txErr } = await (supabase.from('transactions') as any)
      .insert({
        direction: 'transfer',
        amount: numAmount.toFixed(2),
        category_id: CASH_COLLECT_CAT,
        from_wallet_id: driverWallet?.id ?? null,
        to_wallet_id: CASH_WALLET_ID,
        lifecycle_status: 'approved',
        settlement_status: 'pending',
        related_user_id: body.driver_id,
        description,
        created_by: resolvedAdminId,
        idempotency_key: crypto.randomUUID(),
        transaction_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        hold: {
          id: createdTx.id,
          driver_id: body.driver_id,
          amount: numAmount.toFixed(2),
          note: noteText,
          created_at: createdTx.created_at,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/driver-cash-holds
 * Принять деньги в кассу (инкассировать зафиксированный перенос)
 * Body: { hold_id: string, collected_amount?: string | number, note?: string }
 */
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const adminId =
      cookieStore.get('salda_user_id')?.value || request.headers.get('x-salda-user-id');

    const supabase = createAdminClient();

    let resolvedAdminId = adminId;
    if (!resolvedAdminId) {
      const { data: fallbackAdmin } = await (supabase.from('users') as any)
        .select('id')
        .or('roles.cs.{admin},roles.cs.{owner}')
        .limit(1)
        .single();
      resolvedAdminId = fallbackAdmin?.id;
    }

    const body = (await request.json()) as {
      hold_id?: string;
      driver_id?: string;
      collected_amount?: string | number;
      note?: string;
    };

    if (!body.hold_id && !body.driver_id) {
      return NextResponse.json(
        { error: 'Параметр hold_id или driver_id обязателен' },
        { status: 400 },
      );
    }

    if (body.driver_id && !body.hold_id) {
      const { data: driverHolds, error: fetchErr } = await (supabase.from('transactions') as any)
        .select('*')
        .eq('related_user_id', body.driver_id)
        .eq('category_id', CASH_COLLECT_CAT)
        .eq('settlement_status', 'pending')
        .neq('lifecycle_status', 'cancelled')
        .order('created_at', { ascending: true });

      if (fetchErr || !driverHolds || driverHolds.length === 0) {
        return NextResponse.json(
          { error: 'У водителя нет активных остатков подотчёта' },
          { status: 404 },
        );
      }

      const totalHoldsAmount = driverHolds.reduce(
        (s: number, h: any) => s + parseFloat(h.amount || '0'),
        0,
      );
      const collectAmount = body.collected_amount
        ? parseFloat(String(body.collected_amount))
        : totalHoldsAmount;
      if (isNaN(collectAmount) || collectAmount <= 0) {
        return NextResponse.json({ error: 'Некорректная сумма приёма' }, { status: 400 });
      }

      // 1. Создаём запись в cash_collections
      await (supabase.from('cash_collections') as any).insert({
        driver_id: body.driver_id,
        amount: collectAmount.toFixed(2),
        collected_by: resolvedAdminId,
        note:
          body.note?.trim() || `Инкассация подотчёта водителя (${driverHolds.length} перенос/-ов)`,
      });

      // 2. Погашаем переносы от старых к новым
      let remainingToSettle = collectAmount;
      const nowStr = new Date().toLocaleDateString('ru-RU');

      for (const h of driverHolds) {
        if (remainingToSettle <= 0) break;
        const hAmt = parseFloat(h.amount);
        if (remainingToSettle >= hAmt) {
          await (supabase.from('transactions') as any)
            .update({
              settlement_status: 'completed',
              updated_at: new Date().toISOString(),
              description: `${h.description || ''} [Сдано в кассу ${nowStr}]`,
            })
            .eq('id', h.id);
          remainingToSettle -= hAmt;
        } else {
          const rest = hAmt - remainingToSettle;
          await (supabase.from('transactions') as any)
            .update({
              amount: rest.toFixed(2),
              updated_at: new Date().toISOString(),
              description: `${h.description || ''} [Частично сдано: ${remainingToSettle.toLocaleString('ru-RU')} ₽]`,
            })
            .eq('id', h.id);

          await (supabase.from('transactions') as any).insert({
            direction: 'transfer',
            amount: remainingToSettle.toFixed(2),
            category_id: CASH_COLLECT_CAT,
            from_wallet_id: h.from_wallet_id,
            to_wallet_id: CASH_WALLET_ID,
            lifecycle_status: 'approved',
            settlement_status: 'completed',
            related_user_id: h.related_user_id,
            description: `Инкассация части переноса: ${remainingToSettle.toLocaleString('ru-RU')} ₽`,
            created_by: resolvedAdminId,
            idempotency_key: crypto.randomUUID(),
            transaction_date: new Date().toISOString(),
          });
          remainingToSettle = 0;
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Принято ${collectAmount.toFixed(2)} ₽ в кассу`,
      });
    }

    // Загружаем текущий hold
    const { data: holdTx, error: fetchErr } = await (supabase.from('transactions') as any)
      .select('*')
      .eq('id', body.hold_id)
      .single();

    if (fetchErr || !holdTx) {
      return NextResponse.json({ error: 'Запись переноса не найдена' }, { status: 404 });
    }

    const fullAmount = parseFloat(holdTx.amount);
    const collectAmount = body.collected_amount
      ? parseFloat(String(body.collected_amount))
      : fullAmount;

    if (isNaN(collectAmount) || collectAmount <= 0) {
      return NextResponse.json({ error: 'Некорректная сумма приёма' }, { status: 400 });
    }

    // 1. Создаём запись в cash_collections
    await (supabase.from('cash_collections') as any).insert({
      driver_id: holdTx.related_user_id,
      amount: collectAmount.toFixed(2),
      collected_by: resolvedAdminId,
      note:
        body.note?.trim() ||
        `Инкассация переноса от ${new Date(holdTx.created_at).toLocaleDateString('ru-RU')}`,
    });

    if (collectAmount >= fullAmount) {
      // Полная сдача: переводим транзакцию в completed
      await (supabase.from('transactions') as any)
        .update({
          settlement_status: 'completed',
          updated_at: new Date().toISOString(),
          description:
            holdTx.description + ` [Сдано в кассу ${new Date().toLocaleDateString('ru-RU')}]`,
        })
        .eq('id', holdTx.id);
    } else {
      // Частичная сдача: уменьшаем сумму остатка holdTx
      const remaining = fullAmount - collectAmount;
      await (supabase.from('transactions') as any)
        .update({
          amount: remaining.toFixed(2),
          updated_at: new Date().toISOString(),
          description: holdTx.description + ` [Частично сдано: ${collectAmount} ₽]`,
        })
        .eq('id', holdTx.id);

      // И создаём completed транзакцию на сданную часть
      await (supabase.from('transactions') as any).insert({
        direction: 'transfer',
        amount: collectAmount.toFixed(2),
        category_id: CASH_COLLECT_CAT,
        from_wallet_id: holdTx.from_wallet_id,
        to_wallet_id: CASH_WALLET_ID,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        related_user_id: holdTx.related_user_id,
        description: `Инкассация части переноса: ${collectAmount} ₽`,
        created_by: resolvedAdminId,
        idempotency_key: crypto.randomUUID(),
        transaction_date: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Принято ${collectAmount.toFixed(2)} ₽ в кассу`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
