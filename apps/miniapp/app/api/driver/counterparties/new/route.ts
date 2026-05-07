/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/driver/counterparties/new — создать нового клиента */
export async function POST(request: Request) {
  const body = (await request.json()) as { name: string; type: string };
  const supabase = createAdminClient();

  const { data, error } = await ((supabase.from('counterparties') as any)
    .insert({
      name: body.name,
      type: body.type || 'client',
      is_active: true,
    })
    .select()
    .single() as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
