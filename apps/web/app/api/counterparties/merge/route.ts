/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/**
 * POST /api/counterparties/merge
 * Объединяет двух контрагентов:
 * - Все рейсы (trip_orders), транзакции (transactions), ручная дебиторка (manual_receivables),
 *   заказ-наряды (service_orders) и автомобили (client_vehicles) переносятся на target_id.
 * - Долги поставщику (payable_amount) суммируются к target.
 * - Контакты (телефон, email) дополняются, если у target они были пустыми.
 * - source_id деактивируется (is_active = false) с пометкой об объединении.
 * Body: { source_id: string, target_id: string }
 */
export async function POST(request: Request) {
  try {
    const { source_id, target_id } = (await request.json()) as {
      source_id: string;
      target_id: string;
    };

    if (!source_id || !target_id) {
      return NextResponse.json({ error: 'source_id и target_id обязательны' }, { status: 400 });
    }
    if (source_id === target_id) {
      return NextResponse.json(
        { error: 'Нельзя объединить контрагента с самим собой' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // 1. Загружаем обоих контрагентов
    const [{ data: sourceCp, error: srcErr }, { data: targetCp, error: trgErr }] =
      await Promise.all([
        (supabase as any).from('counterparties').select('*').eq('id', source_id).single(),
        (supabase as any).from('counterparties').select('*').eq('id', target_id).single(),
      ]);

    if (srcErr || !sourceCp) {
      return NextResponse.json({ error: 'Исходный контрагент (дубль) не найден' }, { status: 404 });
    }
    if (trgErr || !targetCp) {
      return NextResponse.json(
        { error: 'Целевой (основной) контрагент не найден' },
        { status: 404 },
      );
    }

    // 2. Перепривязываем заказы рейсов (trip_orders)
    await (supabase as any)
      .from('trip_orders')
      .update({ counterparty_id: target_id })
      .eq('counterparty_id', source_id);

    // 3. Перепривязываем финансовые транзакции (transactions)
    await (supabase as any)
      .from('transactions')
      .update({ counterparty_id: target_id })
      .eq('counterparty_id', source_id);

    // 4. Перепривязываем ручную дебиторку (manual_receivables)
    await (supabase as any)
      .from('manual_receivables')
      .update({ counterparty_id: target_id })
      .eq('counterparty_id', source_id);

    // 5. Перепривязываем автосервис: заказ-наряды (service_orders) и автомобили (client_vehicles)
    await (supabase as any)
      .from('service_orders')
      .update({ counterparty_id: target_id })
      .eq('counterparty_id', source_id);

    await (supabase as any)
      .from('client_vehicles')
      .update({ counterparty_id: target_id })
      .eq('counterparty_id', source_id);

    // 6. Перепривязываем follow-up по дебиторке
    const { data: targetFu } = await (supabase as any)
      .from('receivable_follow_ups')
      .select('id')
      .eq('counterparty_id', target_id)
      .maybeSingle();

    if (targetFu) {
      await (supabase as any)
        .from('receivable_follow_ups')
        .delete()
        .eq('counterparty_id', source_id);
    } else {
      await (supabase as any)
        .from('receivable_follow_ups')
        .update({ counterparty_id: target_id })
        .eq('counterparty_id', source_id);
    }

    // 7. Слияние кредиторской задолженности и контактных данных
    const srcPayable = parseFloat(sourceCp.payable_amount ?? '0') || 0;
    const trgPayable = parseFloat(targetCp.payable_amount ?? '0') || 0;
    const combinedPayable = (trgPayable + srcPayable).toFixed(2);

    const updateTarget: Record<string, any> = {
      payable_amount: combinedPayable,
      updated_at: new Date().toISOString(),
    };

    if (!targetCp.phone && sourceCp.phone) {
      updateTarget.phone = sourceCp.phone;
    }
    if (!targetCp.email && sourceCp.email) {
      updateTarget.email = sourceCp.email;
    }
    if (sourceCp.is_regular && !targetCp.is_regular) {
      updateTarget.is_regular = true;
    }
    if (sourceCp.is_legal_entity && !targetCp.is_legal_entity) {
      updateTarget.is_legal_entity = true;
    }
    // Если один был клиентом, а другой поставщиком -> type = 'both'
    if (sourceCp.type === 'both' || targetCp.type === 'both' || sourceCp.type !== targetCp.type) {
      updateTarget.type = 'both';
    }

    const mergeNote = `[Объединён с дублем «${sourceCp.name}» от ${new Date().toLocaleDateString('ru-RU')}]`;
    updateTarget.notes = targetCp.notes
      ? `${targetCp.notes}\n${mergeNote}${sourceCp.notes ? ` (Заметки дубля: ${sourceCp.notes})` : ''}`
      : `${mergeNote}${sourceCp.notes ? ` ${sourceCp.notes}` : ''}`;

    await (supabase as any).from('counterparties').update(updateTarget).eq('id', target_id);

    // 8. Деактивируем исходного контрагента (дубль)
    const deactivatedNote = `[Дубль, объединён в «${targetCp.name}» (ID: ${target_id}) ${new Date().toLocaleDateString('ru-RU')}]`;
    await (supabase as any)
      .from('counterparties')
      .update({
        is_active: false,
        payable_amount: '0.00',
        notes: sourceCp.notes ? `${sourceCp.notes}\n${deactivatedNote}` : deactivatedNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source_id);

    return NextResponse.json({
      ok: true,
      message: `Контрагент «${sourceCp.name}» успешно объединен в «${targetCp.name}»`,
      target_id,
      source_id,
    });
  } catch (err: any) {
    console.error('Error merging counterparties:', err);
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
