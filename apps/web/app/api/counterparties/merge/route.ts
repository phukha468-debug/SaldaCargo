/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/**
 * POST /api/counterparties/merge
 * Объединяет двух контрагентов: все ссылки переносятся на target, source деактивируется.
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

    // Reassign trip_orders
    await (supabase as any)
      .from('trip_orders')
      .update({ counterparty_id: target_id })
      .eq('counterparty_id', source_id);

    // Reassign manual_receivables
    await (supabase as any)
      .from('manual_receivables')
      .update({ counterparty_id: target_id })
      .eq('counterparty_id', source_id);

    // Reassign follow-up (если у target нет — перенести, если есть — удалить source)
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

    // Deactivate source
    await (supabase as any).from('counterparties').update({ is_active: false }).eq('id', source_id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
