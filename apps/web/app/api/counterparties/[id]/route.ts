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
      credit_limit?: string | null;
      notes?: string | null;
      is_active?: boolean;
    };

    const supabase = createAdminClient();

    const update: Record<string, any> = {};
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.type !== undefined) update.type = body.type;
    if (body.phone !== undefined) update.phone = body.phone?.trim() || null;
    if (body.credit_limit !== undefined) update.credit_limit = body.credit_limit || null;
    if (body.notes !== undefined) update.notes = body.notes?.trim() || null;
    if (body.is_active !== undefined) update.is_active = body.is_active;

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
