/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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
    const newStage = body.stage !== undefined ? Number(body.stage) : currentValues.stage;

    const updatedValues = {
      ...currentValues,
      ...body,
      stage: newStage,
      updated_at: new Date().toISOString(),
    };

    // Если заявка сорвана / отменена
    if (body.is_cancelled) {
      updatedValues.is_cancelled = true;
      updatedValues.cancel_reason = body.cancel_reason || 'Срыв погрузки';
      updatedValues.cancelled_at = new Date().toISOString();
      updatedValues.stage = 0; // Снимается с активных этапов 1..8

      // Если выставлена претензия
      if (body.has_claim) {
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

    // Обработка перехода этапов претензии:
    if (body.claim_status) {
      updatedValues.claim_status = body.claim_status;

      // При согласовании претензии ('agreed' или 'waiting_payment') — КОНТРАГЕНТ АВТОМАТИЧЕСКИ ПОПАДАЕТ В ДЕБИТОРКУ
      if (
        (body.claim_status === 'agreed' || body.claim_status === 'waiting_payment') &&
        currentValues.counterparty_id
      ) {
        updatedValues.claim_agreed_at = body.claim_agreed_at || new Date().toISOString();
        const claimAmt = Number(updatedValues.claim_amount || 6000);
        const claimNum = updatedValues.claim_number || '01-ПР';
        const claimDesc = `Претензия Исх. № ${claimNum} по срыву заявки ${updatedValues.order_number} (штраф 20%)`;

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
              .update({ amount: claimAmt, settled: false })
              .eq('id', existingClaimRec[0].id);
          }
        } catch (cRecErr) {
          console.warn('Error syncing claim with manual_receivables:', cRecErr);
        }
      }

      // При оплате претензии ('paid') — закрываем запись в дебиторке
      if (body.claim_status === 'paid' && currentValues.counterparty_id) {
        updatedValues.claim_paid_at = new Date().toISOString();
        const claimNum = updatedValues.claim_number || '01-ПР';
        try {
          await (supabase.from('manual_receivables') as any)
            .update({ settled: true, settled_at: new Date().toISOString() })
            .eq('counterparty_id', currentValues.counterparty_id)
            .ilike('description', `%${claimNum}%`);
        } catch (cPaidErr) {
          console.warn('Error settling claim manual_receivables:', cPaidErr);
        }
      }
    }

    // 2. Интеграция с Дебиторкой:
    if (
      newStage === 7 &&
      currentValues.counterparty_id &&
      updatedValues.price > 0 &&
      !updatedValues.is_cancelled
    ) {
      try {
        const atiRefDesc = `АТИ Заявка ${updatedValues.order_number}`;
        const { data: existingRec } = await (supabase.from('manual_receivables') as any)
          .select('id')
          .eq('counterparty_id', currentValues.counterparty_id)
          .ilike('description', `%${updatedValues.order_number}%`)
          .limit(1);

        if (!existingRec || existingRec.length === 0) {
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

    // Если переведена на этап 8 (Оплачено) — закрываем в дебиторке
    if (newStage === 8 && currentValues.counterparty_id) {
      try {
        await (supabase.from('manual_receivables') as any)
          .update({ settled: true })
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
