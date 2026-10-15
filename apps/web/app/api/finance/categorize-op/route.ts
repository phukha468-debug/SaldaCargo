/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import fs from 'fs';
import path from 'path';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';
const WALLET_TRANSFER_CAT = 'b9946a5e-4a33-4ed9-a272-5dee12d4ca93';
const LOAN_REPAYMENT_CAT = '00000000-0000-0000-0000-000000000020';
const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';

function getLocalFilePath(filename: string): string {
  const inAppsWeb = path.join(process.cwd(), 'apps', 'web', 'data', filename);
  if (fs.existsSync(inAppsWeb)) return inAppsWeb;
  const inCwd = path.join(process.cwd(), 'data', filename);
  if (fs.existsSync(inCwd)) return inCwd;
  return inAppsWeb;
}

function updateLocalSettlements(
  period: string,
  obligationId: string,
  paidAmount: number,
  walletId: string,
  paidAt: string,
) {
  try {
    const localSetPath = getLocalFilePath('payment_settlements.json');
    let settlementsMap: Record<string, Record<string, any>> = {};
    if (fs.existsSync(localSetPath)) {
      settlementsMap = JSON.parse(fs.readFileSync(localSetPath, 'utf-8'));
    }
    if (!settlementsMap[period]) settlementsMap[period] = {};
    settlementsMap[period][obligationId] = {
      paid_amount: paidAmount,
      paid_at: paidAt,
      wallet_id: walletId,
    };
    const dir = path.dirname(localSetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localSetPath, JSON.stringify(settlementsMap, null, 2), 'utf-8');
  } catch {
    // Ignore serverless write errors
  }
}

