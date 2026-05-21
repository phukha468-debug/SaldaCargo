/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/garage/work-catalog */
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('work_catalog') as any)
    .select('*')
    .order('category')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/garage/work-catalog */
export async function POST(request: Request) {
  const body = await request.json();
  const {
    code,
    name,
    category,
    norm_minutes,
    norm_minutes_valdai,
    default_price_client,
    default_price_client_valdai,
    internal_cost_rate,
  } = body as {
    code?: string;
    name: string;
    category?: string;
    norm_minutes?: number;
    norm_minutes_valdai?: number;
    default_price_client?: number;
    default_price_client_valdai?: number;
    internal_cost_rate?: number;
  };

  if (!name?.trim()) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await (supabase.from('work_catalog') as any)
    .insert({
      code: code?.trim() || null,
      name: name.trim(),
      category: category?.trim() || null,
      norm_minutes: norm_minutes ?? null,
      norm_minutes_valdai: norm_minutes_valdai ?? null,
      default_price_client: (default_price_client ?? 0).toString(),
      default_price_client_valdai: default_price_client_valdai?.toString() ?? null,
      internal_cost_rate: (internal_cost_rate ?? 0).toString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
