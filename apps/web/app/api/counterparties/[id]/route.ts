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
      client_role?: 'owner' | 'forwarder';
      phone?: string | null;
      email?: string | null;
      credit_limit?: string | null;
      notes?: string | null;
      is_active?: boolean;
      is_regular?: boolean;
      payable_amount?: string | null;
      inn?: string | null;
      kpp?: string | null;
      ogrn?: string | null;
      legal_address?: string | null;
      actual_address?: string | null;
      contact_person?: string | null;
      ati_code?: string | null;
      bank_name?: string | null;
      bik?: string | null;
      bank_account?: string | null;
      corr_account?: string | null;
    };

    const supabase = createAdminClient();

    const update: Record<string, any> = {};
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.type !== undefined) update.type = body.type;
    if (body.client_role !== undefined) update.client_role = body.client_role;
    if (body.phone !== undefined) update.phone = body.phone?.trim() || null;
    if (body.email !== undefined) update.email = body.email?.trim() || null;
    if (body.credit_limit !== undefined) update.credit_limit = body.credit_limit || null;
    if (body.notes !== undefined) update.notes = body.notes?.trim() || null;
    if (body.is_active !== undefined) update.is_active = body.is_active;
    if (body.is_regular !== undefined) update.is_regular = body.is_regular;
    if ((body as any).is_legal_entity !== undefined)
      update.is_legal_entity = (body as any).is_legal_entity;
    if (body.inn !== undefined) update.inn = body.inn?.trim() || null;
    if (body.kpp !== undefined) update.kpp = body.kpp?.trim() || null;
    if (body.ogrn !== undefined) update.ogrn = body.ogrn?.trim() || null;
    if (body.legal_address !== undefined) update.legal_address = body.legal_address?.trim() || null;
    if (body.actual_address !== undefined)
      update.actual_address = body.actual_address?.trim() || null;
    if (body.contact_person !== undefined)
      update.contact_person = body.contact_person?.trim() || null;
    if (body.ati_code !== undefined) update.ati_code = body.ati_code?.trim() || null;
    if (body.bank_name !== undefined) update.bank_name = body.bank_name?.trim() || null;
    if (body.bik !== undefined) update.bik = body.bik?.trim() || null;
    if (body.bank_account !== undefined) update.bank_account = body.bank_account?.trim() || null;
    if (body.corr_account !== undefined) update.corr_account = body.corr_account?.trim() || null;
    if (body.payable_amount !== undefined) {
      const parsedPayable = parseFloat(body.payable_amount || '0');
      update.payable_amount =
        !isNaN(parsedPayable) && parsedPayable >= 0 ? parsedPayable.toFixed(2) : '0.00';

      // Если долг поставщику обнулен вручную, закрываем старые pending-расходы по нему
      if (parsedPayable === 0) {
        await (supabase.from('transactions') as any)
          .update({ settlement_status: 'completed' })
          .eq('counterparty_id', id)
          .eq('direction', 'expense')
          .eq('settlement_status', 'pending');
      }
    }

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
