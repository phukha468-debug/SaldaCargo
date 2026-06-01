/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/driver/counterparties — список клиентов для водителя */
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await (supabase
    .from('counterparties')
    .select('id, name, is_legal_entity')
    .in('type', ['client', 'both'])
    .eq('is_active', true)
    .order('name') as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Дедупликация: если несколько записей с одинаковым именем — берём первую (после merge они исчезнут)
  const seen = new Set<string>();
  const deduped = (data ?? []).filter((c: any) => {
    const key = c.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json(deduped);
}
