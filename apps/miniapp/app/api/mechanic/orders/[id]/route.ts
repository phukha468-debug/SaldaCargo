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
