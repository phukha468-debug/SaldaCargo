/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { getMechanicOrders } from '@saldacargo/domain-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mechanicId = searchParams.get('mechanic_id');
  const status = searchParams.get('status') || undefined;
  const unassigned = searchParams.get('unassigned') === 'true';

  if (!mechanicId) {
    return NextResponse.json({ error: 'mechanic_id is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    if (unassigned) {
      const { data, error } = await (supabase.from('service_orders') as any)
        .select(
          `
          id, order_number, machine_type, status, priority, created_at,
          asset:assets(short_name, reg_number),
          client_vehicle_brand, client_vehicle_reg
        `,
        )
        .is('assigned_mechanic_id', null)
        .eq('lifecycle_status', 'approved')
        .in('status', ['created'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return NextResponse.json(data ?? []);
    }

    const orders = await getMechanicOrders(supabase, mechanicId, status);
    return NextResponse.json(orders);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
