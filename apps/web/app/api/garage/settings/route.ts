/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createAdminClient();
  const [{ data: sto }, { data: mechanics }] = await Promise.all([
    (supabase.from('sto_settings') as any).select('*').limit(1).single(),
    (supabase.from('users') as any)
      .select('id, name, mechanic_salary_pct')
      .contains('roles', ['mechanic'])
      .eq('is_active', true)
      .order('name'),
  ]);
  return NextResponse.json({
    sto: sto ?? { hourly_rate: '2000.00', hourly_rate_own: '1600.00' },
    mechanics: mechanics ?? [],
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const supabase = createAdminClient();
  if ('hourly_rate' in body || 'hourly_rate_own' in body) {
    const updates: Record<string, string> = {};
    if ('hourly_rate' in body) updates.hourly_rate = body.hourly_rate.toString();
    if ('hourly_rate_own' in body) updates.hourly_rate_own = body.hourly_rate_own.toString();
    const { data: sto } = await (supabase.from('sto_settings') as any)
      .select('id')
      .limit(1)
      .maybeSingle();
    if (sto) {
      await (supabase.from('sto_settings') as any).update(updates).eq('id', sto.id);
    } else {
      await (supabase.from('sto_settings') as any).insert(updates);
    }
  }
  if ('mechanic_id' in body && 'mechanic_salary_pct' in body) {
    await (supabase.from('users') as any)
      .update({ mechanic_salary_pct: Number(body.mechanic_salary_pct) })
      .eq('id', body.mechanic_id);
  }
  return NextResponse.json({ ok: true });
}
