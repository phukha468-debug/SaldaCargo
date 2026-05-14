/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** PATCH /api/receivables/follow-up/[counterpartyId] — upsert follow-up record */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ counterpartyId: string }> },
) {
  const { counterpartyId } = await params;
  const supabase = createAdminClient();

  const cookieStore = await cookies();
  let userId = cookieStore.get('salda_user_id')?.value ?? null;
  if (!userId) {
    const { data: adminUser } = await (supabase as any)
      .from('users')
      .select('id')
      .contains('roles', ['admin'])
      .limit(1)
      .maybeSingle();
    userId = adminUser?.id ?? 'e9a1c980-eb1e-5c87-9f6d-c7f67eb28a1d';
  }

  const body = await req.json();
  const { status, promise_date, next_contact_at, notes } = body;

  const payload: Record<string, any> = {
    counterparty_id: counterpartyId,
    last_contact_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: userId,
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
