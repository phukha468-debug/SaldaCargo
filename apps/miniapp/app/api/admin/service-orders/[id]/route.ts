/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** PATCH /api/admin/service-orders/:id */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    action: 'approve' | 'return' | 'cancel' | 'edit_note';
    admin_note?: string;
  };
  const supabase = createAdminClient();

  if (body.action === 'approve') {
    const { error } = await (supabase.from('service_orders') as any)
      .update({ lifecycle_status: 'approved' })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'approved' });
  }

  if (body.action === 'return') {
    const { error } = await (supabase.from('service_orders') as any)
      .update({ lifecycle_status: 'returned' })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'returned' });
  }

  if (body.action === 'cancel') {
    const { error } = await (supabase.from('service_orders') as any)
      .update({ lifecycle_status: 'cancelled', status: 'cancelled' })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'cancelled' });
  }

  if (body.action === 'edit_note') {
    const { error } = await (supabase.from('service_orders') as any)
      .update({ admin_note: body.admin_note?.trim() ?? null })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
