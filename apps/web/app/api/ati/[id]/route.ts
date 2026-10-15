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

      // Если была создана запись в дебиторке — закрываем её
      if (currentValues.counterparty_id) {
        try {
          await (supabase.from('manual_receivables') as any)
            .update({ settled: true })
            .eq('counterparty_id', currentValues.counterparty_id)
            .ilike('description', `%${updatedValues.order_number}%`);
        } catch (cErr) {
          console.warn('Could not close manual_receivables on cancel:', cErr);
        }
      }
    } else if (body.restore) {
      // Восстановление сорванной заявки обратно на доску
      updatedValues.is_cancelled = false;
      updatedValues.cancel_reason = null;
      updatedValues.cancelled_at = null;
      updatedValues.stage = body.stage || 1;
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
