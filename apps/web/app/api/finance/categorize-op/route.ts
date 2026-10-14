/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import fs from 'fs';
import path from 'path';

const BANK_ID = '10000000-0000-0000-0000-000000000001';
const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';
const WALLET_TRANSFER_CAT = 'b9946a5e-4a33-4ed9-a272-5dee12d4ca93';
const LOAN_REPAYMENT_CAT = '00000000-0000-0000-0000-000000000020';

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
    let fromWallet = from_wallet_id || existingTx?.from_wallet_id || BANK_ID;
    let toWallet = to_wallet_id !== undefined ? to_wallet_id : existingTx?.to_wallet_id || null;

    if (toWallet || category_id === WALLET_TRANSFER_CAT) {
      direction = 'transfer';
      if (!toWallet) toWallet = FUEL_CARD_ID;
      if (!fromWallet) fromWallet = BANK_ID;
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
      // Создаем новую запись транзакции для банковской операции
      const insertData: Record<string, any> = {
        direction,
        amount: numAmount > 0 ? numAmount : 0,
        category_id: category_id || null,
        from_wallet_id: fromWallet,
        to_wallet_id: toWallet,
        description: description ? String(description).trim() : 'Расход по Р/С',
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        transaction_date: txDate,
        created_at: txDate,
        idempotency_key: cleanId,
        created_by: adminUser?.id || null,
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
    // Если явно передан obligation_id, либо если статья расхода — кредит/займ
    let matchedOblId = obligation_id;

    if (!matchedOblId && category_id === LOAN_REPAYMENT_CAT) {
      // Автоподбор активного кредита из таблицы loans
      const { data: loans } = await (supabase.from('loans') as any)
        .select('id, lender_name, monthly_payment')
        .eq('is_active', true);

      if (Array.isArray(loans) && loans.length > 0) {
        const descLower = (description || '').toLowerCase();
        // Ищем по совпадению названия банка/кредитора или совпадению суммы
        const match =
          loans.find((l: any) => descLower.includes((l.lender_name || '').toLowerCase())) ||
          loans.find(
            (l: any) => Math.abs(parseFloat(l.monthly_payment || '0') - numAmount) < 100,
          ) ||
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

      // Сохраняем отметку об оплате в payment_calendar_overrides
      await (supabase.from('payment_calendar_overrides') as any).upsert({
        id: overrideId,
        period,
        obligation_id: matchedOblId,
        paid_amount: payAmount,
        paid_at: txDate,
        wallet_id: fromWallet,
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
