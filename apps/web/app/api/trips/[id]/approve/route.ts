import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/trips/:id/approve — утвердить рейс */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Утверждаем рейс
  const { error: tripError } = await supabase
    .from('trips')
    .update({ lifecycle_status: 'approved' })
    .eq('id', id);

  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });

  // Утверждаем все заказы этого рейса
  const { error: ordersError } = await supabase
    .from('trip_orders')
    .update({ lifecycle_status: 'approved' })
    .eq('trip_id', id)
    .eq('lifecycle_status', 'draft');


  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
