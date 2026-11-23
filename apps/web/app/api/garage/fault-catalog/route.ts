/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { getVerifiedWebSession } from '@/lib/auth';
import { DEFAULT_ORGANIZATION_ID } from '@saldacargo/shared';
import { NextResponse } from 'next/server';

/** GET /api/garage/fault-catalog */
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('fault_catalog') as any)
    .select('*')
    .order('category')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/garage/fault-catalog */
export async function POST(request: Request) {
  const body = await request.json();
  const { name, category } = body as { name: string; category: string };
  if (!name?.trim()) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });

  const supabase = createAdminClient();
  const session = await getVerifiedWebSession();
  const organizationId = session?.oid || DEFAULT_ORGANIZATION_ID;
  const { data, error } = await (supabase.from('fault_catalog') as any)
    .insert({
      organization_id: organizationId,
      name: name.trim(),
      category: category?.trim() || 'other',
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
