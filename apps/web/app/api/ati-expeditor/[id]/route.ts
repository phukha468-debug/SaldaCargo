/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { invalidateExpCache } from '../route';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    invalidateExpCache();
    const { id } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    // Получаем текущую запись
    const { data: current, error: getErr } = await (supabase.from('audit_log') as any)
      .select('new_values')
      .eq('id', id)
      .eq('table_name', 'ati_expeditor_orders')
      .single();

    if (getErr || !current) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    const currentValues = current.new_values || {};
    const updatedValues = {
      ...currentValues,
      ...body,
      updated_at: new Date().toISOString(),
    };

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
    console.error('Fatal PATCH /api/ati-expeditor/[id] error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    invalidateExpCache();
    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await (supabase.from('audit_log') as any)
      .delete()
      .eq('id', id)
      .eq('table_name', 'ati_expeditor_orders');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Fatal DELETE /api/ati-expeditor/[id] error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
