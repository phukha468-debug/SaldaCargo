/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** PATCH /api/admin/receivables/follow-up/[counterpartyId] — upsert follow-up record */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ counterpartyId: string }> },
) {
  const { counterpartyId } = await params;

  const cookieStore = await cookies();
  const adminId = cookieStore.get('salda_user_id')?.value;
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const body = await req.json();
  const { status, promise_date, next_contact_at, notes } = body;

  const payload: Record<string, any> = {
    counterparty_id: counterpartyId,
    last_contact_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  };

  if (status !== undefined) payload.status = status;
  if (promise_date !== undefined) payload.promise_date = promise_date || null;
  if (next_contact_at !== undefined) payload.next_contact_at = next_contact_at || null;
  if (notes !== undefined) payload.notes = notes?.trim() || null;

  const { data, error } = await (supabase as any)
    .from('receivable_follow_ups')
    .upsert(payload, { onConflict: 'counterparty_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
