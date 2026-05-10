/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { getOrderDetail } from '@saldacargo/domain-service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = createAdminClient();
    const order = await getOrderDetail(supabase, id);
    return NextResponse.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { status } = body as { status: string };

    const supabase = createAdminClient();
    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    // При завершении механиком — сбрасываем lifecycle_status в draft,
    // чтобы наряд попал на ревью администратору (даже если был возвращён ранее)
    if (status === 'completed') update.lifecycle_status = 'draft';

    const { data, error } = await (supabase as any)
      .from('service_orders')
      .update(update)
      .eq('id', id)
      .select('id, status')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
