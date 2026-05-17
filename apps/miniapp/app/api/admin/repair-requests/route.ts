/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/repair-requests?status=new|approved|rejected */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'new';

  const supabase = createAdminClient();

  const query = (supabase.from('repair_requests') as any)
    .select(
      `
      id, status, custom_description, admin_note, created_at, reviewed_at,
      asset:assets(id, short_name, reg_number),
      driver:users!repair_requests_driver_id_fkey(id, name),
      fault:fault_catalog(id, name, category),
      service_order:service_orders(id, order_number, status)
    `,
    )
    .order('created_at', { ascending: false });

  const { data, error } =
    status === 'all' ? await query.limit(50) : await query.eq('status', status).limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
