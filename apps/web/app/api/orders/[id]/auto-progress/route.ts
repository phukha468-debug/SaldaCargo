/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleVehicleDeparture, handleVehicleArrival } from '@saldacargo/domain-service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = body.action || body.event || 'depart'; // 'depart' | 'arrive'

    const supabase = createAdminClient();

    // Загружаем заказ
    const { data: order, error: orderErr } = await (supabase.from('orders') as any)
      .select('*, vehicle:assets(*)')
      .eq('id', id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    if (!order.assigned_vehicle_id) {
      return NextResponse.json({ error: 'К заявке еще не назначен грузовик' }, { status: 400 });
    }

    const currentOdo = order.vehicle?.odometer_current || 120500;

    if (action === 'depart') {
      const odoStart = body.odometer || currentOdo;
      const res = await handleVehicleDeparture(supabase, {
        vehicleId: order.assigned_vehicle_id,
        odometer: odoStart,
        timestamp: body.timestamp || new Date().toISOString(),
      });
      return NextResponse.json(res);
    } else if (action === 'arrive') {
      const odoEnd = body.odometer || currentOdo + 350;
      const res = await handleVehicleArrival(supabase, {
        vehicleId: order.assigned_vehicle_id,
        odometer: odoEnd,
        timestamp: body.timestamp || new Date().toISOString(),
      });
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (err: any) {
    console.error('Ошибка auto-progress:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
