/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();
  const mechanicId =
    searchParams.get('mechanic_id') ||
    cookieStore.get('salda_user_id')?.value ||
    request.headers.get('x-salda-user-id');
  const status = searchParams.get('status') || undefined;
  const unassigned = searchParams.get('unassigned') === 'true';

  if (!mechanicId && !unassigned) {
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
          client_vehicle_brand, client_vehicle_reg,
          works:service_order_works(id, custom_work_name, status, norm_minutes, work_catalog:work_catalog(name))
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

    let query = (supabase.from('service_orders') as any)
      .select(
        `
        id, order_number, machine_type, status, priority, created_at, updated_at,
        asset:assets(short_name, reg_number),
        client_vehicle_brand, client_vehicle_reg,
        works:service_order_works(id, custom_work_name, status, norm_minutes, work_catalog:work_catalog(name))
      `,
      )
      .eq('assigned_mechanic_id', mechanicId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: rawOrders, error } = await query;
    if (error) throw error;

    const orders = rawOrders ?? [];
    const orderIds = orders.map((o: any) => o.id);

    // Подтягиваем транзакции ЗП механика по этим нарядам
    const txMap = new Map<
      string,
      { amount: number; settlement_status: string; employee_confirmed: boolean | null }
    >();
    if (orderIds.length > 0 && mechanicId) {
      const { data: txs } = await (supabase.from('transactions') as any)
        .select('id, amount, service_order_id, settlement_status, employee_confirmed')
        .eq('related_user_id', mechanicId)
        .eq('direction', 'expense')
        .in('service_order_id', orderIds);

      (txs || []).forEach((t: any) => {
        const cur = txMap.get(t.service_order_id) || {
          amount: 0,
          settlement_status: t.settlement_status,
          employee_confirmed: t.employee_confirmed,
        };
        cur.amount += parseFloat(t.amount || '0');
        if (t.settlement_status === 'completed') cur.settlement_status = 'completed';
        if (t.employee_confirmed !== null) cur.employee_confirmed = t.employee_confirmed;
        txMap.set(t.service_order_id, cur);
      });
    }

    const enrichedOrders = orders.map((o: any) => {
      const txInfo = txMap.get(o.id);
      return {
        ...o,
        mechanic_pay: txInfo ? txInfo.amount.toFixed(2) : '0',
        settlement_status: txInfo?.settlement_status ?? 'pending',
        employee_confirmed: txInfo?.employee_confirmed ?? null,
      };
    });

    return NextResponse.json(enrichedOrders);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
