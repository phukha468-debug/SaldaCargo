/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/garage/sto-clients?search= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const supabase = createAdminClient();

  // Все контрагенты у которых есть хотя бы одна клиентская машина
  let query = (supabase.from('counterparties') as any)
    .select(
      `id, name, phone, notes,
       client_vehicles(
         id,
         service_orders:service_orders!service_orders_client_vehicle_id_fkey(
           id, lifecycle_status, created_at,
           works:service_order_works(price_client),
           parts:service_order_parts(client_price, quantity)
         )
       )`,
    )
    .in('type', ['client', 'both'])
    .eq('is_active', true)
    .order('name');

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clients = ((data ?? []) as any[])
    .filter((cp: any) => (cp.client_vehicles ?? []).length > 0)
    .map((cp: any) => {
      const vehicles = cp.client_vehicles ?? [];
      let ordersCount = 0;
      let totalRevenue = 0;
      let lastOrderDate: string | null = null;

      for (const v of vehicles) {
        const orders = (v.service_orders ?? []).filter(
          (o: any) => o.lifecycle_status === 'approved',
        );
        ordersCount += orders.length;

        for (const o of orders) {
          const worksTotal = (o.works ?? []).reduce(
            (s: number, w: any) => s + parseFloat(w.price_client ?? '0'),
            0,
          );
          const partsTotal = (o.parts ?? []).reduce(
            (s: number, p: any) =>
              s + parseFloat(p.client_price ?? '0') * parseFloat(p.quantity ?? '1'),
            0,
          );
          totalRevenue += worksTotal + partsTotal;

          if (!lastOrderDate || o.created_at > lastOrderDate) {
            lastOrderDate = o.created_at;
          }
        }
      }

      return {
        id: cp.id,
        name: cp.name,
        phone: cp.phone,
        vehicles_count: vehicles.length,
        orders_count: ordersCount,
        total_revenue: totalRevenue.toFixed(2),
        last_order_date: lastOrderDate,
      };
    });

  return NextResponse.json(clients);
}

/** POST /api/garage/sto-clients — создать клиента СТО + первый автомобиль атомарно */
export async function POST(request: Request) {
  const body = await request.json();
  const { name, phone, brand, model, reg_number, year, vin, color, odometer_last } = body;

  if (!name?.trim())
    return NextResponse.json({ error: 'Имя клиента обязательно' }, { status: 400 });
  if (!brand?.trim())
    return NextResponse.json({ error: 'Марка автомобиля обязательна' }, { status: 400 });
  if (!reg_number?.trim())
    return NextResponse.json({ error: 'Госномер обязателен' }, { status: 400 });

  const supabase = createAdminClient();

  const { data: cp, error: cpErr } = await (supabase.from('counterparties') as any)
    .insert({
      name: name.trim(),
      phone: phone?.trim() || null,
      type: 'client',
      is_active: true,
      is_regular: true,
    })
    .select('id, name, phone')
    .single();

  if (cpErr) return NextResponse.json({ error: cpErr.message }, { status: 500 });

  const { data: vehicle, error: vErr } = await (supabase.from('client_vehicles') as any)
    .insert({
      counterparty_id: cp.id,
      brand: brand.trim(),
      model: model?.trim() || null,
      reg_number: reg_number.trim(),
      year: year ? parseInt(year) : null,
      vin: vin?.trim() || null,
      color: color?.trim() || null,
      odometer_last: odometer_last ? parseInt(odometer_last) : null,
      is_active: true,
    })
    .select('id')
    .single();

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  return NextResponse.json({ counterparty_id: cp.id, vehicle_id: vehicle.id }, { status: 201 });
}
