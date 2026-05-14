/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/counterparties/[id] — обновить контрагента */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      type?: string;
      phone?: string | null;
      email?: string | null;
      credit_limit?: string | null;
      notes?: string | null;
      is_active?: boolean;
      is_regular?: boolean;
      payable_amount?: string | null;
    };

    const supabase = createAdminClient();

    const update: Record<string, any> = {};
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.type !== undefined) update.type = body.type;
    if (body.phone !== undefined) update.phone = body.phone?.trim() || null;
    if (body.email !== undefined) update.email = body.email?.trim() || null;
    if (body.credit_limit !== undefined) update.credit_limit = body.credit_limit || null;
    if (body.notes !== undefined) update.notes = body.notes?.trim() || null;
    if (body.is_active !== undefined) update.is_active = body.is_active;
    if (body.is_regular !== undefined) update.is_regular = body.is_regular;
    if (body.payable_amount !== undefined)
      update.payable_amount = body.payable_amount
        ? parseFloat(body.payable_amount).toFixed(2)
        : '0.00';

    const { data, error } = await (supabase.from('counterparties') as any)
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** DELETE /api/counterparties/[id] — удалить контрагента (только если нет заказов) */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await (supabase.from('counterparties') as any).delete().eq('id', id);

    if (error) {
      // FK violation — у клиента есть заказы
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Нельзя удалить: у клиента есть заказы. Отправьте в архив.' },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
