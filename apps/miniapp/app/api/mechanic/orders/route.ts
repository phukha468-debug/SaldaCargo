import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getMechanicOrders } from '@saldacargo/domain-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mechanicId = searchParams.get('mechanic_id');
  const status = searchParams.get('status') || undefined;

  if (!mechanicId) {
    return NextResponse.json({ error: 'mechanic_id is required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const orders = await getMechanicOrders(supabase, mechanicId, status);
    return NextResponse.json(orders);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