/**
 * POST /api/finance/categorize-op
 * Классификация, переименование расхода или банковской операции,
 * с поддержкой перемещения на топливную карту и автосвязки с Календарём платежей.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      description,
      category_id,
      amount,
      to_wallet_id,
      from_wallet_id,
      transaction_date,
      obligation_id,
      related_user_id,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Не указан ID операции' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const cleanId = String(id)
      .replace(/^tbank-deb-/, '')
      .replace(/^tbank-/, '');
    const numAmount = parseFloat(amount || '0') || 0;
    const txDate = transaction_date || new Date().toISOString();

    // Находим админа для поля created_by при вставке
    const { data: adminUser } = await (supabase.from('users') as any)
      .select('id')
      .or('roles.cs.{admin},roles.cs.{owner}')
      .limit(1)
      .single();

    // 1. Проверяем, существует ли уже такая транзакция в transactions
    // (по id или по idempotency_key = cleanId)
    const { data: existingTx } = await (supabase.from('transactions') as any)
      .select('*')
      .or(`id.eq.${cleanId},idempotency_key.eq.${cleanId}`)
      .maybeSingle();

    // Определение направления и кошельков
    let direction = body.direction || 'expense';
    let fromWallet =
      from_wallet_id !== undefined
        ? from_wallet_id
        : existingTx?.from_wallet_id || (direction === 'expense' ? BANK_ID : null);
    let toWallet =
      to_wallet_id !== undefined
        ? to_wallet_id
        : existingTx?.to_wallet_id || (direction === 'income' ? BANK_ID : null);

    if (direction !== 'income' && (toWallet || category_id === WALLET_TRANSFER_CAT)) {
      direction = 'transfer';
      if (!toWallet) toWallet = FUEL_CARD_ID;
      if (!fromWallet) fromWallet = BANK_ID;
    }

    // Разрешение сотрудника (водителя): если передан явно или автопоиск по имени в описании
    let finalRelatedUserId: string | null =
      related_user_id !== undefined ? related_user_id || null : existingTx?.related_user_id || null;

    if (
      !finalRelatedUserId &&
      (category_id === ADVANCE_CATEGORY_ID || /аванс|суточн/i.test(description || ''))
    ) {
      const descLower = (description || '').toLowerCase();
      const { data: usersList } = await (supabase.from('users') as any)
        .select('id, name')
        .eq('is_active', true);
      if (Array.isArray(usersList)) {
        const matched = usersList.find((u: any) => {
          if (!u.name) return false;
          const words = u.name
            .toLowerCase()
            .split(/\s+/)
            .filter((w: string) => w.length >= 3);
          return words.some((w: string) => descLower.includes(w));
        });
        if (matched) {
          finalRelatedUserId = matched.id;
        }
      }
    }

    let savedTx: any = null;

    if (existingTx) {
      // Обновляем существующую транзакцию
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (description !== undefined) updateData.description = String(description).trim();
      if (category_id !== undefined) updateData.category_id = category_id;
      if (toWallet !== undefined) updateData.to_wallet_id = toWallet;
      if (fromWallet !== undefined) updateData.from_wallet_id = fromWallet;
      if (direction !== undefined) updateData.direction = direction;
      if (body.trip_order_id !== undefined) updateData.trip_order_id = body.trip_order_id;
      if (finalRelatedUserId !== undefined) updateData.related_user_id = finalRelatedUserId;

      const { data: updated, error: updErr } = await (supabase.from('transactions') as any)
        .update(updateData)
        .eq('id', existingTx.id)
        .select()
        .single();

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
      savedTx = updated;
    } else {
      // Создаем новую запись транзакции для банковской операции или ручного ввода
      const insertData: Record<string, any> = {
        direction,
        amount: numAmount > 0 ? numAmount : 0,
        category_id: category_id || null,
        from_wallet_id: fromWallet,
        to_wallet_id: toWallet,
        description: description
          ? String(description).trim()
          : direction === 'income'
            ? 'Поступление'
            : 'Расход',
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        transaction_date: txDate,
        created_at: txDate,
        idempotency_key: cleanId,
        created_by: adminUser?.id || null,
        trip_order_id: body.trip_order_id || null,
        related_user_id: finalRelatedUserId || null,
      };

      const { data: inserted, error: insErr } = await (supabase.from('transactions') as any)
        .insert(insertData)
        .select()
        .single();

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      savedTx = inserted;
    }

    // 2. АВТОМАТИЧЕСКАЯ СИНХРОНИЗАЦИЯ С КАЛЕНДАРЁМ ПЛАТЕЖЕЙ
    let matchedOblId = obligation_id;

    if (matchedOblId === 'none') {
      matchedOblId = null;
    } else if (!matchedOblId && category_id === LOAN_REPAYMENT_CAT) {
      // Автоподбор активного кредита из таблицы loans
      const { data: loans } = await (supabase.from('loans') as any)
        .select('id, lender_name, monthly_payment, purpose')
        .eq('is_active', true);

      if (Array.isArray(loans) && loans.length > 0) {
        const descLower = (description || '').toLowerCase();
        // 1. Поиск по сумме или по номеру/назначению кредита
        const match =
          loans.find(
            (l: any) =>
              (descLower.includes('19к') ||
                descLower.includes('19000') ||
                descLower.includes('19 000')) &&
              Math.abs(parseFloat(l.monthly_payment || '0') - 19310) < 1000,
          ) ||
          loans.find(
            (l: any) =>
              (descLower.includes('32к') ||
                descLower.includes('32000') ||
                descLower.includes('32 000')) &&
              Math.abs(parseFloat(l.monthly_payment || '0') - 32300) < 1000,
          ) ||
          loans.find(
            (l: any) =>
              (descLower.includes('55к') ||
                descLower.includes('55000') ||
                descLower.includes('55 000')) &&
              Math.abs(parseFloat(l.monthly_payment || '0') - 55000) < 1000,
          ) ||
          loans.find(
            (l: any) => l.purpose && descLower.includes(String(l.purpose).toLowerCase()),
          ) ||
          loans.find(
            (l: any) => Math.abs(parseFloat(l.monthly_payment || '0') - numAmount) <= 1000,
          ) ||
          loans.find((l: any) => descLower.includes((l.lender_name || '').toLowerCase())) ||
          loans[0];

        if (match) {
          matchedOblId = `loan-${match.id}`;
        }
      }
    }

    if (matchedOblId) {
      const period = txDate.slice(0, 7); // YYYY-MM
      const overrideId = `${period}:${matchedOblId}`;
      const payAmount = numAmount > 0 ? numAmount : parseFloat(savedTx?.amount || '0');
      const txIdRef = savedTx?.id || cleanId;

      // Сохраняем отметку об оплате в payment_calendar_overrides
      await (supabase.from('payment_calendar_overrides') as any).upsert({
        id: overrideId,
        period,
        obligation_id: matchedOblId,
        paid_amount: payAmount,
        paid_at: txDate,
        wallet_id: fromWallet,
        custom_notes: `Оплачено через Р/С [tx:${txIdRef}]`,
        updated_at: new Date().toISOString(),
      });

      // Обновляем локальный JSON резерв
      updateLocalSettlements(period, matchedOblId, payAmount, fromWallet, txDate);
    }

    return NextResponse.json({
      success: true,
      transaction: savedTx,
      matched_obligation_id: matchedOblId || null,
    });
  } catch (err: any) {
    console.error('Error in POST /api/finance/categorize-op:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
