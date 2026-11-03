/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: order, error } = await (supabase.from('orders') as any)
      .select(
        `
        *,
        client:counterparties!orders_client_id_fkey(*),
        forwarder:counterparties!orders_forwarder_id_fkey(*),
        shipper:counterparties!orders_shipper_id_fkey(*),
        consignee:counterparties!orders_consignee_id_fkey(*),
        vehicle:assets(*),
        driver:users!orders_assigned_driver_id_fkey(*),
        loading_point:loading_points_directory(*),
        preset:order_presets(*),
        trip:trips(*)
      `,
      )
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: error?.message || 'Заявка не найдена' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = createAdminClient();

    const updatePayload: any = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    // Если назначили ТС и водителя, но статус был waiting_vehicle — переводим в assigned
    if (
      updatePayload.assigned_vehicle_id &&
      updatePayload.assigned_driver_id &&
      (!updatePayload.status || updatePayload.status === 'waiting_vehicle')
    ) {
      updatePayload.status = 'assigned';
      if (!updatePayload.waybill_number) {
        const year = String(new Date().getFullYear()).slice(-2);
        updatePayload.waybill_number = `ПЛ-${year}/${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    const { data: updated, error } = await (supabase.from('orders') as any)
      .update(updatePayload)
      .eq('id', id)
      .select(
        `
        *,
        client:counterparties!orders_client_id_fkey(*),
        forwarder:counterparties!orders_forwarder_id_fkey(*),
        vehicle:assets(*),
        driver:users!orders_assigned_driver_id_fkey(*)
      `,
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await (supabase.from('orders') as any).delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
