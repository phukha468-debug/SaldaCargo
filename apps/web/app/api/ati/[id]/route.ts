/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { invalidateAtiCache } from '../route';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    invalidateAtiCache();
    const { id } = await params;
    const supabase = createAdminClient();
    const body = await request.json();

    // 1. Получаем текущую заявку
    const { data: current, error: getErr } = await (supabase.from('audit_log') as any)
      .select('id, new_values')
      .eq('id', id)
      .eq('table_name', 'ati_orders')
      .single();

    if (getErr || !current) {
      return NextResponse.json({ error: 'Заявка АТИ не найдена' }, { status: 404 });
    }

    const currentValues = current.new_values || {};
    let newStage = body.stage !== undefined ? Number(body.stage) : currentValues.stage;
    if (newStage === 8) newStage = 7;

    // ВАЛИДАЦИЯ ПЕРЕХОДА В ДЕБИТОРКУ:
    // На этапе 5 (Документы) нельзя переместить в дебиторку (этап 6), если не заполнены все 3 пункта:
    // 1) отправлено на почту, 2) получено на почте, 3) согласованная дата оплаты
    if (newStage === 6 && currentValues.stage === 5) {
      const isDocsSent = Boolean(body.docs_sent ?? currentValues.docs_sent);
      const isDocsReceived = Boolean(body.docs_received ?? currentValues.docs_received);
      const hasPaymentDate = Boolean(
        body.payment_promised_date !== undefined
          ? body.payment_promised_date
          : currentValues.payment_promised_date,
      );

      if (!isDocsSent || !isDocsReceived || !hasPaymentDate) {
        return NextResponse.json(
          {
            error:
              'Нельзя переместить в Дебиторку: необходимо заполнить все 3 пункта — отправку на почту, получение на почте и согласованную дату оплаты.',
          },
          { status: 400 },
        );
      }
    }

    const updatedValues = {
      ...currentValues,
      ...body,
      stage: newStage,
      updated_at: new Date().toISOString(),
    };

    // Автоматическая обработка статусов документооборота
    if (body.postal_tracking_number !== undefined) {
      const track = String(body.postal_tracking_number).trim();
      updatedValues.postal_tracking_number = track;
      if (track) {
        // При вводе кода отправления ставится галочка о выполнении и дата
        updatedValues.docs_sent = true;
        if (!updatedValues.docs_sent_date) {
          updatedValues.docs_sent_date = new Date().toISOString().split('T')[0];
        }
      }
    }

    if (body.docs_sent !== undefined) {
      updatedValues.docs_sent = Boolean(body.docs_sent);
      if (updatedValues.docs_sent && !updatedValues.docs_sent_date) {
        updatedValues.docs_sent_date =
          body.docs_sent_date || new Date().toISOString().split('T')[0];
      } else if (!updatedValues.docs_sent) {
        updatedValues.docs_sent_date = null;
      }
    }

    if (body.docs_received !== undefined) {
      updatedValues.docs_received = Boolean(body.docs_received);
      if (updatedValues.docs_received && !updatedValues.docs_received_date) {
        updatedValues.docs_received_date =
          body.docs_received_date || new Date().toISOString().split('T')[0];
      } else if (!updatedValues.docs_received) {
        updatedValues.docs_received_date = null;
      }
    }

    if (body.payment_promised_date !== undefined) {
      updatedValues.payment_promised_date = body.payment_promised_date || null;
    }

    // Если заявка сорвана / отменена
    if (body.is_cancelled) {
      updatedValues.is_cancelled = true;
      updatedValues.cancel_reason = body.cancel_reason || 'Срыв погрузки';
      updatedValues.cancelled_at = new Date().toISOString();
      updatedValues.stage = 0; // Снимается с активных этапов 1..8

      // Если выставлена претензия (или выбрана причина срыва на погрузке / отказ заказчика из старого меню)
      const isClaimDisruption =
        Boolean(body.has_claim) ||
        (body.cancel_reason &&
          (body.cancel_reason.toLowerCase().includes('груз не готов') ||
            body.cancel_reason.toLowerCase().includes('срыв на погрузке') ||
            body.cancel_reason.toLowerCase().includes('претензи')));

      if (isClaimDisruption) {
        updatedValues.has_claim = true;
        updatedValues.claim_status = body.claim_status || 'issued';
        updatedValues.claim_number = body.claim_number || '01-ПР';
        updatedValues.claim_date = body.claim_date || new Date().toISOString().split('T')[0];
        updatedValues.claim_penalty_amount =
          body.claim_penalty_amount !== undefined
            ? Number(body.claim_penalty_amount)
            : Math.round(Number(updatedValues.price || 0) * 0.2);
        updatedValues.claim_empty_run_amount = Number(body.claim_empty_run_amount || 0);
        updatedValues.claim_idle_amount = Number(body.claim_idle_amount || 0);
        updatedValues.claim_amount =
          body.claim_amount !== undefined
            ? Number(body.claim_amount)
            : updatedValues.claim_penalty_amount +
              updatedValues.claim_empty_run_amount +
              updatedValues.claim_idle_amount;
        updatedValues.claim_due_days = Number(body.claim_due_days || 5);
        updatedValues.claim_notes = body.claim_notes || '';
      }

      // Если ранее была создана запись в дебиторке по самому фрахту — закрываем её (рейс не состоялся)
      if (currentValues.counterparty_id) {
        try {
          await (supabase.from('manual_receivables') as any)
            .update({ settled: true })
            .eq('counterparty_id', currentValues.counterparty_id)
            .ilike('description', `АТИ Заявка ${updatedValues.order_number}%`);
        } catch (cErr) {
          console.warn('Could not close freight manual_receivables on cancel:', cErr);
        }
      }
    } else if (body.restore) {
      // Восстановление сорванной заявки обратно на доску
      updatedValues.is_cancelled = false;
      updatedValues.cancel_reason = null;
      updatedValues.cancelled_at = null;
      updatedValues.has_claim = false;
      updatedValues.claim_status = 'none';
      updatedValues.stage = body.stage || 1;

      // Если была претензия в дебиторке — аннулируем долг по претензии
      if (currentValues.counterparty_id) {
        try {
          await (supabase.from('manual_receivables') as any)
            .update({ settled: true })
            .eq('counterparty_id', currentValues.counterparty_id)
            .ilike('description', `%Претензия%${updatedValues.order_number}%`);
        } catch (rErr) {
          console.warn('Could not close claim manual_receivables on restore:', rErr);
        }
      }
    }

    // 1.1 Обновление параметров претензии (суммы, штраф, примечания)
    if (body.claim_amount !== undefined) {
      updatedValues.claim_amount = Number(body.claim_amount);
      if (body.claim_penalty_amount === undefined) {
        updatedValues.claim_penalty_amount = Number(body.claim_amount);
      }
    }
    if (body.claim_penalty_amount !== undefined) {
      updatedValues.claim_penalty_amount = Number(body.claim_penalty_amount);
    }
    if (body.claim_notes !== undefined) {
      updatedValues.claim_notes = body.claim_notes;
    }

    // Обработка перехода этапов претензии:
    if (body.claim_status) {
      updatedValues.claim_status = body.claim_status;
    }

    // При согласовании претензии ('agreed' или 'waiting_payment') или при изменении суммы согласованной претензии — КОНТРАГЕНТ АВТОМАТИЧЕСКИ ПОПАДАЕТ / ОБНОВЛЯЕТСЯ В ДЕБИТОРКЕ
    const effectiveClaimStatus = updatedValues.claim_status || currentValues.claim_status;
    const isAgreedOrWaiting =
      effectiveClaimStatus === 'agreed' || effectiveClaimStatus === 'waiting_payment';

    if (
      (body.claim_status === 'agreed' ||
        body.claim_status === 'waiting_payment' ||
        (isAgreedOrWaiting && body.claim_amount !== undefined)) &&
      currentValues.counterparty_id
    ) {
      if (body.claim_status === 'agreed' || body.claim_status === 'waiting_payment') {
        updatedValues.claim_agreed_at =
          body.claim_agreed_at || currentValues.claim_agreed_at || new Date().toISOString();
      }
      const claimAmt = Number(updatedValues.claim_amount ?? currentValues.claim_amount ?? 6000);
      const claimNum = updatedValues.claim_number || currentValues.claim_number || '01-ПР';
      const orderNum = updatedValues.order_number || currentValues.order_number;
      const freightPrice = Number(updatedValues.price || currentValues.price || 0);
      const percentStr =
        freightPrice > 0 ? ` (${Math.round((claimAmt / freightPrice) * 100)}%)` : '';
      const notesSuffix = updatedValues.claim_notes ? ` [${updatedValues.claim_notes}]` : '';
      const claimDesc = `Претензия Исх. № ${claimNum} по срыву заявки ${orderNum}${percentStr}${notesSuffix}`;

      try {
        const { data: existingClaimRec } = await (supabase.from('manual_receivables') as any)
          .select('id')
          .eq('counterparty_id', currentValues.counterparty_id)
          .ilike('description', `%${claimNum}%`)
          .limit(1);

        if (!existingClaimRec || existingClaimRec.length === 0) {
          await (supabase.from('manual_receivables') as any).insert({
            counterparty_id: currentValues.counterparty_id,
            amount: claimAmt,
            date: new Date().toISOString().split('T')[0],
            description: claimDesc,
            settled: false,
          });
        } else {
          await (supabase.from('manual_receivables') as any)
            .update({ amount: claimAmt, description: claimDesc, settled: false })
            .eq('id', existingClaimRec[0].id);
        }
      } catch (cRecErr) {
        console.warn('Error syncing claim with manual_receivables:', cRecErr);
      }
    }

    // При оплате претензии ('paid') — закрываем запись в дебиторке
    if (body.claim_status === 'paid' && currentValues.counterparty_id) {
      updatedValues.claim_paid_at = new Date().toISOString();
      const claimNum = updatedValues.claim_number || currentValues.claim_number || '01-ПР';
      try {
        await (supabase.from('manual_receivables') as any)
          .update({ settled: true, settled_at: new Date().toISOString() })
          .eq('counterparty_id', currentValues.counterparty_id)
          .ilike('description', `%${claimNum}%`);
      } catch (cPaidErr) {
        console.warn('Error settling claim manual_receivables:', cPaidErr);
      }
    }

    // 2. Интеграция с Дебиторкой (Этап 6: Ожидание оплаты / Дебиторка):
    if (
      (newStage === 6 || newStage === 7) &&
      currentValues.counterparty_id &&
      updatedValues.price > 0 &&
      !updatedValues.is_cancelled
    ) {
      if (newStage === 6) {
        try {
          const atiRefDesc = `АТИ Заявка ${updatedValues.order_number}`;

          // Проверяем: есть ли уже заказ в trip_orders по этому контрагенту и этой сумме (чтобы не дублировать рейс, напр. рейс 840!)
          const { data: existingTripOrders } = await (supabase.from('trip_orders') as any)
            .select('id, trip_id, amount')
            .eq('counterparty_id', currentValues.counterparty_id)
            .eq('amount', updatedValues.price)
            .neq('settlement_status', 'settled')
            .limit(1);

          const hasTripOrder = existingTripOrders && existingTripOrders.length > 0;

          // Проверяем: есть ли уже запись в manual_receivables
          const { data: existingRec } = await (supabase.from('manual_receivables') as any)
            .select('id')
            .eq('counterparty_id', currentValues.counterparty_id)
            .ilike('description', `%${updatedValues.order_number}%`)
            .limit(1);

          // Вставляем в manual_receivables ТОЛЬКО если долга еще нет в рейсах и нет в ручных записях!
          if (!hasTripOrder && (!existingRec || existingRec.length === 0)) {
            await (supabase.from('manual_receivables') as any).insert({
              counterparty_id: currentValues.counterparty_id,
              amount: updatedValues.price,
              date: new Date().toISOString().split('T')[0],
              description: atiRefDesc,
              settled: false,
            });
          }
        } catch (recErr) {
          console.warn('Warning: could not sync manual_receivables for ATI order:', recErr);
        }
      }
    }

    // Если переведена на этап 7 (Оплачено) — закрываем в дебиторке
    if (newStage === 7 && currentValues.counterparty_id) {
      try {
        await (supabase.from('manual_receivables') as any)
          .update({ settled: true, settled_at: new Date().toISOString() })
          .eq('counterparty_id', currentValues.counterparty_id)
          .ilike('description', `%${updatedValues.order_number}%`);
      } catch (recCloseErr) {
        console.warn('Warning: could not close manual_receivables for ATI order:', recCloseErr);
      }
    }

    // 3. Сохраняем обновленные значения в audit_log
    const { data: updated, error: updateErr } = await (supabase.from('audit_log') as any)
      .update({
        new_values: updatedValues,
        changed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, new_values')
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: {
        id: updated.id,
        ...updated.new_values,
      },
    });
  } catch (err: any) {
    console.error('Fatal PATCH /api/ati/[id] error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    invalidateAtiCache();
    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await (supabase.from('audit_log') as any)
      .delete()
      .eq('id', id)
      .eq('table_name', 'ati_orders');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Fatal DELETE /api/ati/[id] error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
